<?php

namespace App\Models;

class Message extends Record
{
    protected function casts(): array
    {
        return ['is_edited' => 'boolean'];
    }

    public function sender()
    {
        return $this->belongsTo(User::class, 'sender_id');
    }
}
