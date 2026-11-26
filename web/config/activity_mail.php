<?php

return [
    'enabled' => env('ACTIVITY_MAIL_ENABLED', true),
    'connection' => env('ACTIVITY_MAIL_QUEUE_CONNECTION', 'database'),
    'queue' => 'activity-mail',
];
