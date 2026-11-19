# UniFundMe — aplicación móvil

Aplicación Android de UniFundMe. Incluye acceso y perfiles por rol. El catálogo,
los aportes, su seguimiento, las actualizaciones del emprendedor y las
notificaciones corresponden a los issues siguientes.
El issue [#24](https://github.com/elingeyesdev/t3-crowdfunding-inversion/issues/24)
aportó la estructura, navegación, componentes comunes y cliente de API.

**Estado revisado: 19 de noviembre de 2026.** El issue #24 está cerrado.
La autenticación y las sesiones del #25 están versionadas en `5604e2a`.
La consulta, creación y edición de perfiles del #25 están implementadas en el
árbol de trabajo. El usuario reportó 301 pruebas correctas y las dos pruebas
HTTP reales correctas en PowerShell 5.1. También confirmó el recorrido Android
de ambos roles, la persistencia de sesión y el cambio de cuenta. Sigue pendiente
incorporar Develop y revisar los cambios locales antes de su cierre.
Consulta [el estado del issue #25](docs/issue-25-acceso-perfil.md).
La recuperación de acceso requerida por RF-01 sigue pendiente: la API vigente
no expone recuperación de contraseña. El #25 permanece abierto y su PR debe
identificar esta dependencia. Los cambios adelantados del #26 se conservaron
fuera del árbol de trabajo para mantener una entrega por issue.
La [matriz del issue #24](docs/issue-24-cierre-tecnico.md) conserva evidencia histórica.

El alcance de este producto son los issues #25–#30. Las modificaciones de
Laravel/React corresponden al responsable web. Sus cambios se incorporan
mediante sincronización de Git y se revisa el contrato de la API antes de
adaptar Flutter. Los defectos del backend que bloqueen móvil se documentan
para coordinación; no se simulan resultados para ocultarlos.

## Requisitos y dependencias

| Elemento | Configuración inspeccionada |
|---|---|
| Flutter local de referencia | 3.47.8, canal stable |
| Dart local / restricción del proyecto | 3.13.7 / `^3.13.7` |
| Android | SDK y herramientas configurados para Flutter; emulador o dispositivo |
| Java y Kotlin | Target JVM 17; comprobar el JDK efectivo con Flutter |
| Gradle / AGP / Kotlin declarados | 9.3.1 / 9.1.0 / 2.4.0 |
| Dependencias de aplicación | `go_router ^15.1.3`, `http ^1.6.0`, `cupertino_icons ^1.0.8`, `flutter_secure_storage 11.2.0`, Flutter SDK |
| Versiones resueltas | go_router 15.1.3, http 1.6.0, cupertino_icons 1.0.9 |
| Desarrollo | `flutter_test` del SDK y `flutter_lints ^6.0.0` |

El SDK Flutter debe incluir Dart compatible con la restricción. No utilizar un
Dart anterior aunque otra versión de Flutter esté instalada. Conservar
`pubspec.lock` para reproducir las versiones. No actualizar herramientas como
parte de la instalación ordinaria.

## Arquitectura constatada

Organización por funcionalidades, con infraestructura compartida separada de la
presentación. Autenticación y perfiles tienen repositorios, contratos tipados
y controladores; el cliente HTTP y el almacenamiento seguro son compartidos.

| Ruta | Responsabilidad |
|---|---|
| `lib/main.dart` | Ejecuta `UniFundMeApp` |
| `lib/app/unifundme_app.dart` | Carga configuración, crea y libera el router; presenta errores de configuración |
| `lib/app/router/` | Rutas centralizadas y vistas privadas de acceso provisional y ruta desconocida |
| `lib/app/shell/main_shell.dart` | Contenedor y barra inferior Material 3 |
| `lib/app/theme/app_theme.dart` | Único tema claro; morado provisional y fuente del sistema |
| `lib/features/catalog/presentation/` | Entrada provisional a Explorar; implementación del #26 separada |
| `lib/features/tracking/presentation/` | Seguimiento provisional |
| `lib/features/notifications/presentation/` | Notificaciones provisionales |
| `lib/features/account/` | Cuenta, consulta y edición de perfiles por rol, repositorio y controlador |
| `lib/features/auth/` | Registro, login, sesión, validaciones y errores |
| `lib/core/storage/` | Credenciales cifradas y contrato de persistencia |
| `lib/shared/widgets/feature_pending_view.dart` | Vista desplazable compartida; título, descripción y acción opcional |
| `lib/core/config/app_config.dart` | Entorno y URL base validados |
| `lib/core/network/` | Transporte HTTP y errores controlados |
| `test/widget_test.dart` | Arranque, configuración visible y presentación |
| `test/app/` | Navegación principal, complementaria y recuperación |
| `test/core/config/` | Configuración válida, inválida y protección de mensajes |
| `test/core/network/` | Transporte simulado mediante MockClient |
| `android/` | Proyecto Android nativo |
| `docs/` | Evidencias y cierre técnico |

## Navegación

| Ruta | Comportamiento |
|---|---|
| `/` | Redirige a `/explorar` |
| `/explorar` | Primera sección, pendiente de conectar en #26 |
| `/seguimiento` | Sección provisional |
| `/notificaciones` | Sección provisional |
| `/cuenta` | Identidad, acceso a perfiles de los roles existentes y cierre de sesión |
| `/acceso` | Inicio de sesión fuera de las pestañas |
| `/registro` | Registro y selección del rol inicial |
| Cualquier ruta desconocida | Información y acción «Volver a Explorar» |

`StatefulShellRoute.indexedStack` mantiene una rama por pestaña. Desde Cuenta se
utiliza `pushNamed`; la flecha vuelve al origen. Si Acceso se abrió sin pila,
su flecha lleva a Explorar. El evento Atrás del sistema se prueba al abrir Acceso
sobre una pantalla; no se promete restauración tras cierre del proceso ni
navegación externa Android mediante enlaces asociados.

## Configuración por compilación

`AppConfig.fromEnvironment()` lee `APP_ENV` y `API_BASE_URL` mediante
`String.fromEnvironment`. Se aplica al arrancar; requiere reiniciar/recompilar
para cambiar parámetros, no basta con hot reload.

| Regla | Resultado |
|---|---|
| APP_ENV admitido | `development` o `production`, respetando mayúsculas/minúsculas |
| APP_ENV omitido en debug/profile | Desarrollo |
| APP_ENV omitido en release | Producción |
| Desarrollo sin API_BASE_URL o en blanco | Navegación disponible, URL nula, ninguna dirección inventada |
| Producción sin URL | Error controlado de configuración |
| URL definida | Absoluta, host no vacío, HTTP/HTTPS y ruta exacta `/api/v1` o `/api/v1/` |
| Producción | HTTPS obligatorio |
| Credenciales en URL, query, fragmento o puerto inválido | Rechazados |
| URL válida | Normalizada con barra final |

Los errores no reproducen el valor recibido. Los parámetros compilados no son
un almacén de secretos: no incluir tokens, contraseñas, claves privadas o
credenciales de base de datos. No hay una URL real de producción acreditada.

Android declara `usesCleartextTraffic="false"` en main/release. Debug permite
HTTP únicamente para `localhost`, `127.0.0.1` y `10.0.2.2`, para conectar con el
servidor local mediante `adb reverse` o el emulador. Una URL HTTP de la red LAN
no queda habilitada por esta excepción. La validación TLS se conserva.

## Instalación y verificaciones — PowerShell

Ejecutar desde la raíz del repositorio:

```powershell
Set-Location .\movil
flutter pub get
```

`pub get` instala/resuelve dependencias y puede modificar cachés y el lockfile.
Revisar cualquier diferencia imprevista. La auditoría detectó que los scripts y
JAR del wrapper Gradle están ignorados: antes de integrar, comprobar el arranque
desde una copia limpia o acordar su inclusión. No regenerar el proyecto encima
del trabajo existente como solución automática.

```powershell
dart format --output=none --set-exit-if-changed lib test
dart analyze
flutter analyze --no-pub
flutter test --no-pub
```

El primer comando solo comprueba formato. Los analizadores y pruebas pueden
generar archivos temporales. La suite ordinaria usa transporte simulado; las
dos pruebas de HTTP real se omiten si no se proporciona una API de pruebas
aislada, como se explica en el documento #25. No utilizar `pub upgrade` para una
validación ordinaria.

### Ejecutar sin API

```powershell
flutter devices
flutter run --debug --no-pub --dart-define=APP_ENV=development
```

Seleccionar el dispositivo si hay más de uno. `run` compila e instala la app,
modificando archivos generados y el dispositivo. Desde Android Studio se puede
abrir `movil/`, seleccionar `lib/main.dart` y el dispositivo Android; los
mismos argumentos `--dart-define` van en la configuración de ejecución.

### Ejecutar con una URL real aprobada

No hay un servidor predeterminado. Este bloque solicita la dirección al
operador, sin inventar host, puerto ni endpoint:

```powershell
$uniFundMeApiUrl = Read-Host 'URL HTTPS real aprobada, terminada en /api/v1'
flutter run --debug --no-pub --dart-define=APP_ENV=production "--dart-define=API_BASE_URL=$uniFundMeApiUrl"
```

El ejemplo selecciona el **entorno** producción sobre una compilación debug;
no genera un APK release. También puede usarse `APP_ENV=development` con una
URL aprobada. Acceso y perfiles utilizan sus respectivos repositorios. Explorar
todavía es una entrada provisional en esta entrega del #25.

### APK debug

```powershell
flutter build apk --debug --no-pub
```

Salida esperada: `build/app/outputs/flutter-apk/app-debug.apk`. El usuario
reportó una compilación satisfactoria y la auditoría constató un APK existente;
ver su identificación y límites en la matriz. No se ha acreditado APK release.

## Contrato del cliente base

`ApiClient` recibe `http.Client` y `AppConfig` por constructor. Los repositorios
lo reciben desde `AppDependencies`. Expone GET, POST, PUT, PATCH, DELETE para JSON y
`getBytes` para archivos. Conserva la envoltura JSON de Laravel, sin extraer
automáticamente `data` ni crear modelos.

- Rutas relativas sin barra inicial ni prefijo repetido; consultas mediante
  `Map<String, String>`.
- Segmentos recibidos sin precodificar; rechaza `%`, rutas absolutas,
  traversal, espacios, fragmentos y query incrustada.
- `Accept: application/json` en operaciones JSON; Content-Type JSON con
  UTF-8 cuando hay cuerpo. La operación binaria pide octet-stream.
- Proveedor opcional síncrono/asíncrono de Bearer; no almacena credenciales.
- Respuesta vacía/204: null. JSON inválido y contenido no JSON: error controlado.
- Códigos HTTP no exitosos: ApiException con categoría y código, sin cuerpo
  sensible; el tratamiento por campo del 422 queda para la funcionalidad.
- Sin redirecciones automáticas ni reintentos.
- Timeout predeterminado de 15 segundos para el proveedor y para transporte
  y lectura del cuerpo, por separado. No es un plazo total global ni garantiza
  cancelar una escritura ya enviada.
- `close()` es idempotente. Por defecto no cierra el cliente compartido;
  `ownsClient: true` transfiere esa responsabilidad.
- Los bytes se acumulan en memoria; no hay descarga progresiva ni manejo de
  enlaces firmados absolutos externos al prefijo.

Los contratos de acceso y perfiles se contrastaron con las rutas y
controladores Laravel existentes. La integración HTTP de perfiles fue validada
por el usuario contra una base temporal independiente.

## Android y límites de la entrega

- Nombre visible: **UniFundMe**.
- Application ID y namespace: `com.unifoundme.movil`, conservados deliberadamente.
- Internet declarado en main; debug lo hereda. Profile conserva su declaración.
- Tráfico sin cifrar deshabilitado en main/release. Debug permite únicamente
  `localhost`, `127.0.0.1` y `10.0.2.2` mediante su configuración de red específica.
  Producción sigue exigiendo una API HTTPS. No se deshabilita la validación TLS.
- La configuración release todavía referencia firma debug: **no es una firma
  definitiva de distribución**. Firma y APK release siguen pendientes.
- Acceso incluye autenticación y sesiones; el perfil tiene consulta y edición.
  Catálogo, aportes, seguimiento, actualizaciones y notificaciones corresponden
  a entregas posteriores. Recuperación de acceso depende de una API aún inexistente.
- El último resultado convencional reportado por el usuario es **301 pruebas
  superadas**, más dos HTTP y recorridos de perfiles en Samsung SM-N986N,
  Android 13. La ejecución independiente del #25 dentro del motor Flutter
  también obtuvo **301 correctas y dos omitidas**; no sustituye la validación nativa.

## Control de versiones y evidencia

Versionar fuentes, recursos Android de origen, manifiestos, configuración
compartida, lockfile, pruebas, README, documentación y metadatos Flutter.
Mantener fuera cachés, APK, archivos locales, claves, secretos y configuración
del IDE. Los iconos PNG de origen sí forman parte del proyecto.

La observación de base móvil sin seguimiento corresponde a la auditoría
histórica del #24. Actualmente las fuentes existentes están versionadas; las
adiciones de perfiles deben revisarse e incorporarse a Git después de su validación.
No interpretar un commit previo como evidencia de los cambios actuales sin commit.
La publicación de la rama y del PR no equivale al cierre del issue ni actualiza
automáticamente el Contexto Maestro o los demás chats del proyecto.
