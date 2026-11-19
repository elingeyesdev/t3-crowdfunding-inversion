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
}
