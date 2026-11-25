<?php

// Private CLI/server harness. It is never registered in application routes.
declare(strict_types=1);

$runtime = realpath((string) getenv('UFM_E2E_RUNTIME'));
$base = dirname(__DIR__, 2);
$workspaceTmp = realpath(dirname($base).'/tmp');
if (!$runtime || !$workspaceTmp || !str_starts_with(str_replace('\\', '/', $runtime).'/', str_replace('\\', '/', $workspaceTmp).'/') || !is_file($runtime.'/e2e-only')) {
    throw new RuntimeException('Playwright requires a marked runtime inside workspace tmp.');
}
foreach ([
    'APP_ENV' => 'testing', 'APP_DEBUG' => 'false', 'APP_KEY' => getenv('UFM_E2E_KEY'),
    'APP_URL' => getenv('UFM_E2E_URL'), 'DB_CONNECTION' => 'sqlite',
    'DB_DATABASE' => $runtime.'/runtime.sqlite', 'DB_URL' => '',
    'APP_CONFIG_CACHE' => $runtime.'/config.php', 'APP_ROUTES_CACHE' => $runtime.'/routes.php',
    'APP_EVENTS_CACHE' => $runtime.'/events.php', 'APP_PACKAGES_CACHE' => $runtime.'/packages.php',
    'APP_SERVICES_CACHE' => $runtime.'/services.php', 'VIEW_COMPILED_PATH' => $runtime.'/views',
    'CACHE_STORE' => 'array', 'SESSION_DRIVER' => 'array', 'QUEUE_CONNECTION' => 'sync',
    'MAIL_MAILER' => 'array', 'BROADCAST_CONNECTION' => 'null', 'LOG_CHANNEL' => 'stderr',
    'GOOGLE_CLIENT_ID' => '', 'GOOGLE_CLIENT_SECRET' => '', 'DEEPSEEK_API_KEY' => '',
] as $name => $value) {
    putenv($name.'='.$value); $_ENV[$name] = $value; $_SERVER[$name] = $value;
}
require $base.'/vendor/autoload.php';
$app = require $base.'/bootstrap/app.php';
$app->useEnvironmentPath($runtime);
$app->loadEnvironmentFrom('.env.e2e');
$app->useStoragePath($runtime.'/storage');
$app->addAbsoluteCachePathPrefix($runtime);
return $app;
