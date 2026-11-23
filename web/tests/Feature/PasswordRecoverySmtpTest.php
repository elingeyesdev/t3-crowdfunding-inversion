<?php

namespace Tests\Feature;

use App\Jobs\SendPasswordResetLink;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Symfony\Component\Process\Process;
use Tests\TestCase;

class PasswordRecoverySmtpTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_queued_request_delivers_a_real_smtp_message_to_a_local_capture_and_its_link_resets_the_account(): void
    {
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        $this->seed();
        Queue::fake([SendPasswordResetLink::class]);
        $capture = new Process([PHP_BINARY, base_path('tests/Support/smtp-capture.php')]);
        $capture->setTimeout(15);
        $capture->start();
        try {
            $capture->waitUntil(fn () => str_contains($capture->getOutput(), "\n"));
            $ready = json_decode(strtok($capture->getOutput(), "\n"), true, flags: JSON_THROW_ON_ERROR);
            $port = (int) substr(strrchr($ready['address'], ':'), 1);
            config(['app.url' => 'http://localhost:8765', 'mail.default' => 'smtp',
                'mail.mailers.smtp.host' => '127.0.0.1', 'mail.mailers.smtp.port' => $port,
                'mail.mailers.smtp.scheme' => 'smtp', 'mail.mailers.smtp.url' => null,
                'mail.mailers.smtp.username' => null, 'mail.mailers.smtp.password' => null,
                'mail.mailers.smtp.timeout' => 5, 'mail.from.address' => 'sender@example.test']);
            Mail::purge();
            $user = User::create(['email' => 'smtp-fixture@example.test', 'password_hash' => Hash::make('Original123')]);
            $this->postJson('/api/v1/auth/forgot-password', ['email' => $user->email])->assertStatus(202);
            $job = null;
            Queue::assertPushed(SendPasswordResetLink::class, function ($queued) use (&$job) {
                $job = $queued;

                return true;
            });
            $job->handle();
            $capture->wait();
            $this->assertSame(0, $capture->getExitCode());
            $lines = explode("\n", trim($capture->getOutput()));
            $packet = json_decode($lines[1], true, flags: JSON_THROW_ON_ERROR);
            $message = html_entity_decode(quoted_printable_decode(base64_decode($packet['message'])));
            $this->assertStringContainsString('smtp-fixture@example.test', $message);
            $this->assertStringContainsString('Recupera tu acceso', $message);
            $this->assertSame(1, preg_match('#http://localhost:8765/reset-password\?[^\s<>"\r\n]+#', $message, $match));
            parse_str(parse_url($match[0], PHP_URL_QUERY), $query);
            $this->assertSame($user->email, $query['email']);
            $this->postJson('/api/v1/auth/reset-password', [...$query, 'password' => 'Delivered456', 'password_confirmation' => 'Delivered456'])->assertOk();
            $this->assertTrue(Hash::check('Delivered456', $user->fresh()->password_hash));
        } finally {
            $capture->stop();
            Mail::purge();
        }
    }
}
