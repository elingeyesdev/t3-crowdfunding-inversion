<?php

$directories = [
    base_path('backend/uploads/kyc'),
    public_path('uploads/kyc'),
    storage_path('app/public/kyc'),
    storage_path('app/public/uploads/kyc'),
];

// Local checkouts can retain uploads from before the move into web/.
if (basename(base_path()) === 'web') {
    $directories[] = dirname(base_path()).'/backend/uploads/kyc';
    $directories[] = dirname(base_path()).'/public/uploads/kyc';
}

return ['kyc_directories' => $directories];
