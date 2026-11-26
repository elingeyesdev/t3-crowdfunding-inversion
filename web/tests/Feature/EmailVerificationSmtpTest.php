<?php

namespace Tests\Feature;

use App\Jobs\SendEmailVerification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Symfony\Component\Process\Process;
use Tests\TestCase;

class EmailVerificationSmtpTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_real_smtp_message_is_captured_locally_and_its_signed_link_verifies_the_account(): void
    {
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        Queue::fake([SendEmailVerification::class]);
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
            $user = User::factory()->unverified()->create(['email' => 'verification-fixture@example.test']);
            $this->withToken($user->createToken('test')->plainTextToken)
                ->postJson('/api/v1/auth/email/verification')->assertStatus(202);
            $job = null;
            Queue::assertPushed(SendEmailVerification::class, function ($queued) use (&$job) {
                $job = $queued;

                return true;
            });
            $job->handle();
            $capture->wait();
            $this->assertSame(0, $capture->getExitCode());
            $lines = explode("\n", trim($capture->getOutput()));
            $packet = json_decode($lines[1], true, flags: JSON_THROW_ON_ERROR);
            $message = html_entity_decode(quoted_printable_decode(base64_decode($packet['message'])));
            $this->assertStringContainsString($user->email, $message);
            $this->assertStringContainsString('Verifica tu correo en UniFundMe', $message);
            $this->assertSame(1, preg_match('#http://localhost:8765/verify-email\?[^\s<>"\r\n]+#', $message, $match));
            parse_str(parse_url($match[0], PHP_URL_QUERY), $query);
            $this->assertFalse($user->fresh()->email_verified);
            $this->postJson($query['verification'])->assertOk()->assertJsonPath('data.emailVerified', true);
            $this->assertTrue($user->fresh()->email_verified);
        } finally {
            $capture->stop();
            Mail::purge();
        }
    }
}
