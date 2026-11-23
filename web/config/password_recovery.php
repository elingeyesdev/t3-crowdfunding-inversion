<?php

return [
    // Must be an asynchronous connection. Run a worker for this queue.
    'connection' => env('PASSWORD_RESET_QUEUE_CONNECTION', 'database'),
    'queue' => 'password-recovery',
];
