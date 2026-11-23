<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('password-recovery', function (Request $request) {
            $email = $request->input('email');
            $key = is_string($email) ? strtolower(trim($email)) : 'invalid';

            return [
                Limit::perMinute(5)->by('password-recovery-ip:'.$request->ip()),
                Limit::perMinute(1)->by('password-recovery-email:'.hash('sha256', $key)),
            ];
        });
        require base_path('routes/channels.php');
    }
}
