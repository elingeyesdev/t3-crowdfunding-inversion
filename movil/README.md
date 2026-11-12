# UniFundMe — aplicación móvil

Base Android de UniFundMe, plataforma de crowdfunding para explorar campañas,
realizar aportes y consultar su seguimiento. Esas operaciones de dominio todavía
no están conectadas a las pantallas: el issue [#24](https://github.com/elingeyesdev/t3-crowdfunding-inversion/issues/24)
implementa la estructura, navegación, componentes comunes y preparación de API.

**Referencia de esta documentación: 12 de noviembre de 2026.** Las Fases 1–6
están implementadas y el usuario reportó su validación. La Fase 7 documenta y
audita la entrega; no equivale a integración en Git ni cierre formal del issue.
La [matriz de cierre técnico](docs/issue-24-cierre-tecnico.md) separa ejecución
directa, inspección de código y evidencia reportada.

## Requisitos y dependencias

| Elemento | Configuración inspeccionada |
|---|---|
| Flutter local de referencia | 3.47.8, canal stable |
| Dart local / restricción del proyecto | 3.13.7 / `^3.13.7` |
| Android | SDK y herramientas configurados para Flutter; emulador o dispositivo |
| Java y Kotlin | Target JVM 17; comprobar el JDK efectivo con Flutter |
| Gradle / AGP / Kotlin declarados | 9.3.1 / 9.1.0 / 2.4.0 |
| Dependencias de aplicación | `go_router ^15.1.3`, `http ^1.6.0`, `cupertino_icons ^1.0.8`, Flutter SDK |
| Versiones resueltas | go_router 15.1.3, http 1.6.0, cupertino_icons 1.0.9 |
| Desarrollo | `flutter_test` del SDK y `flutter_lints ^6.0.0` |

El SDK Flutter debe incluir Dart compatible con la restricción. No utilizar un
Dart anterior aunque otra versión de Flutter esté instalada. Conservar
`pubspec.lock` para reproducir las versiones. No actualizar herramientas como
parte de la instalación ordinaria.

## Arquitectura constatada

Organización por funcionalidades, con infraestructura compartida separada de la
presentación. No se han creado ViewModels, repositorios ni modelos de dominio.

| Ruta | Responsabilidad |
|---|---|
| `lib/main.dart` | Ejecuta `UniFundMeApp` |
| `lib/app/unifundme_app.dart` | Carga configuración, crea y libera el router; presenta errores de configuración |
| `lib/app/router/` | Rutas centralizadas y vistas privadas de acceso provisional y ruta desconocida |
| `lib/app/shell/main_shell.dart` | Contenedor y barra inferior Material 3 |
| `lib/app/theme/app_theme.dart` | Único tema claro; morado provisional y fuente del sistema |
| `lib/features/catalog/presentation/` | Explorar |
| `lib/features/tracking/presentation/` | Seguimiento provisional |
| `lib/features/notifications/presentation/` | Notificaciones provisionales |
| `lib/features/account/presentation/` | Cuenta y entrada al acceso provisional |
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
| `/explorar` | Primera sección |
| `/seguimiento` | Sección provisional |
| `/notificaciones` | Sección provisional |
| `/cuenta` | Sección provisional con «Ir a Acceso» |
| `/acceso` | Fuera de las pestañas; sin formulario ni autenticación |
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

`AppConfig` permite describir una URL HTTP de desarrollo, pero Android declara
`usesCleartextTraffic="false"` sin excepción debug. Aceptar la sintaxis no
acredita conectividad HTTP en dispositivo. Cualquier excepción futura necesita
justificación y autorización; no desactivar HTTPS ni validar certificados de
forma permisiva.

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
generar archivos temporales; no conectan las pantallas a Laravel. Las pruebas
HTTP utilizan exclusivamente MockClient. No utilizar `pub upgrade` para una
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
URL aprobada. Configurar una URL no realiza por sí solo solicitudes: las
pantallas siguen sin utilizar ApiClient.

### APK debug

```powershell
flutter build apk --debug --no-pub
```

Salida esperada: `build/app/outputs/flutter-apk/app-debug.apk`. El usuario
reportó una compilación satisfactoria y la auditoría constató un APK existente;
ver su identificación y límites en la matriz. No se ha acreditado APK release.

## Contrato del cliente base

`ApiClient` recibe `http.Client` y `AppConfig` por constructor; no está
instanciado por las pantallas. Expone GET, POST, PUT, PATCH, DELETE para JSON y
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

Los nombres de rutas en las pruebas son fixtures, no endpoints confirmados.
No se acreditó integración real Flutter–Laravel.

## Android y límites de la entrega

- Nombre visible: **UniFundMe**.
- Application ID y namespace: `com.unifoundme.movil`, conservados deliberadamente.
- Internet declarado en main; debug lo hereda. Profile conserva su declaración.
- Tráfico sin cifrar deshabilitado; sin certificados ni excepciones nuevas.
- La configuración release todavía referencia firma debug: **no es una firma
  definitiva de distribución**. Firma y APK release siguen pendientes.
- Acceso no autentica; catálogo, aportes, seguimiento y notificaciones reales
  corresponden a issues posteriores.
- El resultado reportado por el usuario es **98 pruebas superadas** en
  PowerShell normal y pruebas manuales en Samsung SM-N986N, Android 13.
  No confundir ese reporte con una ejecución independiente desde ChatGPT Work.

## Control de versiones y evidencia

Versionar fuentes, recursos Android de origen, manifiestos, configuración
compartida, lockfile, pruebas, README, documentación y metadatos Flutter.
Mantener fuera cachés, APK, archivos locales, claves, secretos y configuración
del IDE. Los iconos PNG de origen sí forman parte del proyecto.

La auditoría encontró la base móvil sin seguimiento; HEAD no identifica su
contenido. `git diff` vacío no significa que `movil/` esté versionado.
La propuesta de incorporación y los riesgos del wrapper y exclusiones están
en [el cierre técnico](docs/issue-24-cierre-tecnico.md). No se hicieron commits,
pushes, cierre de GitHub ni actualizaciones automáticas del Contexto Maestro.
