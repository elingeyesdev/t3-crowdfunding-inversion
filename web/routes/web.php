<?php

use App\Http\Controllers\AuthController;
use Illuminate\Support\Facades\Route;

Route::any('/uploads/kyc/{path?}', fn () => abort(403))->where('path', '.*');
Route::any('/storage/kyc/{path?}', fn () => abort(403))->where('path', '.*');
Route::any('/storage/uploads/kyc/{path?}', fn () => abort(403))->where('path', '.*');

Route::get('/api/v1/auth/google', [AuthController::class, 'google']);
Route::get('/api/v1/auth/google/callback', [AuthController::class, 'googleCallback']);
Route::get('/auth/callback', fn () => response()->view('app')->header('Referrer-Policy', 'no-referrer')->header('Cache-Control', 'no-store'));
Route::get('/reset-password', fn () => response()->view('app')->header('Referrer-Policy', 'no-referrer')->header('Cache-Control', 'no-store'));
Route::get('/verify-email', fn () => response()->view('app')->header('Referrer-Policy', 'no-referrer')->header('Cache-Control', 'no-store'));
Route::view('/{path?}', 'app')->where('path', '^(?!api(?:/|$)|storage(?:/|$)|uploads(?:/|$)|build(?:/|$)).*');
