<?php

namespace Tests\Feature;

use App\Jobs\SendActivityEmail;
use App\Mail\ActivityNotice;
use App\Models\ActivityEmailDelivery;
use App\Models\Conversation;
use App\Models\Notification;
use App\Models\User;
use App\Services\ActivityMailChannel;
use App\Services\Notifier;
use App\Support\NotificationPreferences;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Mockery;
use RuntimeException;
use Tests\TestCase;

class ActivityMailTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        $this->seed();
        config(['activity_mail.enabled' => true, 'activity_mail.connection' => 'database', 'mail.default' => 'smtp', 'mail.mailers.smtp.host' => '127.0.0.1', 'mail.from.address' => 'sender@example.test']);
        Queue::fake([SendActivityEmail::class]);
    }

    private function user(array $prefs = [], array $attributes = []): User
    {
        return User::factory()->create(['notification_preferences' => $prefs, ...$attributes])->fresh();
    }

    private function notify(User $user, string $code = 'investment_received'): ?Notification
    {
        return app(Notifier::class)->send($user->id, $code, 'Activity notice', 'Activity body');
    }

    private function delivery(User $user): ActivityEmailDelivery
    {
        $this->notify($user);

        return ActivityEmailDelivery::where('user_id', $user->id)->firstOrFail();
    }

    public function test_email_and_in_app_switches_are_independent_and_mail_does_not_inflate_the_feed(): void
    {
        $mailOnly = $this->user(['inAppEnabled' => false, 'emailEnabled' => true]);
        $this->assertNull($this->notify($mailOnly));
        $this->assertDatabaseCount('notifications', 0);
        $delivery = ActivityEmailDelivery::sole();
        Queue::assertPushed(SendActivityEmail::class, fn ($job) => $job->deliveryId === $delivery->id && $job->queue === 'activity-mail' && $job->connection === 'database');
        $appOnly = $this->user(['emailEnabled' => false]);
        $this->assertNotNull($this->notify($appOnly));
        $both = $this->user();
        $this->assertNotNull($this->notify($both));
        $this->assertDatabaseCount('notifications', 2);
        $this->assertDatabaseCount('activity_email_deliveries', 2);
        $this->withToken($mailOnly->createToken('test')->plainTextToken)->getJson('/api/v1/notifications/unread-count')->assertOk()->assertJsonPath('data.unreadCount', 0);
    }

    public function test_all_defined_categories_and_per_event_preferences_apply_to_email(): void
    {
        foreach (NotificationPreferences::CATEGORY_EVENTS as $key => $events) {
            foreach ($events as $code) {
                $blocked = $this->user([$key => false, 'categories' => [$code => true]]);
                $this->assertNull($this->notify($blocked, $code));
                $this->assertSame(0, ActivityEmailDelivery::where('user_id', $blocked->id)->count());
                $enabled = $this->user();
                $this->assertNotNull($this->notify($enabled, $code));
                $this->assertSame(1, ActivityEmailDelivery::where('user_id', $enabled->id)->count());
            }
        }
        $blocked = $this->user(['categories' => ['kyc_reviewed' => false]]);
        $this->assertNull($this->notify($blocked, 'kyc_reviewed'));
        $this->assertSame(0, ActivityEmailDelivery::where('user_id', $blocked->id)->count());
        foreach (['kyc_reviewed', 'reward_shipped', 'reward_delivered', 'financial_movement_verified', 'document_rejected'] as $code) {
            $user = $this->user();
            $this->notify($user, $code);
            $this->assertSame(1, ActivityEmailDelivery::where('user_id', $user->id)->count());
        }
        $this->notify($this->user(), 'custom_unknown_event');
        $this->assertSame(0, ActivityEmailDelivery::where('type_code', 'custom_unknown_event')->count());
    }

    public function test_unavailable_channels_unverified_and_inactive_users_do_not_queue_mail(): void
    {
        foreach (['email_verified' => false, 'is_active' => false] as $key => $value) {
            $this->notify($this->user([], [$key => $value]));
        }
        $user = $this->user();
        config(['mail.default' => 'log']);
        $this->notify($user);
        config(['mail.default' => 'smtp', 'activity_mail.enabled' => false]);
        $this->notify($user);
        config(['activity_mail.enabled' => true, 'activity_mail.connection' => 'sync']);
        $this->notify($user);
        Queue::assertNothingPushed();
        $this->assertDatabaseCount('activity_email_deliveries', 0);
        $this->assertDatabaseCount('notifications', 5);
    }

    public function test_mail_and_web_notices_roll_back_with_the_business_transaction(): void
    {
        $user = $this->user();
        try {
            DB::transaction(function () use ($user) {
                $this->notify($user);
                Queue::assertNothingPushed();
                throw new RuntimeException('Business rollback');
            });
        } catch (RuntimeException $error) {
            $this->assertSame('Business rollback', $error->getMessage());
        }
        $this->assertDatabaseCount('notifications', 0);
        $this->assertDatabaseCount('activity_email_deliveries', 0);
        Queue::assertNothingPushed();
    }

    public function test_queue_failure_keeps_the_committed_notice_and_the_scheduler_recovers_delivery(): void
    {
        $dispatcher = Bus::getFacadeRoot();
        Bus::shouldReceive('dispatch')->once()->andThrow(new RuntimeException('Queue offline'));
        try {
            $this->assertNotNull($this->notify($this->user()));
        } finally {
            Bus::swap($dispatcher);
        }
        $delivery = ActivityEmailDelivery::sole();
        $this->assertSame('pending', $delivery->status);
        $this->assertSame('queue_unavailable', $delivery->last_error);
        $this->assertDatabaseCount('notifications', 1);
        $this->artisan('notifications:dispatch-mail')->assertSuccessful();
        Queue::assertPushed(SendActivityEmail::class, 1);
        $this->artisan('notifications:dispatch-mail')->assertSuccessful();
        Queue::assertPushed(SendActivityEmail::class, 1);
    }

    public function test_duplicate_jobs_send_once_and_deleting_the_bell_notice_does_not_cancel_mail(): void
    {
        $delivery = $this->delivery($this->user());
        Notification::query()->delete();
        $channel = Mockery::mock(ActivityMailChannel::class)->makePartial();
        $channel->shouldReceive('connect')->once();
        $channel->shouldReceive('send')->once()->withArgs(fn ($row) => $row->id === $delivery->id);
        $job = new SendActivityEmail($delivery->id);
        $job->handle($channel);
        $job->handle($channel);
        $this->assertSame('sent', $delivery->fresh()->status);
        $this->assertSame(1, $delivery->fresh()->attempts);
        $this->assertNotNull($delivery->fresh()->sent_at);
    }

    public function test_preferences_and_account_identity_are_rechecked_at_delivery_time(): void
    {
        foreach ([['notification_preferences' => ['emailEnabled' => false]], ['notification_preferences' => ['investmentAlerts' => false]], ['notification_preferences' => ['categories' => ['investment_received' => false]]], ['is_active' => false], ['email_verified' => false], ['email' => 'changed@example.test']] as $changes) {
            $user = $this->user();
            $delivery = $this->delivery($user);
            $user->update($changes);
            $channel = Mockery::mock(ActivityMailChannel::class)->makePartial();
            $channel->shouldNotReceive('connect');
            $channel->shouldNotReceive('send');
            (new SendActivityEmail($delivery->id))->handle($channel);
            $this->assertSame('skipped', $delivery->fresh()->status);
        }
    }

    public function test_connection_failures_are_retryable_and_exhaustion_is_traceable(): void
    {
        $delivery = $this->delivery($this->user());
        $channel = Mockery::mock(ActivityMailChannel::class)->makePartial();
        $channel->shouldReceive('connect')->once()->andThrow(new RuntimeException('SMTP offline'));
        $channel->shouldNotReceive('send');
        $job = new SendActivityEmail($delivery->id);
        try {
            $job->handle($channel);
            $this->fail('Expected connection failure');
        } catch (RuntimeException $error) {
            $this->assertSame('SMTP offline', $error->getMessage());
        }
        $this->assertSame('pending', $delivery->fresh()->status);
        $this->assertSame('smtp_connect_failed', $delivery->fresh()->last_error);
        $this->assertSame(3, $job->tries);
        $job->failed(new RuntimeException('Exhausted'));
        $this->assertSame('failed', $delivery->fresh()->status);
        $this->artisan('notifications:dispatch-mail', ['--retry-failed' => true])->assertSuccessful();
        $this->assertSame('pending', $delivery->fresh()->status);
    }

    public function test_uncertain_or_interrupted_delivery_is_quarantined_without_automatic_resend(): void
    {
        $delivery = $this->delivery($this->user());
        $channel = Mockery::mock(ActivityMailChannel::class)->makePartial();
        $channel->shouldReceive('connect')->once();
        $channel->shouldReceive('send')->once()->andThrow(new RuntimeException('Connection lost during DATA'));
        $job = new SendActivityEmail($delivery->id);
        $job->handle($channel);
        $job->handle($channel);
        $this->assertSame('uncertain', $delivery->fresh()->status);
        $delivery->update(['status' => 'sending', 'updated_at' => now()->subMinutes(3)]);
        $this->artisan('notifications:dispatch-mail', ['--retry-failed' => true])->assertSuccessful();
        $this->assertSame('uncertain', $delivery->fresh()->status);
        $this->assertSame('interrupted_delivery', $delivery->fresh()->last_error);
    }

    public function test_channel_status_is_read_only_and_reports_configuration_and_verification(): void
    {
        $user = $this->user();
        $this->withToken($user->createToken('test')->plainTextToken)->getJson('/api/v1/notifications/preferences')->assertOk()->assertJsonPath('data.emailChannel.available', true);
        $this->putJson('/api/v1/notifications/preferences', ['emailEnabled' => false, 'emailChannel' => ['available' => true]])->assertOk();
        $this->assertArrayNotHasKey('emailChannel', $user->fresh()->notification_preferences);
        config(['mail.default' => 'log']);
        $this->getJson('/api/v1/notifications/preferences')->assertOk()->assertJsonPath('data.emailChannel.reason', 'not_configured');
        config(['mail.default' => 'smtp']);
        $user->update(['email_verified' => false]);
        Auth::forgetGuards();
        $this->getJson('/api/v1/notifications/preferences')->assertOk()->assertJsonPath('data.emailChannel.reason', 'unverified');
    }

    public function test_mail_escapes_user_content_and_restricts_action_links_to_the_app_origin(): void
    {
        config(['app.url' => 'https://trusted.example.test']);
        $delivery = $this->delivery($this->user());
        $delivery->update(['title' => '<script>bad</script> [click](https://evil.test)', 'body' => '<img src="https://evil.test"> [click](https://evil.test)', 'action_url' => '//evil.test']);
        $mail = new ActivityNotice($delivery->fresh());
        $html = $mail->render();
        $this->assertStringNotContainsString('<script>', $html);
        $this->assertStringNotContainsString('<img', $html);
        $this->assertStringNotContainsString('href="https://evil.test', $html);
        $this->assertStringContainsString('href="https://trusted.example.test/notifications"', $html);
        $this->assertStringContainsString($delivery->id, $mail->headers()->messageId);
    }

    public function test_chat_notifies_only_the_recipient_without_copying_private_message_contents(): void
    {
        $sender = $this->user();
        $recipient = $this->user(['inAppEnabled' => false]);
        $conversation = Conversation::create(['user_one_id' => $sender->id, 'user_two_id' => $recipient->id]);
        $this->withToken($sender->createToken('test')->plainTextToken)->postJson('/api/v1/chat/conversations/'.$conversation->id.'/messages', ['content' => 'PRIVATE CONTENT'])->assertCreated();
        $delivery = ActivityEmailDelivery::sole();
        $this->assertSame($recipient->id, $delivery->user_id);
        $this->assertSame('/chat/'.$conversation->id, $delivery->action_url);
        $this->assertStringNotContainsString('PRIVATE CONTENT', $delivery->body);
        $recipient->update(['notification_preferences' => ['commentAlerts' => false]]);
        $this->postJson('/api/v1/chat/conversations/'.$conversation->id.'/messages', ['content' => 'SECOND PRIVATE CONTENT'])->assertCreated();
        $this->assertDatabaseCount('activity_email_deliveries', 1);
        $this->assertDatabaseCount('messages', 2);
    }

    public function test_status_command_can_inspect_failures_without_modifying_or_resending_them(): void
    {
        $delivery = $this->delivery($this->user());
        $delivery->update(['status' => 'uncertain']);
        $this->artisan('notifications:mail-status', ['--status' => 'uncertain'])->expectsOutputToContain($delivery->id)->assertSuccessful();
        $this->assertSame('uncertain', $delivery->fresh()->status);
        $this->artisan('notifications:mail-status', ['--status' => 'invalid'])->assertFailed();
    }
}
