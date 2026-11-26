<?php

namespace Tests\Feature;

use App\Jobs\SendEmailVerification;
use App\Models\Campaign;
use App\Models\Category;
use App\Models\User;
use App\Notifications\VerifyAccountEmail;
use Illuminate\Auth\Events\Verified;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\URL;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as GoogleUser;
use Tests\TestCase;

class EmailVerificationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        $this->seed();
        Queue::fake([SendEmailVerification::class]);
        Notification::fake();
        Event::fake([Verified::class]);
    }

    private function account(bool $verified = false): User
    {
        $user = User::factory()->create(['email_verified' => $verified]);
        $user->assignRole('investor');
        $user->assignRole('entrepreneur');

        return $user;
    }

    private function login(?User $user): static
    {
        Auth::forgetGuards();

        return $this->withHeader('Authorization', $user ? 'Bearer '.$user->createToken('test')->plainTextToken : '');
    }

    private function link(User $user): string
    {
        return (new VerifyAccountEmail)->verificationPath($user);
    }

    public function test_only_the_authenticated_active_account_can_request_mail_and_resends_are_throttled(): void
    {
        $user = $this->account();
        $other = $this->account();
        $this->postJson('/api/v1/auth/email/verification')->assertUnauthorized();
        $this->login($user)->postJson('/api/v1/auth/email/verification', ['email' => $other->email])->assertStatus(202);
        Queue::assertPushed(SendEmailVerification::class, fn ($job) => $job->userId === $user->id && $job->email === $user->email && $job->queue === 'email-verification' && $job->connection === 'database');
        $this->postJson('/api/v1/auth/email/verification')->assertTooManyRequests();
        $this->travel(61)->seconds();
        $this->postJson('/api/v1/auth/email/verification')->assertStatus(202);
        Queue::assertPushed(SendEmailVerification::class, 2);
        $other->update(['is_active' => false]);
        $this->login($other)->postJson('/api/v1/auth/email/verification')->assertUnauthorized();
    }

    public function test_verified_accounts_do_not_queue_mail_and_stale_jobs_do_not_send(): void
    {
        $verified = $this->account(true);
        $this->login($verified)->postJson('/api/v1/auth/email/verification')->assertOk()->assertJsonPath('data.emailVerified', true);
        Queue::assertNothingPushed();
        $user = $this->account();
        (new SendEmailVerification($user->id, $user->email))->handle();
        Notification::assertSentTo($user, VerifyAccountEmail::class);
        $user->update(['email' => 'changed@example.test']);
        (new SendEmailVerification($user->id, 'original@example.test'))->handle();
        (new SendEmailVerification($verified->id, $verified->email))->handle();
        $user->update(['is_active' => false]);
        (new SendEmailVerification($user->id, $user->email))->handle();
        Notification::assertSentTimes(VerifyAccountEmail::class, 1);
    }

    public function test_confirmation_marks_the_matching_email_verified_and_is_idempotent(): void
    {
        $user = $this->account();
        $link = $this->link($user);
        $this->postJson($link)->assertUnauthorized();
        $this->login($user)->postJson($link)->assertOk()->assertJsonPath('data.emailVerified', true);
        $this->assertTrue($user->fresh()->email_verified);
        Auth::forgetGuards();
        $this->getJson('/api/v1/auth/me')->assertOk()->assertJsonPath('data.emailVerified', true);
        $this->postJson($link)->assertOk();
        Event::assertDispatchedTimes(Verified::class, 1);
    }

    public function test_expired_tampered_wrong_account_and_changed_email_links_cannot_verify(): void
    {
        $user = $this->account();
        $other = $this->account();
        $link = $this->link($user);
        $this->login($other)->postJson($link)->assertForbidden();
        $this->login($user)->postJson($link.'&extra=1')->assertUnprocessable();
        $wrongHash = URL::temporarySignedRoute('email.confirm', now()->addHour(), ['id' => $user->id, 'hash' => sha1($other->email)], absolute: false);
        $this->postJson($wrongHash)->assertForbidden();
        $this->travel(61)->minutes();
        $this->postJson($link)->assertUnprocessable();
        $fresh = $this->link($user);
        $user->update(['email' => 'new-address@example.test']);
        $this->postJson($fresh)->assertForbidden();
        $this->assertFalse($user->fresh()->email_verified);
        $this->assertFalse($other->fresh()->email_verified);
        Event::assertNotDispatched(Verified::class);
    }

    public function test_confirmation_is_not_performed_by_get_or_by_inactive_accounts(): void
    {
        $user = $this->account();
        $link = $this->link($user);
        $this->login($user)->getJson($link)->assertStatus(405);
        $user->update(['is_active' => false]);
        $this->postJson($link)->assertUnauthorized();
        $this->assertFalse($user->fresh()->email_verified);
    }

    public function test_unverified_accounts_keep_login_and_profile_access_but_cannot_invest_submit_or_publish(): void
    {
        $user = $this->account();
        $campaign = Campaign::create(['creator_id' => $user->id, 'category_id' => Category::first()->id, 'title' => 'Pending verification', 'slug' => 'pending-verification', 'goal_amount' => 1000, 'status' => 'draft', 'end_date' => now()->addDays(30)]);
        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'Password123'])->assertOk();
        $this->login($user)->getJson('/api/v1/auth/me')->assertOk()->assertJsonPath('data.emailVerified', false);
        $this->getJson('/api/v1/entrepreneurs/me/campaigns')->assertOk();
        foreach (['/api/v1/investments', '/api/v1/entrepreneurs/me/campaigns/'.$campaign->id.'/submit-for-review', '/api/v1/entrepreneurs/me/campaigns/'.$campaign->id.'/publish'] as $path) {
            $this->postJson($path, ['campaignId' => $campaign->id, 'amount' => 100])->assertForbidden()->assertJsonPath('code', 'EMAIL_VERIFICATION_REQUIRED');
        }
        $this->assertSame('draft', $campaign->fresh()->status);
        $this->assertDatabaseCount('investments', 0);
        $this->assertDatabaseCount('transactions', 0);
        $this->assertDatabaseCount('campaign_status_history', 0);
        $this->postJson($this->link($user))->assertOk();
        Auth::forgetGuards();
        // After verification the request reaches business validation, rather than the email gate.
        $this->postJson('/api/v1/investments', [])->assertUnprocessable();
        $this->postJson('/api/v1/entrepreneurs/me/campaigns/'.$campaign->id.'/submit-for-review')->assertOk();
    }

    public function test_queue_unavailability_is_reported_without_marking_the_account_verified(): void
    {
        $user = $this->account();
        config(['email_verification.connection' => 'sync']);
        $this->login($user)->postJson('/api/v1/auth/email/verification')->assertStatus(503);
        $this->assertFalse($user->fresh()->email_verified);
        Queue::assertNothingPushed();
        $this->travel(61)->seconds();
        config(['email_verification.connection' => 'database']);
        Bus::shouldReceive('dispatch')->once()->andThrow(new \RuntimeException('Queue unavailable'));
        $this->postJson('/api/v1/auth/email/verification')->assertStatus(503);
        $this->assertFalse($user->fresh()->email_verified);
    }

    public function test_google_keeps_or_restores_the_verified_address_for_an_existing_linked_account(): void
    {
        $user = $this->account();
        $user->update(['oauth_provider' => 'google', 'oauth_provider_id' => 'google-fixture']);
        $google = (new GoogleUser)->setRaw(['email_verified' => true])->map(['id' => 'google-fixture', 'email' => $user->email]);
        Socialite::shouldReceive('driver->user')->once()->andReturn($google);
        $this->get('/api/v1/auth/google/callback')->assertRedirect();
        $this->assertTrue($user->fresh()->email_verified);
        $this->login($user)->postJson('/api/v1/auth/email/verification')->assertOk()->assertJsonPath('data.emailVerified', true);
        Queue::assertNothingPushed();
    }

    public function test_notification_uses_the_configured_origin_and_the_page_prevents_referrer_leaks(): void
    {
        config(['app.url' => 'https://trusted.example.test']);
        $user = $this->account();
        $mail = (new VerifyAccountEmail)->toMail($user);
        $this->assertStringStartsWith('https://trusted.example.test/verify-email?', $mail->actionUrl);
        parse_str(parse_url($mail->actionUrl, PHP_URL_QUERY), $query);
        $this->login($user)->postJson($query['verification'])->assertOk();
        $this->get('/verify-email')->assertOk()->assertHeader('Referrer-Policy', 'no-referrer')->assertHeader('Cache-Control', 'no-store, private');
    }
}
