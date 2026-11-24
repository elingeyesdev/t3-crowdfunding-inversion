# Issue #26 — Catálogo y detalle de campaña móvil

Fecha: 24 de noviembre de 2026. Rama: `feature/26-catalogo-detalle-movil`.
Base: Develop `768c95eaf31b7e09f82fc66d34a363702013dde6`.
Issue: https://github.com/elingeyesdev/t3-crowdfunding-inversion/issues/26
Trazabilidad: EDT 3.3, RF-03 (catálogo público). No se inventan IDs de HU/Planner.

## Alcance y reconstrucción

Se reconstruyó en el nuevo clon la implementación adelantada del 19 de noviembre,
que quedó sin publicar en la computadora anterior. Se recuperaron las decisiones
del chat y se contrastaron con código actual; no se dispuso de sus archivos locales.
Los resultados anteriores son antecedentes, no pruebas de esta reconstrucción.

Incluye listado público, búsqueda, categoría, paginación de 20 elementos, refresco
y detalle con nombre, descripción, responsable, meta, monto recaudado, porcentaje,
estado, ubicación, fecha de cierre y portada cuando la API los proporciona.
Los aportes, recompensas, seguimiento y actualizaciones se implementan en sus
respectivos issues, sin botones que simulen transacciones terminadas.

## Estado comprobado de esta versión

| Elemento | Estado |
|---|---|
| Catálogo y detalle conectados a la API | IMPLEMENTADO |
| Búsqueda y filtro combinados, limpieza y dos páginas | IMPLEMENTADO y PROBADO |
| Vacío, error, reintento y 404 | IMPLEMENTADO y PROBADO |
| Respuestas tardías y disposición de controladores | PROBADO |
| Acceso público sin token | PROBADO con proveedor de token instrumentado |
| Pantalla 320×480 y texto al doble | PROBADO en widgets |
| `flutter analyze --no-pub` | PROBADO: sin incidencias |
| `flutter test test --no-pub` | PROBADO: 331 correctas, cuatro HTTP omitidas |
| HTTP real sobre Laravel actual | PROBADO: cuatro correctas; dos de catálogo y dos de perfiles |
| Base temporal, limpieza y configuración web conservada | PROBADO en el recorrido HTTP |
| APK debug de esta reconstrucción, destino ARM64 | PROBADO: compilación correcta; manifiesto y hash inspeccionados |
| Recorrido Android físico de esta versión | PENDIENTE DE VERIFICACIÓN |
| Commit, push y PR del #26 | PENDIENTES; los publica el usuario |

Entorno de pruebas: Flutter 3.47.8, Dart 3.13.7 y PHP 8.4.27, preparados fuera
del repositorio con autorización del usuario. Android se compiló con JDK 21.0.13,
plataformas Android 35/36 y NDK 28.2.13676358. Dependencias instaladas desde
los lockfiles, sin actualizar versiones del proyecto. Flutter se ejecutó con
`CI=true`, `FLUTTER_SUPPRESS_ANALYTICS=true` y `DASH__SUPPRESS_ANALYTICS=true`:
el modo CI evita la consulta de detección de Azure y la analítica queda desactivada.
No se accedió al servicio de metadatos para completar las pruebas.

## Contratos inspeccionados

Fuentes: `web/routes/api.php`, `web/app/Http/Controllers/CampaignController.php`,
`web/app/Models/Campaign.php` y `web/app/Support/Api.php`. Solo lectura.

| Operación | Endpoint bajo `/api/v1` | Lectura |
|---|---|---|
| Categorías | `GET categories` | Lista `data`, UUID y nombre visible |
| Catálogo | `GET campaigns/public` | `data.data` con `data.meta` |
| Detalle | `GET campaigns/public/{uuid}` | Campaña en `data`; 404 si no es legible |

Parámetros: `q`, `categoryId`, `page`, `limit=20`, `sortBy=created_at`,
`sortOrder=DESC`. Laravel añade orden secundario por ID. El catálogo activo
incluye published, partially_funded y funded. El detalle histórico completed/failed
solo es legible según la política backend; un UUID conocido no hace pública una campaña.

El cliente valida envoltura, UUID, identidad de detalle, página solicitada,
metadatos e importes finitos no negativos. Tolera opcionales y campos nuevos
sin retener datos privados. Las cantidades se muestran con moneda y dos decimales;
el porcentaje real se conserva y solo se limita la barra visual al 100 %.

## Arquitectura y comportamiento

- `lib/features/catalog/domain/public_campaign.dart`: modelos públicos y consultas.
- `data/catalog_repository.dart`: lecturas anónimas y validación del contrato.
- `application/catalog_controller.dart`: carga, errores, paginación y detalle.
  Invalida respuestas anteriores al cambiar filtros, ID o destruir la pantalla.
