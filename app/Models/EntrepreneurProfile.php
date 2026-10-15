<?php

namespace App\Models;

class EntrepreneurProfile extends Record
{
    protected function casts(): array
    {
        return ['identity_verified' => 'boolean', 'verification_documents' => 'array', 'total_raised' => 'float', 'total_campaigns' => 'integer', 'rating' => 'float'];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
