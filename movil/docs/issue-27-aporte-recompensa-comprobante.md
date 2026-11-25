# Issue #27 — Aporte, recompensa y comprobante móvil

Verificación: 25 de noviembre de 2026. EDT 3.4.
Issue: https://github.com/elingeyesdev/t3-crowdfunding-inversion/issues/27
Rama: feature/27-aporte-recompensa-comprobante-movil.
Base: Develop 116ef7b5ae5637f93605f698c0ce789f0f8de984, con #26 integrado.

## Comportamiento

Antes, el detalle no tenía flujo de aporte. Ahora permite entrar al formulario
protegido, completar el perfil mediante la pantalla existente, consultar/cargar
saldo simulado, elegir una recompensa opcional, revisar, confirmar y consultar el
PDF privado. Cuenta ofrece Mis comprobantes para recuperar documentos anteriores.
El seguimiento completo del donante sigue reservado al #28.

Laravel usa SALDO SIMULADO. La interfaz lo indica; no ofrece cobros bancarios ni
pasarelas. Capital no incluye moneda ni cambio de divisas: se distingue saldo de
moneda de campaña y no se inventan conversiones.

## Estado comprobado

| Elemento | Estado |
|---|---|
| Formulario protegido, retorno de login y revisión/cancelación | IMPLEMENTADO / PROBADO en widgets |
| Perfil, carga de saldo, recompensas y aporte | IMPLEMENTADO / PROBADO por HTTP real |
| Doble toque, pérdida de respuesta y cambio de sesión | IMPLEMENTADO / PROBADO con transporte controlado |
| Marcador cifrado por API/cuenta y recuperación | IMPLEMENTADO / PROBADO con almacenamiento inyectado |
| PDF Laravel y privacidad entre cuentas | PROBADO por HTTP real |
| Visor Android con zoom, páginas y reintento | IMPLEMENTADO; interacción Flutter PROBADA con canal simulado |
| Suite ordinaria | PROBADO: 359 correctas, siete HTTP omitidas |
| Tres pruebas HTTP del #27 | PROBADO: tres correctas |
| Análisis estático | PROBADO: sin incidencias |
| APK debug ARM64 | PROBADO: compila |
| Renderer PDF nativo en Samsung SM-N986N, Android 13 | PROBADO: una prueba correcta |
| Recorrido completo de la app contra Laravel en teléfono | PENDIENTE DE VERIFICACIÓN |
| Commit, push, PR y cierre | PENDIENTES; los realiza el usuario |

Las verificaciones son de la preparación en Linux. El instalador traslada el
código al clon Windows; sus verificaciones locales son independientes.

## Contratos inspeccionados

Todas las rutas están bajo /api/v1.

| Operación | Endpoint | Acceso |
|---|---|---|
| Campaña actual | GET campaigns/public/{uuid} | Público |
| Recompensas activas | GET campaigns/{uuid}/rewards | Público |
| Capital | GET investors/me/capital | Inversor autenticado |
| Cargar saldo simulado | POST investors/me/capital/add | Inversor autenticado |
| Aportar | POST investments | Inversor autenticado |
| Comprobantes propios | GET investments/me | Inversor autenticado |
| PDF propio | GET investments/{uuid}/receipt | Inversor; otra cuenta recibe 404 |

POST investments envía campaignId, amount decimal y rewardTierId opcional.
Su 201 devuelve data.ticket y remainingBalance. Eloquent puede omitir status en
el ticket recién creado: el default SQL es completed y el endpoint confirma la
operación completa. GET investments/me devuelve investmentStatus persistido.
La carga de capital devuelve newMax y availableCapital, sin crear un aporte.

Fuentes: web/routes/api.php, InvestmentController, InvestmentEngine,
RewardController, ProfileController y migraciones. Solo lectura. Código web,
dependencias y lockfiles no se modificaron.

## Implementación y límites

- features/contributions/domain/: dinero en centavos, coma/punto decimal sin
  miles ni exponentes. Porcentajes con cuatro decimales y productos BigInt.
- data/contribution_repository.dart: GET anónimos y operaciones privadas con
  token fijo mediante AppDependencies.authenticated.
