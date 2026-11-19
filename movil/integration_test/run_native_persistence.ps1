# Compatible con Windows PowerShell 5.1. Solo emulator-5554 / UniFundMe_Fase3_Test.
[CmdletBinding()]
param(
    [ValidateSet('Run', 'Resume', 'Cleanup')][string]$Mode = 'Run',
    [string]$RunDirectory,
    [string]$AdbPath,
    [ValidateRange(5, 120)][int]$StageTimeoutSeconds = 45
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$serial = 'emulator-5554'
$avd = 'UniFundMe_Fase3_Test'
$package = 'com.unifoundme.movil'
$component = 'com.unifoundme.movil/.MainActivity'
$statusPath = 'files/unifundme_fase3_probe/status.json'
$project = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$artifactRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '.native_persistence_runs'))
$record = $null
$ownedInstallation = $false
$passed = $false

if (-not $AdbPath) {
    if (-not $env:ANDROID_HOME) { throw 'Define ANDROID_HOME o pasa -AdbPath.' }
    $AdbPath = Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'
}
if (-not (Test-Path -LiteralPath $AdbPath -PathType Leaf)) { throw 'No se encuentra adb.exe.' }

function Invoke-ProbeAdb {
    param([string[]]$AdbArguments, [switch]$AllowFailure)
    $savedPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $output = & $AdbPath -s $serial @AdbArguments 2>&1
        $code = $LASTEXITCODE
    } finally { $ErrorActionPreference = $savedPreference }
    $result = [pscustomobject]@{ Code = $code; Text = (($output | Out-String).Trim()) }
    if ($code -ne 0 -and -not $AllowFailure) {
        throw ('ADB no pudo completar la operación: ' + $AdbArguments[0])
    }
    return $result
}

function Assert-ProbeEmulator {
    if ((Invoke-ProbeAdb -AdbArguments @('get-state')).Text -ne 'device') {
        throw 'El emulador no está disponible.'
    }
    $name = ((Invoke-ProbeAdb -AdbArguments @('emu', 'avd', 'name')).Text -split '\r?\n')[0].Trim()
    if ($name -ne $avd) { throw 'El AVD no coincide. No se permite otro dispositivo.' }
    if ((Invoke-ProbeAdb -AdbArguments @('shell', 'getprop', 'sys.boot_completed')).Text -ne '1') {
        throw 'El AVD todavía no terminó de arrancar.'
    }
    if ((Invoke-ProbeAdb -AdbArguments @('shell', 'am', 'get-current-user')).Text -ne '0') {
        throw 'La sonda requiere el usuario Android 0 del AVD aislado.'
    }
    if ((Invoke-ProbeAdb -AdbArguments @('shell', 'getprop', 'ro.build.version.sdk')).Text -ne '36' -or
        (Invoke-ProbeAdb -AdbArguments @('shell', 'getprop', 'ro.product.cpu.abi')).Text -ne 'x86_64') {
        throw 'No coincide Android 16/API 36/x86_64.'
    }
}

function Save-ProbeRecord {
    $record | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $RunDirectory 'run.json') -Encoding UTF8
}

function Get-ProbePid {
    $answer = Invoke-ProbeAdb -AdbArguments @('shell', 'pidof', $package) -AllowFailure
    if ($answer.Code -eq 1 -and -not $answer.Text) { return '' }
    if ($answer.Code -ne 0) { throw 'No se pudo comprobar el proceso Android.' }
    if ($answer.Text -and $answer.Text -notmatch '^\d+$') { throw 'PID inesperado o varios procesos; prueba detenida.' }
    return $answer.Text
}

function Stop-ProbeProcess {
    Assert-ProbeEmulator
    Invoke-ProbeAdb -AdbArguments @('shell', 'am', 'force-stop', $package) | Out-Null
    $until = [DateTime]::UtcNow.AddSeconds(10)
    do {
        if (-not (Get-ProbePid)) { return }
        Start-Sleep -Milliseconds 200
    } while ([DateTime]::UtcNow -lt $until)
    throw 'El proceso no terminó. No se permite iniciar la etapa siguiente.'
}

function Get-InstalledProbeHash {
    $location = (Invoke-ProbeAdb -AdbArguments @('shell', 'pm', 'path', $package)).Text
    $lines = @($location -split '\r?\n' | Where-Object { $_ -like 'package:*' })
    if ($lines.Count -ne 1) { throw 'No se reconoce un APK único instalado.' }
    $deviceApk = $lines[0].Substring(8)
    if ($deviceApk -notmatch '^/data/app/[A-Za-z0-9_./=+~\-]+/base\.apk$') { throw 'Ruta APK inesperada.' }
    $hash = ((Invoke-ProbeAdb -AdbArguments @('shell', 'sha256sum', $deviceApk)).Text -split '\s+')[0]
    if ($hash -notmatch '^[a-fA-F0-9]{64}$') { throw 'No se pudo verificar el APK instalado.' }
    return $hash.ToLowerInvariant()
}

