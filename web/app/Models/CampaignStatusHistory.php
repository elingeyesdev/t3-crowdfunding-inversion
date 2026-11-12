<?php

namespace App\Models;

class CampaignStatusHistory extends Record
{
    protected $table = 'campaign_status_history';

    public function actor()
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
