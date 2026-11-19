# Issue #25 — acceso y perfil móvil

Fecha: 19 de noviembre de 2026. Rama inspeccionada:
`feature/25-acceso-perfil-movil`, base `5604e2a`.

## Alcance y estado

El alcance aprobado es móvil, issues #25–#30. Se consulta Laravel como contrato
compartido; no se implementan cambios web/backend. El #25 continúa abierto.
Esta entrega corresponde al EDT 3.2 y se contrasta con RF-01 y RF-02.
RF-01 también exige recuperar acceso: esa operación sigue bloqueada por la
ausencia de un contrato API de recuperación. No se declara cumplimiento total
de RF-01 ni cierre del issue mientras esa dependencia siga pendiente.

| Elemento | Estado |
|---|---|
| Registro, login, sesiones y almacenamiento seguro | IMPLEMENTADO en el commit base |
| Consulta, creación y edición del perfil por rol | IMPLEMENTADO, cambios locales |
| Formularios con validación local y errores por campo | IMPLEMENTADO |
| Excepciones HTTP de desarrollo Android limitadas a loopback/emulador | IMPLEMENTADO, XML verificado |
| Análisis de Dart | PROBADO: sin incidencias |
| Suite unitaria y de widgets tras las correcciones | PROBADO mediante ejecución en proceso dentro del motor Flutter: 301 correctas, 0 fallidas, 2 HTTP omitidas |
| Ejecución convencional de la suite Flutter | PROBADO según salida del usuario en PowerShell 5.1: 301 correctas, 0 fallidas, 2 HTTP omitidas |
| Preparación del backend de prueba | PROBADO con `-PrepareOnly`: migraciones, roles y rutas temporales verificadas |
| Integración HTTP real | PROBADO según salida del usuario: 2 pruebas correctas, investor y entrepreneur, con Laravel y base temporal |
| APK debug | PROBADO según salida del usuario: `flutter build apk --debug --no-pub` exitoso |
| Recorrido de donante en Android | PROBADO según reporte del usuario en Samsung SM-N986N: registro, login, creación y edición del perfil sin incidencias |
| Persistencia, cierre, cambio de cuenta y perfil de emprendedor en Android | PROBADO según confirmación del usuario de los cinco pasos solicitados |
| Incorporación de cambios recientes de Develop | PENDIENTE: escritura de `.git/FETCH_HEAD` denegada |
| Recuperación de acceso de RF-01 | PENDIENTE: sin endpoint API disponible; requiere coordinación con backend |
| Separación del catálogo #26 | IMPLEMENTADO: cambios apartados del árbol activo y respaldo verificado por SHA-256 |
| Script auxiliar de Laravel | RETIRADO del árbol de entrega después de la validación reportada; pruebas HTTP conservadas |
| Regresión después de separar #26 | PROBADO: 301 correctas, cero fallidas y dos HTTP omitidas en el motor Flutter; formato de 58 archivos sin cambios y análisis sin incidencias |

La ejecución alternativa utilizó los archivos `*_test.dart` existentes, las
clases Declarer/Suite/LiveTest de `test_api 0.7.12`, los hooks de preparación y
limpieza de cada grupo y `AutomatedTestWidgetsFlutterBinding`. Se ejecutaron
en `flutter_tester` con aserciones activadas y fuentes de prueba, dentro de
un proceso, sin el puente WebSocket del comando convencional. No se alteró
el SDK instalado. Las dos pruebas HTTP permanecieron omitidas deliberadamente.
También pasó una comprobación directa de 19 condiciones del controlador en
el motor Flutter (crear, editar, limpiar opcionales, 422, 409, restaurar y logout).
Estos resultados no acreditan red real, almacenamiento nativo ni dispositivo.

## Correcciones tras la ejecución del usuario

- **Prueba de edición/cancelación:** encontrar un elemento del listado no
  garantizaba que su centro recibiera el toque en la ventana de 800×600.
  Se espera al desplazamiento y al layout, se comprueba `hitTestable` y se
  considera fatal cualquier toque perdido. Se cubren 800×600 y 360×640.
