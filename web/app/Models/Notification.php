<?php

namespace App\Models;

class Notification extends Record
{
    protected function casts(): array
    {
        return [
            'is_read' => 'boolean',
            'read_at' => 'datetime',
            'data' => 'array',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function type()
    {
        return $this->belongsTo(NotificationType::class, 'type_id');
    }

    public function campaign()
    {
        return $this->belongsTo(Campaign::class, 'reference_id');
    }

    public function scopeUnread($query)
    {
        return $query->where('is_read', false);
    }

    public function scopeRead($query)
    {
        return $query->where('is_read', true);
    }

    public function scopeForUser($query, string $userId)
    {
        return $query->where('user_id', $userId);
    }

    public function scopeForType($query, string $typeCode)
    {
        return $query->where('type_code', $typeCode);
    }
}
