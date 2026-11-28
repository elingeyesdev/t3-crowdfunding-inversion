# Issue #28 — Seguimiento del donante móvil

Fecha de verificación: 27/11/2026. EDT 3.5.
Issue: https://github.com/elingeyesdev/t3-crowdfunding-inversion/issues/28
Base: `4503f2c0b529c5e7d1dedeb5a241168419a713dd` de Develop.
Rama: `feature/28-seguimiento-donante-movil`.
Estado: IMPLEMENTADO y PROBADO en los alcances indicados. La entrega inicial fue
aplicada en Windows y recorrida por el usuario contra Render. El ajuste por rol
del 27/11 está probado en preparación y PENDIENTE de aplicar/verificar en Windows.
Continúa pendiente completar la prueba nativa de enlaces y confirmar todos los
estados de entrega. Sin commit ni PR creados durante la preparación; el usuario
realiza la publicación.

## Objetivo y cambio de estado

Antes: Seguimiento mostraba una pantalla provisional.
Ahora: el donante consulta sus aportes, recompensas y entregas, novedades de las
campañas respaldadas, recaudación actual e hitos publicados. La implementación
usa los contratos vigentes de Laravel y conserva los cambios web del compañero.
Solo se modificaron fuentes y documentación de `movil/`.

| Criterio | Implementación y evidencia |
|---|---|
| Consultar aportes propios | Historial con monto, moneda, referencia, fecha, estado y comprobante; PROBADO |
| Identificar reembolsos | Total separado del capital aportado vigente; PROBADO |
| No mezclar monedas | Totales por moneda y estado con unidades menores exactas y BigInt; PROBADO |
| Consultar recompensas | Estados pendiente, preparación, enviada, entregada, cancelada, incidencia y desconocido; PROBADO |
| Consultar entrega | Descripción, fecha estimada, guía, fechas de despacho/entrega y enlace externo; UI y contrato PROBADOS |
| Consultar novedades | Solo publicaciones públicas de campañas apoyadas, filtro por campaña y paginación de diez; PROBADO |
| Consultar avances | Recaudación e hitos con progreso, fechas y evidencias, independientes entre sí; PROBADO |
| Actualizar información | Arrastrar, botón, regreso a Seguimiento y reanudación de la app; navegación PROBADA |
| Proteger sesiones | Rol donante, rutas privadas, vaciado al cambiar generación y descarte de respuestas tardías; PROBADO |
| Abrir enlaces Android | Canal nativo compilado; rechazo de URLs probado en Dart y canal simulado; ejecución nativa PENDIENTE |
| Recorrido completo en teléfono | PENDIENTE DE VERIFICACIÓN |

## Contratos inspeccionados

| Endpoint bajo `/api/v1` | Uso |
|---|---|
| `GET investments/me` | Privado; historial y estados de aportes/recompensas del usuario autenticado |
| `GET investments/backed-campaigns/updates` | Privado; `page`, `limit=10`, `campaignId` opcional |
| `GET campaigns/public/{id}` | Público y sin token; recaudación y estado actual |
| `GET campaigns/{id}/milestones` | Público y sin token; hitos y evidencias publicables |
| `GET investments/{id}/receipt` | Privado; visor PDF ya implementado en #27 |

Fuentes: `web/routes/api.php`, `InvestmentController`, `CampaignReadController`,
`Api::page`, contratos frontend de seguimiento y modelos de hitos/recompensas.
El historial no está paginado en el backend; el cliente valida hasta 20.000
registros y ofrece búsqueda y filtros locales. No se inventa paginación remota.
Las novedades sí están paginadas y mantienen el orden del servidor. Si una
página desaparece por cambios de visibilidad, se vuelve una vez al inicio.

El endpoint de novedades incluye campañas con aportes completados o
reembolsados que siguen siendo públicas. No duplica novedades cuando un donante
aportó varias veces. Una campaña retirada sigue apareciendo en el historial
privado, pero su consulta pública devuelve un estado de no disponibilidad.
Los comprobantes propios siguen accesibles desde el historial.

## Compatibilidad con los cambios web

- El PR #122 integra #27 (`4af83fb`). La base actual también incorpora #123,
  #124 y #125: correo verificado, preferencias y cierre automático de campañas.
- El cierre puede devolver `investmentStatus=refunded` y una recompensa cancelada.
  La interfaz presenta ambos estados por separado y nunca los convierte en éxito
  o entrega pendiente por defecto. Un estado nuevo se muestra como desconocido.
- Los nuevos aportes requieren correo verificado. Las cuentas de las fixtures
  temporales están verificadas; para cuentas reales se conserva el proceso de
  correo del backend/web. #28 no añade ni evita esa verificación.
- No hay cambios en web, dependencias, lockfile ni configuración de producción.

