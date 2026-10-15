<?php

namespace App\Models;

class Notification extends Record
{
    protected function casts(): array
    {
        return ['is_read' => 'boolean', 'data' => 'array'];
    }
}
