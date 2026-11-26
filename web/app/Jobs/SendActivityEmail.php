<?php

namespace App\Jobs;

use App\Models\ActivityEmailDelivery;
use App\Models\User;
use App\Services\ActivityMailChannel;
use App\Support\NotificationPreferences;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SendActivityEmail implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $timeout = 30;

    public function __construct(public string $deliveryId) {}

    public function backoff(): array
    {
        return [30, 120, 300];
    }

    public function handle(ActivityMailChannel $channel): void
    {
        // An atomic claim serializes duplicate jobs without holding a DB lock during SMTP.
        $claimed = ActivityEmailDelivery::whereKey($this->deliveryId)->where('status', 'pending')
            ->update(['status' => 'sending', 'attempts' => DB::raw('attempts + 1'), 'updated_at' => now()]);
        if (! $claimed) {
            return;
        }
        $delivery = ActivityEmailDelivery::findOrFail($this->deliveryId);
        $user = User::find($delivery->user_id);
        if (! $user || $user->email !== $delivery->email || ! $channel->status($user)['available'] || ! NotificationPreferences::allows($user, $delivery->type_code, 'email')) {
            $delivery->update(['status' => 'skipped', 'last_error' => 'recipient_or_preferences_changed']);

            return;
        }
        try {
            $channel->connect();
        } catch (\Throwable $error) {
            $delivery->update(['status' => 'pending', 'last_error' => 'smtp_connect_failed']);
            throw $error;
        }
        try {
            $channel->send($delivery);
            $delivery->update(['status' => 'sent', 'sent_at' => now(), 'last_error' => null]);
        } catch (\Throwable $error) {
            // SMTP cannot provide exactly-once delivery after a lost acknowledgement.
            // Quarantine rather than risk automatically resending an accepted message.
            $delivery->update(['status' => 'uncertain', 'last_error' => 'smtp_result_uncertain']);
            report($error);
            Log::warning('Activity email requires delivery review', ['delivery_id' => $delivery->id]);
        }
    }

    public function failed(?\Throwable $error): void
    {
        ActivityEmailDelivery::whereKey($this->deliveryId)->where('status', 'pending')
            ->update(['status' => 'failed', 'last_error' => 'smtp_connect_retries_exhausted']);
    }
}
