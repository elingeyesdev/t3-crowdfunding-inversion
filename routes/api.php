<?php

use App\Http\Controllers\AdminController;
use App\Http\Controllers\AiController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CampaignController;
use App\Http\Controllers\ChatController;
use App\Http\Controllers\CommunityController;
use App\Http\Controllers\FileController;
use App\Http\Controllers\InvestmentController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\RewardController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Route;

Route::post('users/register', [AuthController::class, 'register'])->middleware('throttle:10,1');
Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
Route::get('categories', [CampaignController::class, 'categories']);
Route::get('campaigns/public', [CampaignController::class, 'publicIndex']);
Route::get('campaigns/public/updates/recent', [CampaignController::class, 'stories']);
Route::get('campaigns/public/{campaign}', [CampaignController::class, 'publicShow']);
Route::get('campaigns/public/{campaign}/financial-progress', [CampaignController::class, 'publicProgress']);
Route::post('campaigns/public/{campaign}/view', [CampaignController::class, 'view'])->middleware('throttle:60,1');
Route::get('campaigns/{campaign}/comments', [CommunityController::class, 'comments']);
Route::get('campaigns/{campaign}/rewards', [RewardController::class, 'index']);
Route::get('campaigns/{campaign}/funding-plan', [CampaignController::class, 'fundingPlan']);
Route::get('campaigns/{campaign}/financial-ledger', [CampaignController::class, 'financialLedger']);
Route::post('ai-support/chat', [AiController::class, 'chat'])->middleware('throttle:20,1');
Route::get('private-files/{path}', [FileController::class, 'show'])->where('path', '.*')->name('private.file')->middleware('signed');

