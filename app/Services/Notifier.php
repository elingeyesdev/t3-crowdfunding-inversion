<?php

namespace App\Services;

use App\Models\Notification;

class Notifier
{
    public function send(string $userId, string $code, string $title, string $body, ?string $campaignId = null): void
    {
        Notification::create(['user_id' => $userId, 'type_code' => $code, 'title' => $title, 'body' => $body, 'action_url' => $campaignId ? '/campaign/'.$campaignId : null, 'reference_type' => $campaignId ? 'campaign' : null, 'reference_id' => $campaignId, 'data' => []]);
    }
}
