<?php

namespace App\Models;

class ActivityEmailDelivery extends Record
{
    protected $attributes = ['status' => 'pending', 'attempts' => 0];

    protected function casts(): array
    {
        return ['queued_at' => 'datetime', 'sent_at' => 'datetime', 'attempts' => 'integer'];
    }
}
