<?php

namespace Tests\Feature;

use App\Jobs\SendActivityEmail;
use App\Models\ActivityEmailDelivery;
use App\Models\User;
use App\Services\ActivityMailChannel;
use App\Services\Notifier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Symfony\Component\Process\Process;
use Tests\TestCase;

class ActivityMailSmtpTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_real_smtp_activity_notice_is_captured_once_even_with_duplicate_jobs_and_the_bell_disabled(): void
    {
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        Queue::fake([SendActivityEmail::class]);
        $capture = new Process([PHP_BINARY, base_path('tests/Support/smtp-capture.php')]);
        $capture->setTimeout(15);
        $capture->start();
        try {
            $capture->waitUntil(fn () => str_contains($capture->getOutput(), "\n"));
            $ready = json_decode(strtok($capture->getOutput(), "\n"), true, flags: JSON_THROW_ON_ERROR);
            $port = (int) substr(strrchr($ready['address'], ':'), 1);
            config(['app.url' => 'http://localhost:8765', 'mail.default' => 'smtp',
                'activity_mail.enabled' => true, 'activity_mail.connection' => 'database',
                'mail.mailers.smtp.host' => '127.0.0.1', 'mail.mailers.smtp.port' => $port,
                'mail.mailers.smtp.scheme' => 'smtp', 'mail.mailers.smtp.url' => null,
                'mail.mailers.smtp.username' => null, 'mail.mailers.smtp.password' => null,
                'mail.mailers.smtp.timeout' => 5, 'mail.from.address' => 'sender@example.test']);
            Mail::purge();
            $user = User::factory()->create(['email' => 'activity-fixture@example.test', 'notification_preferences' => ['inAppEnabled' => false, 'emailEnabled' => true]]);
            $this->assertNull(app(Notifier::class)->send($user->id, 'investment_received', 'Nuevo aporte recibido', 'Tu proyecto recibió un aporte.'));
            $job = null;
            Queue::assertPushed(SendActivityEmail::class, function ($queued) use (&$job) {
                $job = $queued;

                return true;
            });
            $job->handle(app(ActivityMailChannel::class));
            $job->handle(app(ActivityMailChannel::class));
            $capture->wait();
            $this->assertSame(0, $capture->getExitCode());
            $lines = explode("\n", trim($capture->getOutput()));
            $this->assertCount(2, $lines);
            $packet = json_decode($lines[1], true, flags: JSON_THROW_ON_ERROR);
            $message = html_entity_decode(quoted_printable_decode(base64_decode($packet['message'])));
            $this->assertStringContainsString($user->email, $message);
            $this->assertStringContainsString('Nuevo aporte recibido', $message);
            $this->assertStringContainsString('http://localhost:8765/notifications', $message);
            $delivery = ActivityEmailDelivery::sole();
            $this->assertSame('sent', $delivery->status);
            $this->assertSame(1, $delivery->attempts);
            $this->assertStringContainsString($delivery->id.'@localhost', $message);
            $this->assertDatabaseCount('notifications', 0);
        } finally {
            $capture->stop();
            Mail::purge();
        }
    }
}
