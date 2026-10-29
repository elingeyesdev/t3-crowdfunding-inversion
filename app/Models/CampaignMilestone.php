<?php

namespace App\Models;

class CampaignMilestone extends Record
{
    protected $table = 'campaign_milestones';

    protected function casts(): array
    {
        return [
            'target_date' => 'date:Y-m-d',
            'completed_date' => 'date:Y-m-d',
            'progress_percentage' => 'integer',
            'sort_order' => 'integer',
            'evidence_urls' => 'array',
        ];
    }

    public function campaign()
    {
        return $this->belongsTo(Campaign::class);
    }

    public function updates()
    {
        return $this->hasMany(CampaignUpdate::class, 'milestone_id');
    }
}
