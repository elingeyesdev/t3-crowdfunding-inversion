<?php

namespace App\Services;

use App\Mail\ActivityNotice;
use App\Models\ActivityEmailDelivery;
use App\Models\User;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\Mailer\Transport\Smtp\SmtpTransport;

class ActivityMailChannel
{
    public function status(User $user): array
    {
        $mailer = config('mail.mailers.'.config('mail.default'), []);
        $connection = config('activity_mail.connection');
        $driver = config('queue.connections.'.$connection.'.driver');
        $reason = ! config('activity_mail.enabled') ? 'disabled'
            : (($mailer['transport'] ?? null) !== 'smtp' || empty($mailer['host']) || ! filter_var(config('mail.from.address'), FILTER_VALIDATE_EMAIL) || ! in_array($driver, ['database', 'redis', 'sqs', 'beanstalkd'], true) ? 'not_configured'
            : (! $user->is_active ? 'inactive' : (! $user->email_verified ? 'unverified' : 'available')));

        return ['available' => $reason === 'available', 'reason' => $reason];
    }

    public function connect(): void
    {
        $transport = Mail::mailer()->getSymfonyTransport();
        if (! $transport instanceof SmtpTransport) {
            throw new \RuntimeException('Activity mail requires SMTP.');
        }
        // Workers are long-lived; an idle SMTP connection may already be closed.
        // Open a fresh connection so connection failures stay safely retryable.
        $transport->stop();
        // A failure here precedes MAIL FROM/DATA and is safe to retry.
        $transport->start();
    }

    public function send(ActivityEmailDelivery $delivery): void
    {
        Mail::to($delivery->email)->send(new ActivityNotice($delivery));
    }
}
