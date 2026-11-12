<?php

namespace App\Models;

class CampaignUpdate extends Record
{
    protected function casts(): array
    {
        return ['attachments' => 'array', 'is_public' => 'boolean'];
    }

    public function campaign()
    {
        return $this->belongsTo(Campaign::class);
    }

    public function milestone()
    {
        return $this->belongsTo(CampaignMilestone::class, 'milestone_id');
    }

    public function author()
    {
        return $this->belongsTo(User::class, 'author_id');
    }
}
