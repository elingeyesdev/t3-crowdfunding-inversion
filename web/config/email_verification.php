<?php

return [
    'connection' => env('EMAIL_VERIFICATION_QUEUE_CONNECTION', 'database'),
    'queue' => 'email-verification',
    'expire' => 60,
];