## Archivos y decisiones

- `lib/features/tracking/domain/donor_tracking.dart`: proyecciones estrictas,
  estados, fechas y totales por moneda sin desbordamiento de enteros.
- `data/tracking_repository.dart`: consultas autenticadas y públicas, comprobación
  de IDs, metadatos y relación entre campaña e hitos.
- `application/tracking_controller.dart`: cargas independientes, recuperación,
  filtros de novedades, control de concurrencia y limpieza de sesión.
- `presentation/tracking_page.dart`: Aportes, Recompensas y Novedades; búsqueda,
  filtros, estados vacíos, errores y actualización.
- `presentation/tracking_campaign_page.dart`: recaudación e hitos de una campaña
  respaldada y sus aportes propios.
- `presentation/tracking_widgets.dart`: tarjetas, fechas, enlaces y evidencias.
- `app/router/`: nueva ruta privada `/seguimiento/campanas/:id`, retorno seguro
  desde Acceso y `InvestorGate` existente para eliminar vistas de otra sesión.
- `MainActivity.kt`: canal `unifundme/external` con intents web iniciados por el
  usuario; conserva el renderer PDF del #27.
- `test/features/tracking/`: contratos, controladores y pantallas.
- `test/features/auth/auth_test_support.dart`: aislar nuevas consultas de
  Seguimiento en escenarios cuyo objetivo es probar la autenticación.
- `test/integration/laravel_tracking_http_test.dart`: tres escenarios HTTP reales.
- `integration_test/`: comprobación nativa de enlaces, fixtures PHP y ejecutor
  PowerShell para reproducir la integración sin bases ni caches en el repositorio.

Los enlaces se abren con aplicaciones externas del teléfono y permiten copiar
la dirección si no existe un manejador. Se aceptan solo HTTP/HTTPS sin
credenciales. Las evidencias rechazan rutas privadas, KYC, traversal y escapes
mal formados. No se adjunta el token de la API a imágenes, vídeos ni enlaces.
El contenido se presenta como texto, sin ejecutar HTML del servidor.
Los totales no realizan conversiones de divisas. Las fechas civiles de entrega
estimada e hitos mantienen el día; las fechas de eventos se muestran en hora local.

## Verificaciones y límites de la evidencia

Preparación independiente con Flutter 3.47.8 y Dart 3.13.7:

- `flutter analyze --no-pub`: sin incidencias.
- `flutter test test --no-pub`: 391 correctas y diez HTTP omitidas por requerir
  servidor/fixtures explícitos. Incluye 32 pruebas nuevas del seguimiento.
- Tres pruebas HTTP del #28 correctas contra Laravel de la base `4503f2c`:
  historial y reembolso, novedades paginadas sin duplicados ni privadas, avances
  y aislamiento entre dos donantes.
- El ejecutor PowerShell también ejecutó esas tres pruebas en Linux con
  PowerShell 7. La ejecución en Windows PowerShell 5.1 sigue pendiente.
- `dart format --output=none --set-exit-if-changed lib test integration_test`:
  sin cambios pendientes.
- APK debug ARM64 compilado con el canal Android de enlaces.
- Pantalla de 320 px con texto ampliado, filtros, paginación, reintento, cambio de
  sesión, respuestas tardías y enteros grandes cubiertos por pruebas.

La validación del canal con un doble de prueba y la compilación no sustituyen
su ejecución real en Android. No se afirma un recorrido manual de esta versión.
Las siete pruebas HTTP históricas de #25–#27 no se reejecutaron en esta entrega;
sus resultados anteriores permanecen como evidencia histórica independiente.

## Reproducción en Windows

Desde `movil/`:

```powershell
flutter pub get --enforce-lockfile
flutter analyze --no-pub
flutter test test --no-pub
```

Con PHP >=8.3, extensiones bcmath/pdo_sqlite/mbstring/openssl/fileinfo/dom/xml y
`web/vendor/autoload.php` preparado mediante Composer:

```powershell
& .\integration_test\run_laravel_tracking_http.ps1
```

El ejecutor crea una base y directorios de cache en una carpeta temporal única,
usa correo en memoria y un servidor solo en loopback. Los entornos, archivos
locales y bases reales no se alteran. Restaura las variables de proceso y detiene
y elimina el entorno temporal al terminar, incluso ante fallos de pruebas.
Las fixtures verifican el entorno de pruebas y la ubicación temporal antes de
escribir. No se instalan herramientas ni se realizan operaciones Git.

Para recorrer #27 y #28 juntos con datos de prueba:

```powershell
& .\integration_test\run_laravel_tracking_http.ps1 -ServeOnly
```

