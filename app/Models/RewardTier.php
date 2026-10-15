<?php

namespace App\Models;

class RewardTier extends Record
{
    protected function casts(): array
    {
        return ['amount' => 'float', 'min_percentage' => 'float', 'max_percentage' => 'float', 'is_active' => 'boolean', 'includes_shipping' => 'boolean', 'items' => 'array', 'max_claims' => 'integer', 'current_claims' => 'integer'];
    }

    public function campaign()
    {
        return $this->belongsTo(Campaign::class);
    }
}
