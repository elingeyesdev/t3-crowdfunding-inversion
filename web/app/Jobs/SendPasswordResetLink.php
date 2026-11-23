<?php

namespace App\Jobs;

use App\Models\User;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;

class SendPasswordResetLink implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $timeout = 30;

    public function __construct(public string $email) {}

    public function backoff(): array
    {
        return [30, 120, 300];
    }

    public function handle(): void
    {
        DB::transaction(function () {
            $user = User::where('email', $this->email)->lockForUpdate()->first();
            if (! $user || ! $user->is_active || ! $user->password_hash) {
                return;
            }
            // The same user lock serializes issuance and consumption. A failed
            // SMTP delivery rolls back token replacement and can be retried.
            Password::broker()->sendResetLink(['email' => $user->email]);
        }, 3);
    }
}
