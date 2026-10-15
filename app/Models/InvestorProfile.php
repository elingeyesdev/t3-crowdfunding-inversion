<?php

namespace App\Models;

class InvestorProfile extends Record
{
    protected function casts(): array
    {
        return ['identity_verified' => 'boolean', 'accredited' => 'boolean', 'preferred_categories' => 'array', 'verification_documents' => 'array', 'metadata' => 'array', 'min_investment' => 'float', 'max_investment' => 'float', 'total_invested' => 'float', 'total_investments' => 'integer'];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
