<?php

namespace App\Models;

class CampaignFundingPlan extends Record
{
    protected $table = 'campaign_funding_plans';

    protected function casts(): array
    {
        return [
            'amount' => 'float',
            'percentage' => 'float',
            'sort_order' => 'integer',
        ];
    }

    public function campaign()
    {
        return $this->belongsTo(Campaign::class);
    }
}
