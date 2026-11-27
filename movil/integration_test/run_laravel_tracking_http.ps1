# Ejecuta HTTP contra Laravel sin escribir .env, bases ni caches en web/.
[CmdletBinding()]
param([switch]$ServeOnly)
$ErrorActionPreference = 'Stop'
$mobile = Split-Path -Parent $PSScriptRoot
$web = Join-Path (Split-Path -Parent $mobile) 'web'
$php = Get-Command php -ErrorAction Stop
if (-not (Test-Path -LiteralPath (Join-Path $web 'vendor/autoload.php'))) {
    throw 'Prepara primero las dependencias Laravel con composer install. Falta web/vendor/autoload.php.'
}
if (-not $ServeOnly) { Get-Command flutter -ErrorAction Stop | Out-Null }
$temp = Join-Path ([IO.Path]::GetTempPath()) ('unifundme28-http-' + [Guid]::NewGuid().ToString('N'))
$utf8 = New-Object System.Text.UTF8Encoding($false)
$previousEnv = @{}
$server = $null
Push-Location -LiteralPath $mobile
try {
    foreach ($dir in @('bootstrap/cache', 'storage/framework/cache/data', 'storage/framework/sessions', 'storage/framework/views', 'storage/logs', 'storage/fonts')) {
        New-Item -ItemType Directory -Path (Join-Path $temp $dir) -Force | Out-Null
    }
    $preflight = Join-Path $temp 'preflight.php'
    [IO.File]::WriteAllText($preflight, '<?php if (PHP_VERSION_ID < 80300) {fwrite(STDERR,"Se requiere PHP 8.3 o superior.\n");exit(1);} foreach (["bcmath","pdo_sqlite","mbstring","openssl","fileinfo","dom","xml"] as $e) {if (!extension_loaded($e)) {fwrite(STDERR,"Falta extension PHP: ".$e."\n");exit(1);}}', $utf8)
    & $php.Source $preflight
    if ($LASTEXITCODE -ne 0) { throw 'El entorno PHP requiere preparacion.' }
    Copy-Item -LiteralPath (Join-Path $web 'bootstrap/providers.php') -Destination (Join-Path $temp 'bootstrap/providers.php')
    $database = Join-Path $temp 'database.sqlite'
    [IO.File]::WriteAllBytes($database, [byte[]]@())
    $key = New-Object byte[] 32
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($key) } finally { $rng.Dispose() }
    $vars = @{
        APP_ENV = 'testing'; APP_DEBUG = 'false'; APP_KEY = ('base64:' + [Convert]::ToBase64String($key))
        DB_CONNECTION = 'sqlite'; DB_DATABASE = $database; DB_URL = ''
        CACHE_STORE = 'array'; SESSION_DRIVER = 'array'; QUEUE_CONNECTION = 'sync'
        BROADCAST_CONNECTION = 'null'; MAIL_MAILER = 'array'; LOG_CHANNEL = 'stderr'
        VIEW_COMPILED_PATH = (Join-Path $temp 'storage/framework/views')
        UNIFUNDME_HTTP_TEMP = $temp; UNIFUNDME_TRACKING_FIXTURES = 'true'
        UNIFUNDME_HTTP_BOOTSTRAP = (Join-Path $temp 'boot.php')
    }
    foreach ($entry in @{APP_CONFIG_CACHE='config.php'; APP_PACKAGES_CACHE='packages.php'; APP_SERVICES_CACHE='services.php'; APP_ROUTES_CACHE='routes.php'; APP_EVENTS_CACHE='events.php'}.GetEnumerator()) {
        $vars[$entry.Key] = Join-Path $temp ('bootstrap/cache/' + $entry.Value)
    }
    foreach ($name in $vars.Keys) {
        $previousEnv[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
        [Environment]::SetEnvironmentVariable($name, [string]$vars[$name], 'Process')
    }
    # Literales PHP entre comillas simples; admitir espacios y apostrofes en rutas Windows.
    $vendorPath = (Join-Path $web 'vendor/autoload.php').Replace('\','/').Replace("'", "\'")
    $appPath = (Join-Path $web 'bootstrap/app.php').Replace('\','/').Replace("'", "\'")
    $tempPhp = $temp.Replace('\','/').Replace("'", "\'")
    $bootCode = @'
<?php
require '__VENDOR__';
$app = require '__APP__';
$temp = '__TEMP__';
if (preg_match('/^[A-Za-z]:\//', $temp)) $app->addAbsoluteCachePathPrefix(substr($temp, 0, 3));
$app->useEnvironmentPath($temp);
$app->useStoragePath($temp.'/storage');
$app->useBootstrapPath($temp.'/bootstrap');
return $app;
'@
    $bootCode = $bootCode.Replace('__VENDOR__', $vendorPath).Replace('__APP__', $appPath).Replace('__TEMP__', $tempPhp)
    $boot = Join-Path $temp 'boot.php'
    $console = Join-Path $temp 'console.php'
    $router = Join-Path $temp 'router.php'
    [IO.File]::WriteAllText($boot, $bootCode, $utf8)
    [IO.File]::WriteAllText($console, '<?php $app=require __DIR__."/boot.php";exit($app->handleCommand(new Symfony\Component\Console\Input\ArgvInput()));', $utf8)
    [IO.File]::WriteAllText($router, '<?php $app=require __DIR__."/boot.php";$app->handleRequest(Illuminate\Http\Request::capture());', $utf8)
    & $php.Source $console migrate --seed --force --no-interaction
    if ($LASTEXITCODE -ne 0) { throw 'Fallo la preparacion de la base temporal.' }
    & $php.Source (Join-Path $PSScriptRoot 'fixtures_tracking.php')
    if ($LASTEXITCODE -ne 0) { throw 'Fallo la preparacion de fixtures aisladas.' }
    $listener = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback, 0)
    $listener.Start()
    try { $port = $listener.LocalEndpoint.Port } finally { $listener.Stop() }
    $server = Start-Process -FilePath $php.Source -ArgumentList @('-S', "127.0.0.1:$port", ('"' + $router + '"')) -WorkingDirectory $web -PassThru -NoNewWindow -RedirectStandardOutput (Join-Path $temp 'server-out.log') -RedirectStandardError (Join-Path $temp 'server-error.log')
    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        if ($server.HasExited) { throw 'El servidor temporal no pudo iniciarse.' }
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$port/up" -TimeoutSec 2
            if ($response.StatusCode -eq 200) { $ready = $true; break }
        } catch { Start-Sleep -Milliseconds 200 }
    }
    if (-not $ready) { throw 'El servidor temporal no respondio.' }
    $url = "http://127.0.0.1:$port/api/v1"
    if ($ServeOnly) {
        Write-Host "API temporal: $url"
        Write-Host "Donante: tracking28-donor@example.test | Clave exclusiva de prueba: SyntheticOnly28"
        Write-Host "Otro donante: tracking28-other@example.test | Misma clave de prueba."
        Write-Host "En otra terminal, desde movil/:"
        Write-Host "adb reverse tcp:$port tcp:$port"
        Write-Host "flutter run --dart-define=APP_ENV=development --dart-define=API_BASE_URL=$url"
        Read-Host 'Pulsa Enter al terminar para detener el servidor y limpiar sus datos' | Out-Null
    } else {
        & flutter test test/integration/laravel_tracking_http_test.dart --no-pub "--dart-define=UNIFUNDME_TEST_API_URL=$url" --dart-define=UNIFUNDME_ISOLATED_TEST=true --dart-define=UNIFUNDME_TRACKING_FIXTURES=true
        if ($LASTEXITCODE -ne 0) { throw 'Fallo la integracion HTTP del issue 28.' }
        Write-Host 'Integracion HTTP del seguimiento validada.'
    }
} finally {
    if ($null -ne $server) {
        if (-not $server.HasExited) { Stop-Process -Id $server.Id -Force }
        $server.WaitForExit()
        $server.Dispose()
    }
    foreach ($name in $previousEnv.Keys) { [Environment]::SetEnvironmentVariable($name, $previousEnv[$name], 'Process') }
    Pop-Location
    if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Recurse -Force }
}
