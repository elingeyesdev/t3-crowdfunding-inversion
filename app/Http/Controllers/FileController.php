<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Storage;

class FileController extends Controller
{
    public function show(string $path)
    {
        abort_if(str_contains($path, '..') || str_contains($path, '\\') || ! preg_match('#^(kyc|documents)/[a-zA-Z0-9._-]+$#', $path), 404);
        abort_unless(Storage::disk('local')->exists($path), 404);

        return response()->file(Storage::disk('local')->path($path), ['Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff']);
    }
}
