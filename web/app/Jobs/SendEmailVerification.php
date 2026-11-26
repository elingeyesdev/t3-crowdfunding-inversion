<?php

namespace App\Jobs;

use App\Models\User;
use App\Notifications\VerifyAccountEmail;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class SendEmailVerification implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $timeout = 30;

    public function __construct(public string $userId, public string $email) {}

    public function backoff(): array
    {
        return [30, 120, 300];
    }

    public function handle(): void
    {
        $user = User::find($this->userId);
        if (! $user || ! $user->is_active || $user->email_verified || $user->email !== $this->email) {
            return;
        }
        $user->notify(new VerifyAccountEmail);
    }
}