Seguir los comandos mostrados en otra terminal. Cuentas exclusivamente locales:
`tracking28-donor@example.test` y `tracking28-other@example.test`, clave sintética
`SyntheticOnly28`. Mantener el servidor abierto y pulsar Enter al finalizar.
Permite consultar un reembolso, una recompensa enviada y otra cancelada, trece
novedades públicas y un hito al 60 %. La primera cuenta puede recargar saldo y
realizar un aporte nuevo siguiendo el flujo del #27.

Con un dispositivo autorizado:

```powershell
flutter test integration_test/tracking_links_test.dart -d ID_DEL_TELEFONO --no-pub
flutter test integration_test/receipt_renderer_test.dart -d ID_DEL_TELEFONO --no-pub
```

Recorrido manual pendiente: iniciar sesión con cada donante; buscar y filtrar
aportes; abrir comprobante; consultar recompensa, guía y enlace; pasar páginas y
filtrar novedades; abrir hitos; regresar y actualizar; realizar un aporte nuevo;
comprobar que aparece en Seguimiento y cambiar de cuenta sin ver datos anteriores.

## Ajuste de navegación por rol — 27/11/2026

Solicitud: separar la experiencia del donante y del emprendedor. El usuario
confirmó el cambio de cuenta, pero observó opciones de donante en la navegación
del emprendedor. Antes, `InvestorGate` bloqueaba esas operaciones al abrirlas;
la barra y el botón público Aportar seguían visibles para ambos roles.

Estado nuevo: IMPLEMENTADO en la copia de preparación. Una sesión autenticada
sin rol `investor` no muestra Seguimiento ni Aportar. Mis comprobantes ya estaba
condicionado al rol y se conserva esa regla. El router envía al catálogo los
enlaces de aportes, seguimiento y comprobantes de una cuenta sin ese permiso,
incluido el destino de retorno después del login. Las defensas de los repositorios
y de `InvestorGate` se conservan. Se respeta la unión de permisos cuando el
servidor asigna ambos roles a una cuenta.

La selección de Notificaciones y Cuenta usa el índice real de la rama, para
evitar que ocultar Seguimiento abra una pantalla distinta. El detalle público
escucha los cambios de sesión y actualiza la visibilidad de Aportar. Los invitados
conservan el acceso al flujo de autenticación para solicitar funciones privadas.

Archivos: `lib/app/shell/main_shell.dart`, `lib/app/router/app_router.dart`,
`lib/app/router/app_routes.dart`, `lib/features/catalog/presentation/campaign_detail_page.dart`,
`test/app/role_navigation_test.dart` y ajustes de las expectativas de acceso en
`test/features/contributions/contribution_pages_test.dart` y
`test/features/tracking/tracking_pages_test.dart`, además de esta documentación.

Verificación: suite completa con 400 pruebas superadas y diez HTTP omitidas;
nueve escenarios nuevos comprueban roles, índices, rutas directas, retorno del
login y cambio de sesión. La integración HTTP real contra el backend que se
desplegó en Render mantiene como evidencia las tres pruebas previas del #28.
Este ajuste no modifica el contrato HTTP, dependencias, Kotlin ni archivos web.

Evidencia manual reportada por el usuario el 27/11: ejecución normal en Samsung
SM-N986N Android 13 contra la URL HTTPS de Render, login, catálogo y detalle
públicos, aporte, PDF, recaudación, novedades, recompensa inicial y cambio de
cuenta. Los estados de preparación/envío/entrega no se dan por confirmados por
una respuesta que solo menciona el cambio de cuenta. La primera ejecución de
`tracking_links_test.dart` no completó sus pruebas; no se marca como superada por
el éxito posterior de `flutter run`. El reintento nativo y la verificación de la
separación por rol en el dispositivo permanecen PENDIENTES.

Alcance siguiente: el #26 ofrece catálogo y detalle públicos. Consultar campañas
propias (incluidos estados no públicos), publicar avances y actualizar datos
básicos desde el móvil pertenece al #29 y aún no está implementado. La integración
de avisos corresponde al #30. Este ajuste no añade pantallas provisionales para
presentar esas funciones como terminadas.

## Seguimiento de cierre

La implementación está APROBADA por la solicitud de continuar con el siguiente
issue y está IMPLEMENTADA y PROBADA en los alcances anteriores. El ajuste por rol
requiere aplicación y revisión en Windows; la prueba nativa de enlaces y los
estados de entrega aún requieren confirmación. El recorrido anterior reportado
por el usuario se distingue de las comprobaciones pendientes.
Después corresponde revisar el diff móvil, publicar la rama y solicitar revisión
mediante PR a Develop. No cerrar el issue ni marcar pendientes como probados por
el solo hecho de publicar. Tras la validación final, trasladar el resumen al
Contexto Maestro y al seguimiento de issues; no se sincronizan automáticamente.
