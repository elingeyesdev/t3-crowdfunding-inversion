<?php

use App\Models\Campaign;
use App\Services\InvestmentEngine;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Database\ConcurrencyErrorDetector;
use Illuminate\Database\QueryException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

// Isolated concurrency fixture. It cannot select the application's real database.
require dirname(__DIR__, 2).'/vendor/autoload.php';

$database = realpath($argv[1] ?? '');
$barrier = $argv[2] ?? '';
$mode = $argv[4] ?? '';
if (! $database || realpath(dirname($database)) !== realpath(sys_get_temp_dir())
    || ! str_starts_with(basename($database), 'campaign-close-') || $barrier !== $database.'.start'
    || ! in_array($mode, ['auto', 'manual'], true)) {
    fwrite(STDERR, 'Invalid isolated test fixture.');
    exit(2);
}
$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
config(['database.default' => 'sqlite', 'database.connections.sqlite.url' => null,
    'database.connections.sqlite.database' => $database, 'database.connections.sqlite.busy_timeout' => 5000,
    'mail.default' => 'array', 'activity_mail.enabled' => false, 'queue.default' => 'sync',
    'cache.default' => 'array', 'logging.default' => 'null']);
DB::purge('sqlite');
Carbon::setTestNow(Carbon::parse('2026-11-25T16:00:00Z'));
DB::connection()->getPdo();
$paused = false;
DB::listen(function ($query) use (&$paused) {
    if (! $paused && DB::transactionLevel() > 0 && str_contains($query->sql, 'select * from "campaigns"')) {
        $paused = true;
        // Give the other independent process time to attempt the same closure.
        usleep(200000);
    }
});
echo "ready\n";
flush();
$deadline = microtime(true) + 15;
while (! is_file($barrier) && microtime(true) < $deadline) {
    clearstatcache();
    usleep(10000);
}
if (! is_file($barrier)) {
    exit(3);
}
$retryableFailure = false;
Log::listen(function ($event) use (&$retryableFailure) {
    $error = $event->context['exception'] ?? null;
    if ($error instanceof QueryException
        && (new ConcurrencyErrorDetector)->causedByConcurrencyError($error)) {
        $retryableFailure = true;
    }
});
try {
    if ($mode === 'auto') {
        $exitCode = Artisan::call('campaigns:close-expired');
        echo Artisan::output();
        if ($exitCode && $retryableFailure) {
            echo "retryable_sqlite_lock\n";
            exit(75);
        }
        exit($exitCode);
    }
    $campaign = Campaign::findOrFail($argv[3]);
    $app->make(InvestmentEngine::class)->finalize($campaign, $argv[5]);
} catch (HttpExceptionInterface $error) {
    // An automatic winner leaves the manual route's existing 422 response.
    if ($error->getStatusCode() !== 422) {
        throw $error;
    }
} catch (QueryException $error) {
    if (! (new ConcurrencyErrorDetector)->causedByConcurrencyError($error)) {
        throw $error;
    }
    echo "retryable_sqlite_lock\n";
    exit(75);
}
echo "done\n";
