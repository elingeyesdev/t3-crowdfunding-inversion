<?php

namespace Tests\Feature;

use App\Jobs\SendPasswordResetLink;
use App\Models\User;
use App\Notifications\ResetPasswordLink;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\TestCase;

class PasswordRecoveryTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        $this->seed();
        Queue::fake([SendPasswordResetLink::class]);
        Notification::fake();
    }

    private function user(array $attributes = []): User
    {
        $user = User::create(['email' => Str::uuid().'@example.test', 'password_hash' => Hash::make('Original123'), ...$attributes])->fresh();
        $user->assignRole('investor');

        return $user;
    }

    private function token(User $user): string
    {
        (new SendPasswordResetLink($user->email))->handle();
        $token = null;
        Notification::assertSentTo($user, ResetPasswordLink::class, function ($notification) use (&$token) {
            $token = $notification->token;

            return true;
        });

        return $token;
    }

    private function payload(User $user, string $token, string $password = 'Recovered456'): array
    {
        return ['email' => $user->email, 'token' => $token, 'password' => $password, 'password_confirmation' => $password];
    }

    public function test_requests_are_uniform_and_queue_every_valid_address_without_disclosing_accounts(): void
    {
        $users = [$this->user(), $this->user(['password_hash' => null, 'oauth_provider' => 'google']), $this->user(['is_active' => false])];
        $responses = [];
        foreach ([...array_map(fn ($u) => $u->email, $users), 'unknown@example.test'] as $email) {
            $response = $this->postJson('/api/v1/auth/forgot-password', ['email' => strtoupper($email)])->assertStatus(202);
            $response->assertDontSee($email)->assertDontSee('token');
            $responses[] = $response->json();
        }
        foreach ($responses as $response) {
            $this->assertSame($responses[0], $response);
        }
        Queue::assertPushed(SendPasswordResetLink::class, 4);
        Queue::assertPushed(SendPasswordResetLink::class, fn ($job) => $job->email === $users[0]->email && $job->connection === 'database');
        Notification::assertNothingSent();
    }

    public function test_only_active_accounts_with_a_local_password_receive_a_hashed_temporary_token(): void
    {
        $local = $this->user(['oauth_provider' => 'google']);
        $token = $this->token($local);
        $stored = DB::table('password_reset_tokens')->where('email', $local->email)->first();
        $this->assertNotSame($token, $stored->token);
        $this->assertTrue(Hash::check($token, $stored->token));
        foreach ([$this->user(['password_hash' => null, 'oauth_provider' => 'google']), $this->user(['is_active' => false])] as $user) {
            (new SendPasswordResetLink($user->email))->handle();
            Notification::assertNotSentTo($user, ResetPasswordLink::class);
            $this->assertDatabaseMissing('password_reset_tokens', ['email' => $user->email]);
        }
        (new SendPasswordResetLink('unknown@example.test'))->handle();
        Notification::assertSentTimes(ResetPasswordLink::class, 1);
    }

    public function test_reset_changes_credentials_consumes_the_token_and_revokes_only_that_accounts_sessions(): void
    {
        $user = $this->user();
        $oldSession = $user->createToken('old-session')->plainTextToken;
        $foreign = $this->user();
        $foreignToken = $foreign->createToken('foreign')->plainTextToken;
        foreach ([$user, $foreign] as $owner) {
            DB::table('sessions')->insert(['id' => $owner->id, 'user_id' => $owner->id, 'payload' => '', 'last_activity' => time()]);
        }
        $token = $this->token($user);
        $this->postJson('/api/v1/auth/reset-password', $this->payload($user, $token))->assertOk()
            ->assertJsonPath('data.sessionsRevoked', true)->assertDontSee($token)->assertDontSee('Recovered456');
        $this->assertTrue(Hash::check('Recovered456', $user->fresh()->password_hash));
        $this->assertDatabaseMissing('password_reset_tokens', ['email' => $user->email]);
        $this->assertDatabaseMissing('sessions', ['user_id' => $user->id]);
        $this->assertDatabaseHas('sessions', ['user_id' => $foreign->id]);
        Auth::forgetGuards();
        $this->withHeader('Authorization', 'Bearer '.$oldSession)->getJson('/api/v1/auth/me')->assertUnauthorized();
        Auth::forgetGuards();
        $this->withHeader('Authorization', 'Bearer '.$foreignToken)->getJson('/api/v1/auth/me')->assertOk();
        $this->withHeader('Authorization', '')->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'Original123'])->assertUnauthorized();
        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'Recovered456'])->assertOk();
        $this->postJson('/api/v1/auth/reset-password', $this->payload($user, $token, 'Reused789'))->assertUnprocessable();
        $this->assertTrue(Hash::check('Recovered456', $user->fresh()->password_hash));
    }

    public function test_invalid_expired_wrong_account_and_replaced_tokens_cannot_change_credentials(): void
    {
        $user = $this->user();
        $first = $this->token($user);
        $this->postJson('/api/v1/auth/reset-password', $this->payload($user, str_repeat('x', 64)))->assertUnprocessable();
        $other = $this->user();
        $this->postJson('/api/v1/auth/reset-password', $this->payload($other, $first))->assertUnprocessable();
        $this->travel(61)->seconds();
        Notification::fake();
        $second = $this->token($user);
        $this->assertNotSame($first, $second);
        $this->postJson('/api/v1/auth/reset-password', $this->payload($user, $first))->assertUnprocessable();
        $this->travel(61)->minutes();
        $this->postJson('/api/v1/auth/reset-password', $this->payload($user, $second))->assertUnprocessable();
        $this->assertTrue(Hash::check('Original123', $user->fresh()->password_hash));
    }

    public function test_password_policy_confirmation_and_account_eligibility_are_checked_without_consuming_valid_tokens(): void
    {
        $user = $this->user();
        $token = $this->token($user);
        foreach (['Short1', 'lowercase123', 'NoDigitsHere', str_repeat('A', 128).'1'] as $password) {
            $this->postJson('/api/v1/auth/reset-password', $this->payload($user, $token, $password))->assertUnprocessable()->assertJsonValidationErrors('password');
        }
        $this->postJson('/api/v1/auth/reset-password', [...$this->payload($user, $token), 'password_confirmation' => 'Mismatch123'])->assertUnprocessable();
        $this->assertTrue(Password::tokenExists($user, $token));
        $user->update(['is_active' => false]);
        $this->postJson('/api/v1/auth/reset-password', $this->payload($user, $token))->assertUnprocessable();
        $user->update(['is_active' => true, 'password_hash' => null, 'oauth_provider' => 'google']);
        $this->postJson('/api/v1/auth/reset-password', $this->payload($user, $token))->assertUnprocessable();
        $this->assertNull($user->fresh()->password_hash);
    }

    public function test_requests_are_rate_limited_even_for_unknown_and_case_variant_addresses(): void
    {
        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'unknown@example.test'])->assertStatus(202);
        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'UNKNOWN@EXAMPLE.TEST'])->assertTooManyRequests();
        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'invalid'])->assertUnprocessable();
        foreach (range(1, 11) as $index) {
            $response = $this->postJson('/api/v1/auth/reset-password', $this->payload($this->user(), 'invalid'));
        }
        $response->assertTooManyRequests();
    }

    public function test_queue_failure_is_uniform_and_delivery_failure_rolls_back_the_new_token(): void
    {
        Bus::shouldReceive('dispatch')->twice()->andThrow(new RuntimeException('Queue unavailable'));
        foreach ([$this->user()->email, 'unknown@example.test'] as $email) {
            $this->postJson('/api/v1/auth/forgot-password', ['email' => $email])->assertStatus(503)->assertDontSee($email)->assertDontSee('Queue unavailable');
        }
        $user = $this->user();
        Notification::shouldReceive('send')->once()->andThrow(new RuntimeException('SMTP unavailable'));
        try {
            (new SendPasswordResetLink($user->email))->handle();
            $this->fail('SMTP failure must be retried by the worker.');
        } catch (RuntimeException $error) {
            $this->assertSame('SMTP unavailable', $error->getMessage());
        }
        $this->assertDatabaseMissing('password_reset_tokens', ['email' => $user->email]);
    }

    public function test_mail_link_uses_the_configured_origin_and_reset_page_does_not_leak_referrers(): void
    {
        config(['app.url' => 'https://trusted.example.test']);
        $user = $this->user(['email' => 'plus+account@example.test']);
        $notification = new ResetPasswordLink('test-token');
        $mail = $notification->toMail($user);
        $this->assertStringStartsWith('https://trusted.example.test/reset-password?', $mail->actionUrl);
        parse_str(parse_url($mail->actionUrl, PHP_URL_QUERY), $query);
        $this->assertSame($user->email, $query['email']);
        $this->assertSame('test-token', $query['token']);
        $this->get('/reset-password?token=test-token')->assertOk()->assertHeader('Referrer-Policy', 'no-referrer')->assertHeader('Cache-Control', 'no-store, private');
    }

    public function test_repeated_jobs_do_not_send_duplicate_mail_and_a_sync_queue_is_rejected_uniformly(): void
    {
        $user = $this->user();
        $this->token($user);
        (new SendPasswordResetLink($user->email))->handle();
        Notification::assertSentTimes(ResetPasswordLink::class, 1);
        config(['password_recovery.connection' => 'sync']);
        foreach ([$user->email, 'unknown@example.test'] as $email) {
            $this->postJson('/api/v1/auth/forgot-password', ['email' => $email])->assertStatus(503)->assertDontSee($email);
        }
    }

    public function test_session_revocation_failure_rolls_back_password_change_and_token_consumption(): void
    {
        $user = $this->user();
        $user->createToken('keep-on-failure');
        $token = $this->token($user);
        $failOnce = true;
        DB::listen(function ($query) use (&$failOnce) {
            if ($failOnce && str_contains(strtolower($query->sql), 'delete from "personal_access_tokens"')) {
                $failOnce = false;
                throw new RuntimeException('Revocation unavailable');
            }
        });
        $this->withoutExceptionHandling();
        try {
            $this->postJson('/api/v1/auth/reset-password', $this->payload($user, $token));
            $this->fail('A partial password reset must not be committed.');
        } catch (RuntimeException $error) {
            $this->assertSame('Revocation unavailable', $error->getMessage());
        }
        $this->assertTrue(Hash::check('Original123', $user->fresh()->password_hash));
        $this->assertTrue(Password::tokenExists($user, $token));
        $this->assertSame(1, $user->tokens()->count());
    }
}