- data/contribution_ledger.dart: intención cifrada antes de cada POST, separada
  de la sesión y aislada por API/cuenta. Permanece al salir o cerrar sesión.
  Un nonce impide que un resultado anterior borre un intento posterior.
- application/: validación, exclusión de envíos simultáneos y recuperación.
- presentation/: aporte, acceso por rol, comprobantes y visor. Cambio de
  generación de sesión destruye vistas privadas y oculta revisiones anteriores.
- MainActivity.kt: canal unifundme/receipt sobre cola de fondo y PdfRenderer.
  Temporal en cacheDir privado, eliminado al finalizar; descriptor, página,
  renderer y bitmap se liberan incluso ante errores.
- ApiClient.getBytes: límite opcional durante la recepción. PDF requiere firma
  %PDF- y máximo 10 MiB. Visor: hasta 200 páginas y bitmap de hasta 1600×3200.
- Rutas: /explorar/campanas/{uuid}/aportar, /comprobantes y /comprobantes/{uuid}.
  Se restringe retorno autenticado a rutas exactas; no hay URL externa con token.

Laravel vuelve a validar estado/plazo, propietario, saldo, mínimo/máximo,
restante, moneda y condiciones/cupo de recompensa. Nunca se presenta éxito
sin respuesta confirmada o comprobante coincidente recuperado.

Laravel no implementa clave de idempotencia. No hay reintento automático de POST.
Ante respuesta incierta/5xx se conserva la intención y se bloquea otra escritura
para esa cuenta/API. Un 401 conocido retira la intención rechazada aunque cambie
la generación de sesión.

Comprobar resultado consulta registros nuevos respecto del historial anterior,
con igual campaña, importe, moneda y recompensa. Una sola coincidencia permite
consultar el comprobante; no garantiza identidad transaccional entre dispositivos.
Si no hay coincidencias o hay varias, se mantiene el bloqueo y se pide revisión
con el responsable del sistema. Una carga incierta compara el límite de capital.
No hay botón que borre el marcador y repita a ciegas. Una garantía global de
exactamente una operación requiere soporte backend.

## Reproducción y pendientes

Desde movil/, Flutter 3.47.8 / Dart 3.13.7:

    flutter pub get --enforce-lockfile
    dart format --output=none --set-exit-if-changed lib test integration_test/receipt_renderer_test.dart
    flutter analyze --no-pub
    flutter test test --no-pub
    flutter build apk --debug --no-pub --target-platform android-arm64

HTTP real: PHP 8.4.27, migraciones y seeders actuales, SQLite temporal y loopback.
Se limpiaron base, cachés y almacenamiento y se verificaron hashes de configuración
web. Auxiliar de preparación fuera del repositorio. SQLite no acredita PostgreSQL.
Fixtures: UUID a0000000-0000-4000-8000- con sufijos 1/2/3 de doce dígitos.
Campañas de otro propietario: meta 1000, mínimo 10, máximo 500 BOB; 1/2 publicadas
con cero recaudado; 3 financiada con 1000. Recompensas 10/11 de 1/2 respectivamente:
importe 100, intervalo 10–20%, dos cupos, activas.

Solo con API aislada y esos fixtures:

    flutter test test/integration/laravel_contribution_http_test.dart --no-pub --dart-define=UNIFUNDME_TEST_API_URL=http://127.0.0.1:PUERTO/api/v1 --dart-define=UNIFUNDME_ISOLATED_TEST=true --dart-define=UNIFUNDME_CONTRIBUTION_FIXTURES=true

Prueba Android superada el 25/11/2026 en Samsung SM-N986N, Android 13:

    flutter test integration_test/receipt_renderer_test.dart -d ID_DEL_TELEFONO

Genera un PDF mínimo, invoca el renderer real, comprueba PNG y rechazos controlados.
El renderer nativo pasó en el dispositivo. Falta el recorrido completo con API
aprobada: perfil nuevo, saldo, recompensa, cancelar/confirmar, PDF y cambio de cuenta.
El APK compilado sin API_BASE_URL acredita compilación, no una sesión con servidor.