Route::middleware(['auth:sanctum', 'active'])->group(function () {
    Route::get('auth/me', [AuthController::class, 'me']);
    Route::post('auth/logout', [AuthController::class, 'logout']);
    Route::get('users/me', [AuthController::class, 'me']);
    Route::get('users/{id}', [AuthController::class, 'show']);
    Route::post('broadcasting/auth', fn (Request $r) => Broadcast::auth($r));
    foreach (['entrepreneurs', 'investors'] as $prefix) {
        Route::prefix($prefix)->group(function () {
            Route::get('me/profile', [ProfileController::class, 'show']);
            Route::post('me/profile', [ProfileController::class, 'save']);
            Route::put('me/profile', [ProfileController::class, 'save']);
            Route::delete('me/profile', [ProfileController::class, 'destroy']);
            Route::post('me/profile/avatar', [ProfileController::class, 'image']);
            Route::post('me/profile/cover', [ProfileController::class, 'image']);
            Route::get('{id}/profile', [ProfileController::class, 'publicShow']);
        });
    }
    Route::get('entrepreneurs/me/profile/campaign-readiness', [ProfileController::class, 'readiness']);
    Route::post('entrepreneurs/me/kyc', [ProfileController::class, 'kyc']);
    Route::get('investors/me/capital', [ProfileController::class, 'capital']);
    Route::post('investors/me/capital/add', [ProfileController::class, 'addCapital']);
    Route::prefix('entrepreneurs/me')->middleware('roles:entrepreneur')->group(function () {
        Route::get('finances/summary', [CampaignController::class, 'summary']);
        Route::get('campaigns', [CampaignController::class, 'index']);
        Route::post('campaigns', [CampaignController::class, 'save']);
        Route::get('campaigns/{campaign}', [CampaignController::class, 'show']);
        Route::patch('campaigns/{campaign}', [CampaignController::class, 'save']);
        Route::delete('campaigns/{campaign}', [CampaignController::class, 'destroy']);
        Route::post('campaigns/{campaign}/submit-for-review', [CampaignController::class, 'transition']);
        Route::post('campaigns/{campaign}/publish', [CampaignController::class, 'transition']);
        Route::post('campaigns/{campaign}/finalize', [CampaignController::class, 'finalize']);
        Route::post('campaigns/{campaign}/cover', [CampaignController::class, 'cover']);
        Route::get('campaigns/{campaign}/history', [CampaignController::class, 'history']);
        Route::get('campaigns/{campaign}/financial-progress', [CampaignController::class, 'progress']);
        Route::get('campaigns/{campaign}/investors', [CampaignController::class, 'investors']);
        Route::get('campaigns/{campaign}/documents', [CampaignController::class, 'documents']);
        Route::post('campaigns/{campaign}/documents', [CampaignController::class, 'uploadDocument']);
        Route::delete('campaigns/{campaign}/documents/{document}', [CampaignController::class, 'deleteDocument']);
        Route::post('campaigns/{campaign}/updates', [CampaignController::class, 'update']);
        Route::get('campaigns/{campaign}/funding-plan', [CampaignController::class, 'fundingPlan']);
        Route::put('campaigns/{campaign}/funding-plan', [CampaignController::class, 'saveFundingPlan']);
        Route::post('campaigns/{campaign}/funding-plan', [CampaignController::class, 'addFundingPlanItem']);
        Route::delete('campaigns/{campaign}/funding-plan/{item}', [CampaignController::class, 'deleteFundingPlanItem']);
        Route::get('campaigns/{campaign}/financial-ledger', [CampaignController::class, 'financialLedger']);
        Route::get('campaigns/{campaign}/financial-movements', [CampaignController::class, 'financialMovements']);
        Route::post('campaigns/{campaign}/financial-movements', [CampaignController::class, 'addFinancialMovement']);
        Route::patch('campaigns/{campaign}/financial-movements/{movement}', [CampaignController::class, 'updateFinancialMovement']);
        Route::delete('campaigns/{campaign}/financial-movements/{movement}', [CampaignController::class, 'deleteFinancialMovement']);
        Route::post('campaigns/{campaign}/financial-movements/{movement}/receipt', [CampaignController::class, 'uploadMovementReceipt']);
    });
    Route::prefix('investments')->middleware('roles:investor')->group(function () {
        Route::get('me', [InvestmentController::class, 'index']);
        Route::post('/', [InvestmentController::class, 'store']);
        Route::get('{investment}/receipt', [InvestmentController::class, 'receipt']);
    });
    Route::post('campaigns/{campaign}/comments', [CommunityController::class, 'postComment'])->middleware('roles:investor,entrepreneur');
    Route::post('campaigns/{campaign}/comments/{comment}/like', [CommunityController::class, 'like'])->middleware('roles:investor,entrepreneur');
    Route::prefix('campaigns/{campaign}/rewards')->group(function () {
        Route::get('all', [RewardController::class, 'index']);
        Route::post('/', [RewardController::class, 'save']);
        Route::get('claims', [RewardController::class, 'claims']);
        Route::patch('claims/{claim}', [RewardController::class, 'updateClaim']);
        Route::patch('{reward}', [RewardController::class, 'save']);
        Route::delete('{reward}', [RewardController::class, 'destroy']);
    });
    foreach (['campaigns', 'campanas'] as $prefix) {
        Route::get($prefix.'/{campaign}/analytics', [CampaignController::class, 'analytics']);
        Route::get($prefix.'/{campaign}/analiticas', [CampaignController::class, 'analytics']);
        Route::get($prefix.'/{campaign}/report', [InvestmentController::class, 'report']);
        Route::get($prefix.'/{campaign}/reporte', [InvestmentController::class, 'report']);
    }
    Route::get('notifications/me', [CommunityController::class, 'notifications']);
    Route::patch('notifications/read-all', [CommunityController::class, 'readAll']);
    Route::patch('notifications/{notification}/read', [CommunityController::class, 'read']);
    Route::get('chat/conversations', [ChatController::class, 'index']);
    Route::post('chat/conversations', [ChatController::class, 'store']);
    Route::get('chat/conversations/{conversation}/messages', [ChatController::class, 'messages']);
    Route::post('chat/conversations/{conversation}/messages', [ChatController::class, 'send']);
    Route::post('chat/conversations/{conversation}/read', [ChatController::class, 'read']);
    Route::post('ai-campaign/chat', [AiController::class, 'chat'])->middleware('throttle:20,1');
    Route::prefix('admin')->middleware('roles:admin,super_admin')->group(function () {
        Route::get('dashboard-stats', [AdminController::class, 'stats']);
        Route::get('users', [AdminController::class, 'users']);
        Route::delete('users/{user}', [AdminController::class, 'deleteUser']);
        Route::get('campaigns', [AdminController::class, 'campaigns']);
        Route::get('campaigns/pending', [AdminController::class, 'pending']);
        Route::get('campaigns/{campaign}', [AdminController::class, 'campaign']);
        Route::patch('campaigns/{campaign}/status', [AdminController::class, 'status']);
        Route::delete('campaigns/{campaign}', [CampaignController::class, 'destroy']);
        Route::get('campaigns/{campaign}/history', [CampaignController::class, 'history']);
        Route::get('campaigns/{campaign}/financial-progress', [CampaignController::class, 'progress']);
        Route::get('campaigns/{campaign}/investors', [CampaignController::class, 'investors']);
        Route::get('campaigns/{campaign}/rewards/claims', [RewardController::class, 'claims']);
        Route::get('campaigns/{campaign}/documents', [CampaignController::class, 'documents']);
        Route::patch('campaigns/{campaign}/documents/{document}/review', [AdminController::class, 'reviewDocument']);
        Route::get('kyc/pending', [AdminController::class, 'kyc']);
        Route::post('kyc/{profile}/review', [AdminController::class, 'reviewKyc']);
    });
    Route::prefix('superadmin')->middleware('roles:super_admin')->group(function () {
        Route::get('admins',[AdminController::class, 'admins']);
        Route::post('admins',[AdminController::class, 'createAdmin']);
        Route::delete('admins/{admin}',[AdminController::class, 'deleteAdmin']);
    });
});
