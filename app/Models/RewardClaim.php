<?php

namespace App\Models;

class RewardClaim extends Record
{
    public function investment()
    {
        return $this->belongsTo(Investment::class);
    }
}
