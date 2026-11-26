<?php

namespace App\Services;

use App\Jobs\SendActivityEmail;
use App\Models\ActivityEmailDelivery;
use Illuminate\Support\Facades\Bus;

class ActivityMailOutbox
{
    public function dispatch(ActivityEmailDelivery $delivery): void
    {
        if ($delivery->status !== 'pending') {
            return;
        }
        try {
            Bus::dispatch((new SendActivityEmail($delivery->id))
                ->onConnection(config('activity_mail.connection'))->onQueue(config('activity_mail.queue')));
            ActivityEmailDelivery::whereKey($delivery->id)->where('status', 'pending')->update(['queued_at' => now(), 'last_error' => null]);
        } catch (\Throwable $error) {
            // The business operation has already committed. The scheduler recovers this row.
            $delivery->update(['last_error' => 'queue_unavailable']);
            report($error);
        }
    }
}
