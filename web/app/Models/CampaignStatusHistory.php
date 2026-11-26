<?php

namespace App\Models;

class CampaignStatusHistory extends Record
{
    public const AUTOMATIC_CLOSURE_REASON = 'Cierre automático por fecha de vencimiento';

    public function isAutomaticClosure(): bool
    {
        return $this->changed_by === null && $this->reason === self::AUTOMATIC_CLOSURE_REASON;
    }

    protected $table = 'campaign_status_history';

    public function actor()
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