- `presentation/explore_page.dart`: búsqueda explícita, categorías, refresco,
  carga adicional y mensajes distinguibles. Fallar las categorías no bloquea
  la lectura del catálogo. Fallar una página adicional conserva lo cargado.
- `presentation/campaign_detail_page.dart`: lectura pública, reintento y retorno
  al catálogo, con o sin pila previa.
- `presentation/campaign_widgets.dart`: importes, progreso, tarjetas y portadas.
  HTTPS o rutas relativas al origen; HTTP solo en desarrollo y del mismo origen.
  Sin credenciales en imágenes; alternativa estable si la portada falta o falla.
- `lib/app/router/`: detalle `/explorar/campanas/:id` sobre el navegador raíz,
  fuera de las pestañas y conservando el catálogo al volver.
- `lib/core/network/api_client.dart` y `features/auth/application/app_dependencies.dart`:
  GET público explícito, compartiendo transporte sin consultar la sesión.
- `test/features/catalog/`: 30 pruebas de contrato, controladores y widgets.
- `test/integration/laravel_catalog_http_test.dart`: dos pruebas HTTP optativas.

Sin URL configurada, Explorar presenta el error de configuración sin peticiones.
No hay reintentos automáticos ni escrituras de dominio desde el catálogo.

## Validación reproducible

Desde `movil/`, en PowerShell normal:

```powershell
flutter pub get --enforce-lockfile
dart format --output=none --set-exit-if-changed lib test
flutter analyze --no-pub
flutter test test --no-pub
flutter build apk --debug --no-pub --target-platform android-arm64
```

Estos comandos preparan dependencias/cachés y generan el APK, sin actualizar Git.
El APK verificado tiene 87.702.560 bytes y SHA-256
`f9818d89763f1d46850b2f8b631809a694c2422d2d4e41372742ebdc960f9a10`.
Se comprobó `com.unifoundme.movil`, versión 1.0.0, target SDK 36 y permiso Internet.
Se compiló sin API_BASE_URL: valida la compilación, no una sesión Android contra
un servidor. Para usar el catálogo en teléfono hay que compilar/ejecutar con la
URL real mediante `--dart-define=API_BASE_URL=...`, como explica README.
Las cuatro HTTP se omiten en la suite ordinaria. Requieren una instancia Laravel
local exclusivamente de pruebas, con base, cachés y almacenamiento separados y roles
del seeder. Los indicadores siguientes confirman la elección del operador; Flutter
no inspecciona la base del servidor para verificar el aislamiento.

Fixtures de catálogo: 24 campañas públicas, una draft privada y una completed
con `published_at`; IDs `a0000000-0000-4000-8000-` con sufijos decimales 1 a 26 de
12 posiciones. Alternar Tecnología y Educación (12 públicas por categoría),
ordenar con fechas distintas; primera campaña `Campana de prueba 01`, meta 1000 BOB,
recaudado 250, responsable `Responsable de prueba` y descripción con `API real`.

```powershell
$catalogTestApi = Read-Host 'URL local de pruebas aislada, terminada en /api/v1'
flutter test test/integration --no-pub "--dart-define=UNIFUNDME_TEST_API_URL=$catalogTestApi" --dart-define=UNIFUNDME_ISOLATED_TEST=true --dart-define=UNIFUNDME_CATALOG_FIXTURES=true
```

La ejecución realizada migró y sembró SQLite temporal, inició PHP en loopback y
ejecutó las cuatro pruebas convencionales por HTTP real; detuvo su servidor,
eliminó su directorio temporal y comprobó hashes de configuración web. La preparación
auxiliar quedó fuera del repositorio y no se publica. SQLite no acredita concurrencia
ni particularidades de PostgreSQL.

## Comprobación Android pendiente

Usar la API real aprobada o una instancia local aislada mantenida abierta. Para
loopback por USB, pasar su puerto real a `adb reverse` y la URL exacta a Flutter;
HTTP local está habilitado solo en debug para localhost/127.0.0.1/10.0.2.2.

1. Como invitado, listar y abrir campañas sin iniciar sesión.
2. Leer título, descripción, responsable, meta, recaudación y porcentaje.
3. Volver al catálogo y comprobar que conserva filtros y desplazamiento.
4. Buscar, combinar categoría, limpiar filtros y cargar la siguiente página.
5. Comprobar búsqueda sin resultados y recuperación al fallar/reanudar la API.

Antes de publicar: revisar diff, comprobar si Develop avanzó, repetir controles
si cambia el código y solicitar revisión cruzada. La publicación corresponde al
usuario; este trabajo no actualiza automáticamente otros chats ni cierra GitHub.
