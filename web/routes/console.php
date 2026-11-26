<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Schedule::command('notifications:dispatch-mail')->everyMinute()->withoutOverlapping();
Schedule::command('campaigns:close-expired')->everyMinute()->withoutOverlapping(5)
    ->when(fn () => config('campaign_closure.enabled'));

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');