function Assert-OwnedProbe {
    Assert-ProbeEmulator
    if ((Get-InstalledProbeHash) -ne $record.ApkHash) { throw 'El APK cambió. No se lanzará ni limpiará otra aplicación.' }
    $uid = (Invoke-ProbeAdb -AdbArguments @('shell', 'run-as', $package, 'id', '-u')).Text
    if ($uid -ne $record.Uid) { throw 'Cambió el UID de la aplicación.' }
}

function Wait-ProbeStage {
    param([string]$ExpectedStage)
    $until = [DateTime]::UtcNow.AddSeconds($StageTimeoutSeconds)
    do {
        $answer = Invoke-ProbeAdb -AdbArguments @('shell', 'run-as', $package, 'cat', $statusPath) -AllowFailure
        if ($answer.Code -eq 0) {
            try { $status = $answer.Text | ConvertFrom-Json } catch { $status = $null }
            if ($null -ne $status -and $status.runId -eq $record.RunId) {
                $currentPid = Get-ProbePid
                # Ignorar el status persistido de un proceso anterior, incluso
                # si decía failed: el nuevo proceso aún puede estar arrancando.
                if ($currentPid -and [string]$status.pid -eq $currentPid) {
                    if ($status.stage -eq 'failed') { throw 'La sonda falló. No se muestran datos ni excepciones nativas.' }
                    if ($status.stage -eq $ExpectedStage) { return $status }
                }
            }
        }
        Start-Sleep -Milliseconds 300
    } while ([DateTime]::UtcNow -lt $until)
    throw ('No se recibió confirmación de la etapa: ' + $ExpectedStage)
}

function Start-ProbeStage {
    param([string]$Stage, [string]$ExpectedStage)
    Assert-OwnedProbe
    if (Get-ProbePid) { throw 'El proceso sigue vivo; se rechaza una lectura en el mismo proceso.' }
    $route = '/fase3/' + $record.RunId + '/' + $Stage
    Invoke-ProbeAdb -AdbArguments @('shell', 'am', 'start', '-W', '-n', $component, '--es', 'route', $route) | Out-Null
    return Wait-ProbeStage -ExpectedStage $ExpectedStage
}

