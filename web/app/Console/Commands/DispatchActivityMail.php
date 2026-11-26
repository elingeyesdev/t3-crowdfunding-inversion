<?php

namespace App\Console\Commands;

use App\Models\ActivityEmailDelivery;
use App\Services\ActivityMailOutbox;
use Illuminate\Console\Command;

class DispatchActivityMail extends Command
{
    protected $signature = 'notifications:dispatch-mail {--retry-failed : Retry safe connection failures} {--limit=100}';

    protected $description = 'Dispatch pending activity emails and quarantine interrupted SMTP attempts';

    public function handle(ActivityMailOutbox $outbox): int
    {
        ActivityEmailDelivery::where('status', 'sending')->where('updated_at', '<', now()->subMinutes(2))
            ->update(['status' => 'uncertain', 'last_error' => 'interrupted_delivery']);
        if ($this->option('retry-failed')) {
            ActivityEmailDelivery::where('status', 'failed')->update(['status' => 'pending', 'queued_at' => null]);
        }
        $rows = ActivityEmailDelivery::where('status', 'pending')
            ->where(fn ($q) => $q->whereNull('queued_at')->orWhere('queued_at', '<', now()->subMinutes(10)))
            ->oldest()->limit(max(1, min(1000, (int) $this->option('limit'))))->get();
        foreach ($rows as $delivery) {
            $outbox->dispatch($delivery);
        }
        $this->info('Pending deliveries processed: '.$rows->count());

        return self::SUCCESS;
    }
}
