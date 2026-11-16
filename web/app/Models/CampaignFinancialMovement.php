<?php

namespace App\Models;

use Illuminate\Database\Eloquent\SoftDeletes;

class CampaignFinancialMovement extends Record
{
    use SoftDeletes;

    protected $table = 'campaign_financial_movements';

    protected function casts(): array
    {
        return [
            'amount' => 'float',
            'movement_date' => 'date:Y-m-d',
            'reviewed_at' => 'datetime',
            'version' => 'integer',
            'has_been_reviewed' => 'boolean',
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

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function history()
    {
        return $this->hasMany(CampaignFinancialMovementHistory::class, 'movement_id')->orderBy('version');
    }

    public function hasReview(): bool
    {
        return $this->has_been_reviewed || $this->reviewed_at !== null || $this->reviewed_by !== null || $this->review_notes !== null || in_array($this->status, ['verified', 'audited', 'flagged', 'rejected'], true);
    }

    public function scopeIncome($query)
    {
        return $query->where('type', 'income');
    }

    public function scopeExpense($query)
    {
        return $query->where('type', 'expense');
    }

    public function scopePendingReview($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopeVerified($query)
    {
        return $query->where('status', 'verified');
    }

    public function scopeFlagged($query)
    {
        return $query->where('status', 'flagged');
    }

    public function scopeRejected($query)
    {
        return $query->where('status', 'rejected');
    }

    public function scopeWithReceipt($query)
    {
        return $query->whereNotNull('receipt_url')->where('receipt_url', '!=', '');
    }

    public function scopeWithoutReceipt($query)
    {
        return $query->where(function ($q) {
            $q->whereNull('receipt_url')->orWhere('receipt_url', '');
        });
    }
}
