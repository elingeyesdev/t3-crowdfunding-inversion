<?php

namespace App\Models;

class Conversation extends Record
{
    public function messages()
    {
        return $this->hasMany(Message::class);
    }

    public function campaign()
    {
        return $this->belongsTo(Campaign::class);
    }

    public function contains(string $userId): bool
    {
        return in_array($userId, [$this->user_one_id, $this->user_two_id], true);
    }
}
