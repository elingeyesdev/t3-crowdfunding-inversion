# Paso 90: persistencia entre procesos Android

Esta sonda usa `createPlatformSessionStore()` y todas sus opciones de producción.
No es una pantalla de UniFundMe ni usa su arranque principal. Solo se permite en
`emulator-5554`, AVD `UniFundMe_Fase3_Test`, Android 16/API 36/x86_64, usuario 0.
No ejecutarla con `flutter test`, `flutter run`, hot reload o hot restart.

## Ejecución desde PowerShell normal

```powershell
Set-Location 'C:\Users\DIDIER24\Documents\t3-crowdfunding-inversion\movil'
dart format --output=none --set-exit-if-changed integration_test
dart analyze
flutter analyze --no-pub
flutter test test --no-pub
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\integration_test\run_native_persistence.ps1 -Mode Run
```

`ExecutionPolicy Bypass` solo afecta ese proceso PowerShell; no cambia la política
persistente ni permisos de Flutter. El script requiere Flutter en PATH y
ANDROID_HOME, o el parámetro `-AdbPath` con la ruta a platform-tools/adb.exe.
No instala dependencias ni inicia/reinicia/limpia el AVD.

El script comprueba que el AVD está completamente arrancado. Antes de inicializar
el plugin exige ausencia de los cuatro almacenes cifrados conocidos y sus .bak.
Si ya existen, se detiene: no lee ni borra preferencias existentes. Es una
condición conservadora; un almacén vacío de un ensayo previo también detiene Run.

## Procedimiento

1. Genera identificador y fecha sintéticos y compila UNA vez un APK debug con
   target `integration_test/native_persistence_probe.dart`. No modifica Gradle,
   AndroidManifest, dependencias ni código productivo.
2. Archiva APK y `run.json` bajo `integration_test/.native_persistence_runs/<id>/`.
   Son artefactos del ensayo: no incorporarlos a un commit. El registro no guarda
   el token ni una copia de la sesión.
3. Instala UNA vez con `adb -s emulator-5554 install -r`. Si falla, no desinstala
   para reintentar. Verifica hash del APK instalado y UID de la aplicación.
4. Lanza Etapa A con un Intent `route=/fase3/<id>/write`. La sonda confirma que no
   hay sesión, guarda la credencial sintética, la lee y registra `write_verified`.
5. Ejecuta `am force-stop com.unifoundme.movil` SOLO en ese AVD y espera hasta que
   `pidof` ya no encuentre el proceso. Guarda esa observación en `run.json`.
6. Sin compilar, reinstalar ni borrar datos, lanza EL MISMO APK con
   `route=/fase3/<id>/read`. La sonda exige un PID distinto al de la escritura,
   recupera el registro completo mediante el backend real, lo compara, lo elimina
   y confirma su ausencia. El host verifica además mismo hash y mismo UID.
7. Solo entonces escribe `Passed=true`, `CleanupConfirmed=true`, PID A y PID B.

No se usan `pm clear`, `deleteAll`, desinstalación ni limpieza del emulador. La
única clave cifrada usada es la productiva `unifundme.session`, dentro de este
AVD previamente verificado como aislado y con almacén prístino. La fábrica y el
backend NO cambian opciones, namespace ni clave. La coincidencia completa con el
fixture exclusivo del ensayo es requisito para cualquier eliminación.

## Interrupciones y limpieza

Conservar el directorio que imprime el script. El script intenta limpiar con
`finally` si un fallo ocurre después de instalar la sonda. Etapa A conserva el
fixture deliberadamente; Etapa B limpia en `finally` sin borrar una sesión ajena.
Si se mata el proceso o se corta PowerShell, el cleanup puede no ejecutarse.

Si el registro contiene PID A confirmado y todavía no hay resultado final:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\integration_test\run_native_persistence.ps1 -Mode Resume -RunDirectory '.\integration_test\.native_persistence_runs\ID_DEL_ENSAYO'
```

Para limpiar sin declarar persistencia superada:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\integration_test\run_native_persistence.ps1 -Mode Cleanup -RunDirectory '.\integration_test\.native_persistence_runs\ID_DEL_ENSAYO'
```

Resume y Cleanup NO compilan ni instalan. Rechazan otro AVD, APK, UID o registro.
Cleanup comprueba el recibo de propiedad y la coincidencia exacta de la sesión
sintética antes de borrarla. Ante incompatibilidad, corrupción o identidad ajena,
se detiene; no ofrece limpieza global. Un cleanup correcto no cuenta como PASS.

## Evidencia y límites

PASS requiere escribir y restaurar el fixture, dos PID distintos, ausencia del
proceso entre etapas, mismo APK/UID y borrado confirmado. Los mensajes de pantalla
y el archivo de status privado no contienen tokens ni excepciones nativas.
Los archivos auxiliares contienen solo identificadores/etapas/PID del ensayo.

El procedimiento no valida Laravel, backup/transferencia, reinicio del teléfono,
almacenamiento respaldado por hardware ni el arranque de la aplicación principal.
No declara completa la Fase 3 por sí solo ni autoriza la Fase 4.
