<?php

namespace App\Models;

class RewardClaim extends Record
{
    protected function casts(): array
    {
        return ['shipped_at' => 'datetime', 'delivered_at' => 'datetime'];
    }

    public function investment()
    {
        return $this->belongsTo(Investment::class);
    }

    public function allowedStatuses(): array
    {
        if ($this->investment->status !== 'completed' || $this->investment->refunded_amount > 0) {
            return [];
        }

        return match ($this->status) {
            'pending' => ['processing', 'cancelled'],
            'processing' => ['shipped', 'cancelled'],
            'shipped' => ['delivered', 'cancelled'],
            default => [],
        };
    }
}
