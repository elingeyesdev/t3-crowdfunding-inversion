<?php

namespace App\Models;

use LogicException;

class UserStatusHistory extends Record
{
    protected $table = 'user_status_history';

    public $timestamps = false;

    protected function casts(): array
    {
        return ['from_active' => 'boolean', 'to_active' => 'boolean', 'version' => 'integer', 'created_at' => 'datetime'];
    }

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('El historial de estado no se puede modificar.'));
        static::deleting(fn () => throw new LogicException('El historial de estado no se puede eliminar.'));
    }

    public function actor()
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