- **Rutas de caché en Windows:** Laravel no incluye `C:\` entre sus prefijos
  absolutos predeterminados. Los procesos de prueba ahora cargan un bootstrap
  temporal que registra exclusivamente su carpeta temporal como prefijo y
  verifica todos los destinos antes de iniciar Laravel. El servidor y la
  consola de prueba comparten ese bootstrap; no se modifica el framework.
- **Detención ante errores:** se exige un marcador explícito de preflight
  correcto, además del código de salida. Después de migrar se verifican las
  tablas y roles antes de iniciar el servidor. Un fallo no habilita la etapa HTTP.
- **Limpieza del entorno:** las variables originalmente ausentes se eliminan
  del proceso en vez de quedar como cadenas vacías. La restauración se ejecuta
  incluso si falla la detención del servidor. Se comprobó que se restauran las
  variables y el directorio de trabajo; los hashes de `.env` y las cachés web
  existentes se conservaron durante la preparación.

La preparación se ejecutó en PowerShell 7.6.9 del entorno de herramientas.
Después de corregir ambos fallos, el usuario ejecutó satisfactoriamente la
suite convencional y el recorrido HTTP completo en Windows PowerShell 5.1.
La salida verifica registro, login, creación, edición, lectura, restauración
y revocación para ambos roles en la base temporal. Es evidencia reportada por
el usuario, distinta de la ejecución directa del motor dentro de las herramientas.
El intento previo de ejecutar el archivo con PowerShell 5.1 dentro de las
herramientas fue rechazado por AuthorizationManager; no se cambió la política.

El error inicial «No pubspec.yaml file found» ocurrió al ejecutar Flutter desde
`C:\Users\DIDIER24`; quedó resuelto al entrar en `movil/` y no requirió cambios.
El texto «IntegraciÃ³n» al terminar el script fue un problema de codificación
del mensaje de consola. Se cambió ese mensaje a ASCII, sin alterar el flujo HTTP.

## Evidencia manual Android del 19 de noviembre

El usuario conectó el Samsung SM-N986N (`adb devices -l`: estado `device`),
inició la API temporal en el puerto 64879 y siguió el recorrido indicado para
donante. Reportó que funcionó con normalidad: registro, inicio de sesión,
creación del perfil y edición con conservación del dato.
Después confirmó satisfactorios los cinco pasos adicionales: cerrar y abrir
completamente la app conservando sesión/perfil, cerrar sesión, registrar y
completar un perfil de emprendedor, editarlo y regresar a la cuenta de donante
sin mezclar perfiles. Es evidencia manual reportada por el usuario, no una
observación directa del dispositivo desde las herramientas. No se extiende esa
confirmación a los casos negativos de red o revocación representados en Android.

## Comportamiento implementado

Desde Cuenta se abren los perfiles de los roles ya asignados. Cada pantalla
consulta el endpoint correspondiente. Una respuesta 404 ofrece «Completar
perfil»; no realiza POST automáticamente. Las cuentas sin el rol no ofrecen
esa operación y el controlador también la bloquea.

Crear utiliza POST y editar PUT. En edición se envían únicamente los campos
modificados. Un campo opcional vaciado se envía como null; un campo sin cambios
se omite. No se envían capital, datos bancarios, KYC ni atributos de permisos.
Un tipo de inversor futuro se conserva sin reenviar un enum desconocido.

Las respuestas 422 conservan los datos del formulario y muestran errores
sanitizados. Los envíos duplicados se bloquean. Un conflicto o una respuesta
de escritura incierta exige consultar el estado antes de reenviar: no hay
reintentos automáticos de POST/PUT.

Cambiar o cerrar la sesión elimina el perfil de memoria e invalida resultados
anteriores. Restaurar una sesión vuelve a consultar el perfil. Se comprueba
que el propietario de la respuesta coincida con la identidad autenticada.

## Archivos

- `lib/features/account/domain/profile_details.dart`: campos editables,
  validaciones y construcción de solicitudes parciales.
- `lib/features/account/application/account_profile_controller.dart`:
  consultas, escrituras, estados, permisos y aislamiento de sesiones.
- `lib/features/account/presentation/profile_page.dart` y `profile_form.dart`:
  consulta, creación y edición.
- `lib/features/account/presentation/account_page.dart`: entradas por rol.
- `android/app/src/debug/`: excepción HTTP local exclusiva de debug.
- `test/features/account/`: regresiones de contratos, controlador y pantallas.
- `test/integration/laravel_profile_http_test.dart`: recorrido HTTP para ambos roles.

El script auxiliar `integration_test/run_laravel_profile_http.ps1` se utilizó
para obtener la evidencia HTTP y Android descrita. Se retiró al preparar la
entrega, como se acordó con el usuario. Se conserva una copia fuera del
repositorio junto al trabajo apartado del #26. No es un archivo requerido para
ejecutar la aplicación ni debe publicarse como parte de este PR.

## Validación reproducible

Desde `movil/`, los comandos siguientes generan cachés y artefactos de prueba
móviles. No instalan dependencias ni actualizan Git:

```powershell
dart analyze
flutter analyze --no-pub
flutter test test --no-pub
flutter build apk --debug --no-pub
```

Las dos pruebas HTTP se omiten en la suite normal. Para repetirlas, el
responsable del backend debe preparar una instancia Laravel exclusivamente de
pruebas, con base, cachés y almacenamiento separados y roles sembrados. Antes
de habilitar las escrituras hay que comprobar esa separación: las pruebas crean
cuentas y perfiles y revocan sus tokens. No utilizar la base local de desarrollo.

Con esa API aislada ya iniciada en loopback:

```powershell
$profileTestApi = Read-Host 'URL de la API local de pruebas aislada, terminada en /api/v1'
flutter test test/integration/laravel_profile_http_test.dart --no-pub "--dart-define=UNIFUNDME_TEST_API_URL=$profileTestApi" --dart-define=UNIFUNDME_ISOLATED_TEST=true
```

El indicador de aislamiento es una confirmación del operador, no una inspección
de la base remota por Flutter. El recorrido verifica registro, login, creación,
edición, consulta, restauración y revocación para ambos roles. La evidencia
obtenida utilizó SQLite temporal; no acredita concurrencia ni particularidades
de PostgreSQL. Las pruebas son código fuente útil y se conservan.

Recorrido de referencia para cada rol (los casos positivos ya fueron reportados;
la limpieza de opcionales y los errores de red requieren evidencia nativa específica):

1. Registrar la cuenta e iniciar sesión con sus credenciales.
2. Entrar en Cuenta y completar el perfil inicialmente inexistente.
3. Editar nombres y un campo opcional; vaciar ese opcional y comprobar su lectura.
4. Cerrar completamente la app y abrirla de nuevo: comprobar sesión y perfil.
5. Cerrar sesión: comprobar que no se conserva el acceso a los datos privados.
6. Iniciar sesión con la otra cuenta: comprobar que no muestra el perfil anterior.
7. Interrumpir la conexión y comprobar un error recuperable al consultar el perfil.

No usar la interrupción de red como prueba de revocación remota. La revocación
401 ya está cubierta por la prueba HTTP; su representación nativa sigue pendiente.

## Criterios pendientes para cerrar #25

1. Incorporar Develop preservando las fuentes móviles y revisar cambios de API.
2. **Completado según evidencia del usuario:** suite convencional (301 pruebas)
   e integración HTTP (2 pruebas para ambos roles).
3. **Completado según reporte del usuario:** ambos perfiles, creación, edición,
   persistencia tras reinicio, cierre y cambio de cuenta. La representación nativa
   de errores de red, 401 y limpieza de opcionales sigue sin evidencia específica;
   los contratos y la limpieza de opcionales están cubiertos por pruebas automáticas.
4. Completar la recuperación de acceso de RF-01 cuando backend publique su API,
   o registrar una decisión explícita de alcance/trazabilidad. La ausencia de
   API no equivale a cumplimiento ni a autorización para modificar backend.
5. Publicar únicamente los cambios del #25; PR hacia Develop, prueba cruzada
   del compañero, aprobación y CI antes de Squash and merge.

Los cambios adelantados del #26 se preservaron fuera del árbol de trabajo;
se retomarán después de esta entrega. Los issues #27-#30 siguen pendientes.

## Dependencia de recuperación de acceso

Verificación del 19 de noviembre: `web/routes/api.php` y `AuthController.php`
en Develop permiten registro, login, me, logout y cambio de contraseña de un
usuario ya autenticado. Cambiar una contraseña conocida no recupera una cuenta
cuando se ha olvidado esa contraseña. Flutter no implementa ese flujo de recuperación.

Para coordinación con backend se necesitan contrato y ejemplos de solicitud y
respuesta para pedir la recuperación y restablecer la contraseña; reglas de
expiración/uso único del token, mensajes que no revelen cuentas existentes,
límites de solicitudes, entrega del enlace/código y revocación de sesiones.
Estos puntos son PROPUESTOS para definir el contrato, no endpoints implementados.
Una vez exista, móvil podrá integrar pantallas, validaciones y pruebas reales.

## Preparación del Pull Request

Referencia metodológica: `gitub para equipos en xp.pdf`, páginas 16-17 y 39-42:
prueba cruzada, separación por issue y cierre mediante PR. El antecedente #47
integró la base móvil en Develop y solicitó revisión a `dnngmz`.

- Origen: `feature/25-acceso-perfil-movil`.
- Destino: `Develop` (respetando el nombre real de la rama).
- Título: `feat(movil): implementar acceso y perfiles por rol (#25)`.
- Estado propuesto: borrador mientras siga pendiente RF-01 y la integración.
- Relación provisional: `Refs #25`; usar `Closes #25` cuando se cumpla el alcance.
- Revisor: `dnngmz`; el autor no aprueba su propio PR.
- HU, caso de uso y tarea Planner: identificadores pendientes de localizar;
  no se inventan referencias a esos artefactos.

La rama predeterminada real del repositorio es `main`, mientras que la guía
supone `develop`. Se conserva Develop como destino acordado; los keywords de
cierre del cuerpo de un PR hacia una rama no predeterminada no cierran el issue
automáticamente. Referencia: https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue
El 19 de noviembre la comparación remota mostró diez commits entrantes desde
Develop y uno propio de la rama. No se incorporaron: `git fetch origin` fue
rechazado al escribir `.git/FETCH_HEAD`. Publicar por la integración de GitHub
no sincroniza por sí mismo la copia local ni resuelve esa integración pendiente.
El intento posterior de crear el primer blob con la integración de GitHub fue
rechazado con HTTP 403, `Resource not accessible by integration`. No se creó
ningún commit, no se actualizó la rama remota y no se abrió un PR. La publicación
requiere Git desde una terminal con acceso o una conexión con permisos adecuados.

Contenido preparado para la revisión:

### Historia

Refs #25. EDT 3.2; RF-01 (parcial, recuperación pendiente) y RF-02.

### Qué cambió

Registro, inicio/cierre y restauración de sesión mediante API y almacenamiento
cifrado; consulta, creación y edición de perfiles de donante y emprendedor.
Se validan permisos, identidad de la respuesta y actualizaciones parciales.
Cambiar o cerrar la sesión descarta datos privados y respuestas anteriores.
Los errores de formulario conservan los valores sin duplicar escrituras.
La excepción HTTP Android está limitada a debug y a direcciones locales.

### Cómo probar

Ejecutar análisis, suite ordinaria y compilación indicados arriba. Con API
aislada, ejecutar las dos pruebas HTTP. En Android, comprobar ambos perfiles,
persistencia tras reinicio, cierre y cambio de cuenta; probar los casos negativos
que aún no disponen de evidencia manual específica.

### Evidencia

El usuario reportó 301 pruebas correctas, dos HTTP reales correctas, APK debug
compilado y recorridos Android satisfactorios en Samsung SM-N986N. Esta evidencia
precede a la preparación del PR y debe contrastarse con su commit final.

- [x] Funciones principales de acceso y perfil implementadas.
- [x] Evidencia automática y manual registrada con su procedencia.
- [x] Cambios del #26 apartados; auxiliar temporal retirado.
- [ ] Recuperación de acceso de RF-01 resuelta.
- [ ] Develop incorporado y validación del commit final.
- [ ] HU/caso de uso/Planner vinculados.
- [ ] Prueba cruzada y aprobación del compañero.
- [ ] CI del PR comprobada, cuando exista.

La publicación en GitHub no actualiza automáticamente otros chats, Planner ni
el Contexto Maestro. Este texto prepara una revisión y no acredita su aprobación.
