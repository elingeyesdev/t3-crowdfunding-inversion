<?php

namespace App\Models;

use LogicException;

class CampaignFinancialMovementHistory extends Record
{
    protected $table = 'campaign_financial_movement_history';

    public $timestamps = false;

    protected function casts(): array
    {
        return ['before' => 'array', 'after' => 'array', 'created_at' => 'datetime', 'version' => 'integer'];
    }

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('El historial financiero no se puede modificar.'));
        static::deleting(fn () => throw new LogicException('El historial financiero no se puede eliminar.'));
    }

    public function actor()
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
