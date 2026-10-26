<?php

namespace App\Models;

class CampaignFinancialMovement extends Record
{
    protected $table = 'campaign_financial_movements';

    protected function casts(): array
    {
        return [
            'amount' => 'float',
            'movement_date' => 'date:Y-m-d',
        ];
    }

    public function campaign()
    {
        return $this->belongsTo(Campaign::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function scopeIncome($query)
    {
        return $query->where('type', 'income');
    }

    public function scopeExpense($query)
    {
        return $query->where('type', 'expense');
    }
}
