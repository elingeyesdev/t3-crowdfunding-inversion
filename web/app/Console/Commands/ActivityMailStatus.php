<?php

namespace App\Console\Commands;

use App\Models\ActivityEmailDelivery;
use Illuminate\Console\Command;

class ActivityMailStatus extends Command
{
    protected $signature = 'notifications:mail-status {--status=} {--limit=50}';

    protected $description = 'Inspect activity email deliveries without exposing recipients or message contents';

    public function handle(): int
    {
        $status = $this->option('status');
        if ($status && ! in_array($status, ['pending', 'sending', 'sent', 'skipped', 'failed', 'uncertain'], true)) {
            $this->error('Invalid delivery status.');

            return self::FAILURE;
        }
        $rows = ActivityEmailDelivery::query()->when($status, fn ($q) => $q->where('status', $status))
            ->latest()->limit(max(1, min(1000, (int) $this->option('limit'))))
            ->get(['id', 'type_code', 'status', 'attempts', 'sent_at', 'last_error']);
        $this->table(['ID', 'Event', 'Status', 'Attempts', 'SMTP accepted at', 'Last result'], $rows->toArray());

        return self::SUCCESS;
    }
}
