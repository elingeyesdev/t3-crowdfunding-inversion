<?php

namespace App\Models;

class NotificationType extends Record
{
    protected $table = 'notification_types';

    public function notifications()
    {
        return $this->hasMany(Notification::class, 'type_id');
    }
}