# Toda operación mutante se realiza solo después de verificar este AVD.
Assert-ProbeEmulator
if ($Mode -eq 'Run') {
    # Inspección de nombres, sin leer preferencias ni inicializar el plugin.
    $installed = Invoke-ProbeAdb -AdbArguments @('shell', 'pm', 'path', $package) -AllowFailure
    if ($installed.Text -match '^package:') {
        $hasPrefs = Invoke-ProbeAdb -AdbArguments @('shell', 'run-as', $package, 'test', '-d', 'shared_prefs') -AllowFailure
        if ($hasPrefs.Code -eq 0) {
            $names = (Invoke-ProbeAdb -AdbArguments @('shell', 'run-as', $package, 'ls', 'shared_prefs')).Text -split '\r?\n'
            if (@($names | Where-Object { $_ -match '^FlutterSecure(Storage|KeyStorage)' }).Count -gt 0) {
                throw 'Ya existen almacenes cifrados. No se tocarán. Para un ensayo interrumpido usa Cleanup con su directorio original.'
            }
        } elseif ($hasPrefs.Code -ne 1 -or $hasPrefs.Text) {
            throw 'No se puede confirmar que el almacén esté vacío; prueba detenida.'
        }
    } elseif ($installed.Code -ne 0 -and $installed.Text) {
        throw 'No se pudo determinar si la aplicación está instalada.'
    }
    $runId = [Guid]::NewGuid().ToString('N')
    if ($RunDirectory) { throw 'Run crea su propio directorio; RunDirectory es solo para Resume/Cleanup.' }
    $RunDirectory = Join-Path $artifactRoot $runId
    New-Item -ItemType Directory -Path $RunDirectory -Force | Out-Null
    $record = [pscustomobject]@{
        RunId = $runId; IssuedAtMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        Serial = $serial; Avd = $avd; Package = $package; ApkHash = ''; Uid = ''
        PidA = ''; PidB = ''; DeathObserved = $false; Passed = $false; CleanupConfirmed = $false
    }
    Save-ProbeRecord
    Write-Host ('Directorio del ensayo (conservar): ' + $RunDirectory)
    Push-Location $project
    try {
        & flutter build apk --debug --no-pub '--target=integration_test/native_persistence_probe.dart' '--dart-define=F3_PROBE_ENABLED=true' "--dart-define=F3_PROBE_RUN_ID=$runId" "--dart-define=F3_PROBE_ISSUED_AT_MS=$($record.IssuedAtMs)"
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo compilar la sonda. No se instaló.' }
    } finally { Pop-Location }
    $apk = Join-Path $RunDirectory 'probe.apk'
    Copy-Item -LiteralPath (Join-Path $project 'build\app\outputs\flutter-apk\app-debug.apk') -Destination $apk
    $record.ApkHash = (Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash.ToLowerInvariant()
    Save-ProbeRecord
    Assert-ProbeEmulator
    # ÚNICA instalación. ADB no ejecuta una desinstalación de recuperación.
    Invoke-ProbeAdb -AdbArguments @('install', '-r', $apk) | Out-Null
    if ((Get-InstalledProbeHash) -ne $record.ApkHash) { throw 'No coincide el APK recién instalado.' }
    $record.Uid = (Invoke-ProbeAdb -AdbArguments @('shell', 'run-as', $package, 'id', '-u')).Text
    Save-ProbeRecord
} else {
    if (-not $RunDirectory) { throw 'Resume/Cleanup requieren -RunDirectory del ensayo original.' }
    $RunDirectory = [IO.Path]::GetFullPath($RunDirectory)
    if (-not $RunDirectory.StartsWith($artifactRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'El directorio debe estar dentro de integration_test/.native_persistence_runs.'
    }
    $record = Get-Content -LiteralPath (Join-Path $RunDirectory 'run.json') -Raw | ConvertFrom-Json
    if ($record.RunId -notmatch '^[a-f0-9]{32}$' -or $record.Serial -ne $serial -or $record.Avd -ne $avd -or $record.Package -ne $package) {
        throw 'El registro no pertenece a este procedimiento.'
    }
    $apk = Join-Path $RunDirectory 'probe.apk'
    if ((Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash.ToLowerInvariant() -ne $record.ApkHash) {
        throw 'El APK archivado cambió.'
    }
    Assert-OwnedProbe
}

$ownedInstallation = $true
try {
    if ($Mode -eq 'Cleanup') {
        Stop-ProbeProcess
        Start-ProbeStage -Stage 'cleanup' -ExpectedStage 'cleanup_verified' | Out-Null
        $record.CleanupConfirmed = $true
        Save-ProbeRecord
        Write-Host 'Limpieza verificada. No equivale a persistencia superada.'
    } else {
        if ($Mode -eq 'Run') {
            Stop-ProbeProcess
            $a = Start-ProbeStage -Stage 'write' -ExpectedStage 'write_verified'
            $record.PidA = [string]$a.pid
            Save-ProbeRecord
            Write-Host ('Etapa A verificada. PID: ' + $record.PidA)
        } elseif (-not $record.PidA -or $record.Passed) {
            throw 'No hay una etapa A confirmada pendiente de restaurar.'
        }
        Stop-ProbeProcess
        $record.DeathObserved = $true
        Save-ProbeRecord
        Write-Host 'Terminación confirmada: pidof no encuentra el proceso.'
        Assert-OwnedProbe
        $b = Start-ProbeStage -Stage 'read' -ExpectedStage 'read_verified_cleaned'
        $record.PidB = [string]$b.pid
        if ($record.PidB -eq $record.PidA) { throw 'No se acepta el mismo PID para ambas etapas.' }
        Assert-OwnedProbe
        $record.Passed = $true
        $record.CleanupConfirmed = $true
        $passed = $true
        Save-ProbeRecord
        Write-Host ('PASS: persistencia entre procesos, mismo APK/UID. PID B: ' + $record.PidB)
    }
} finally {
    if ($ownedInstallation) {
        if (-not $passed -and -not $record.CleanupConfirmed) {
            try {
                Stop-ProbeProcess
                Start-ProbeStage -Stage 'cleanup' -ExpectedStage 'cleanup_verified' | Out-Null
                $record.CleanupConfirmed = $true
            } catch {
                Write-Warning 'Limpieza no confirmada. Usa Cleanup con el directorio original. No borres datos globales.'
            }
        }
        try { Stop-ProbeProcess } catch { Write-Warning 'No se confirmó el cierre final del proceso.' }
        Save-ProbeRecord
    }
}
