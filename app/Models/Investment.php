<?php

namespace App\Models;

class Investment extends Record
{
    protected function casts(): array
    {
        return ['amount' => 'float', 'refunded_amount' => 'float', 'is_anonymous' => 'boolean'];
    }

    public function campaign()
    {
        return $this->belongsTo(Campaign::class);
    }

    public function investor()
    {
        return $this->belongsTo(User::class, 'investor_id');
    }

    public function reward()
    {
        return $this->belongsTo(RewardTier::class, 'reward_tier_id');
    }
}
