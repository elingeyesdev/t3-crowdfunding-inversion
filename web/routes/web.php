<?php

use App\Http\Controllers\AuthController;
use Illuminate\Support\Facades\Route;

Route::get('/api/v1/auth/google', [AuthController::class, 'google']);
Route::get('/api/v1/auth/google/callback', [AuthController::class, 'googleCallback']);
Route::view('/{path?}', 'app')->where('path', '^(?!api(?:/|$)|storage(?:/|$)|uploads(?:/|$)|build(?:/|$)).*');
