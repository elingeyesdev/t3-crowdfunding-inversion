<?php

namespace App\Models;

class AdminProfile extends Record
{
    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
