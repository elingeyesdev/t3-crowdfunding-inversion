# UniFundMe — Laravel + React

La aplicación se ejecuta desde `web/` con Laravel 13, PHP 8.4.1 o superior y React 19. La interfaz original permanece en `web/frontend/src`; Laravel sirve las páginas, la API y los archivos. Vite compila React y Tailwind desde `web/vite.config.ts`. Los comandos y rutas del resto de esta guía son relativos a `web/`.

## Arranque en este equipo

La configuración local ya apunta a `database/migrated.sqlite`, que contiene la importación de PostgreSQL. No ejecutes `migrate:fresh` sobre esa base.

```powershell
cd web
composer dev
```

Abre **http://localhost:8765**. El comando inicia Laravel, Vite y Reverb. Para usar los archivos ya compilados bastan dos terminales:

```powershell
php artisan serve --port=8765
php artisan reverb:start
```

En este equipo se usan los puertos 8765 (Laravel), 8766 (Vite) y 9091 (Reverb), porque los puertos anteriores no respondían. `npm run build` elimina el marcador temporal `public/hot` para que Laravel sirva la compilación y no intente conectarse a un Vite detenido.

No hace falta iniciar NestJS. `backend/` conserva el código anterior y los archivos originales como referencia para verificar la migración.

## Instalación en otro equipo

Requisitos con los lockfiles actuales: PHP 8.4.1+, Composer, Node 24.15+ (la rama 24 está indicada en `web/.nvmrc`) y extensiones PHP habituales de Laravel, incluyendo PDO SQLite o PDO MySQL, BCMath, Fileinfo y Mbstring.

```powershell
Copy-Item .env.example .env
composer install
php artisan key:generate
New-Item -ItemType File database/unifundme.sqlite
php artisan migrate --seed
php artisan storage:link
npm ci
npm run build
composer dev
```

El seeder crea roles y categorías, sin usuarios ni contraseñas predeterminadas. Para crear el primer administrador:

```powershell
php artisan app:create-admin administrador@example.com --super
```

La contraseña se solicita de forma privada. Los usuarios importados conservan sus correos y contraseñas anteriores; deberán iniciar sesión de nuevo porque los tokens de NestJS no se reutilizan.

## Funciones migradas

- Registro, login, logout y roles mediante Laravel Sanctum; compatibilidad con hashes bcrypt de Node.
- Google OAuth mediante Socialite, con validación de `state` y correo verificado.
- Perfiles, imágenes, verificación KYC y revisión administrativa.
- Campañas, categorías, recompensas por porcentaje, documentos, actualizaciones e historial de estados.
- Inversiones con bloqueo de filas, saldo simulado, ledger, notificaciones y reembolsos transaccionales.
- Historial de inversiones, comprobantes PDF, reportes CSV/PDF y estadísticas.
- Comentarios, likes, notificaciones y chat privado con Laravel Reverb y Echo.
- Asistentes de soporte y campañas usando la configuración `DEEPSEEK_API_KEY`.

Los editores de campañas utilizan el estado de guardado independiente del listado. Durante la petición se bloquean los campos, las acciones de cierre y los envíos repetidos. Si la API rechaza la creación o edición, el editor conserva los datos y archivos elegidos, enfoca el mensaje de error y permite corregir o reintentar. Descartar y abrir otro editor limpia el error anterior. Las regresiones de `campaign-saving.test.mjs` y `campaign-saving.spec.ts` cubren estos recorridos.

Una vez guardados los datos, el editor informa por separado del estado de cada portada y documento. Si alguna subida falla, conserva los archivos en memoria y permite **Reintentar subidas pendientes** sobre la misma campaña, sin repetir la creación o edición ni los archivos confirmados. Los datos del formulario quedan bloqueados durante esta recuperación. Si falla el envío posterior a revisión, el reintento reutiliza el guardado y las subidas completadas. Cerrar el editor requiere confirmación: conserva la campaña y los archivos recibidos, pero los pendientes deberán seleccionarse de nuevo al abrirlo; tampoco se conservan tras recargar la página.

**Requiere migración:** ejecuta `php artisan migrate` desde `web/` antes de usar esta recuperación. Añade campos opcionales de identificación a `campaign_documents`, sin modificar documentos existentes. El cliente web envía un `uploadId` estable por documento: repetirlo con el mismo archivo, nombre y justificación devuelve el documento recibido; cambiar su contenido devuelve 409. Los clientes que omiten ese identificador conservan el comportamiento anterior. Una portada idéntica a la actual reutiliza su archivo. Estas medidas cubren respuestas de subida perdidas; no hacen idempotente la petición inicial de creación de una campaña.

Al editar una campaña, el formulario consulta y muestra por separado los documentos guardados y los archivos nuevos. Un documento pendiente de revisión o aprobado satisface el requisito de respaldo sin volver a subirse. Los rechazados conservan sus observaciones y enlaces para consulta; por sí solos no satisfacen el requisito de respaldo. Mientras la consulta carga o falla, se bloquea el guardado y el envío a revisión; puedes seguir editando y reintentar la consulta sin perder campos ni archivos nuevos. **Actualizar documentos guardados** renueva la lista y los enlaces de descarga. Guardar conserva los documentos existentes y solo sube los nuevos; quitar un archivo nuevo de la selección no elimina ningún documento del servidor. Esta corrección del editor no requiere una migración adicional.

Después de Google, `/auth/callback` consulta `/api/v1/auth/me` con el token opaco de Sanctum y completa la sesión con la identidad y los permisos confirmados por Laravel. No decodifica el token ni utiliza el usuario o rol de la URL para decidir el acceso. Limpia datos anteriores y dirige al donador, emprendedor, administrador o superadministrador a su panel correspondiente. Un fallo temporal ofrece reintento; un acceso inválido permite volver al login sin guardar una sesión parcial. El token pendiente permanece solo en memoria, se retira de la URL y el HTML del callback utiliza `no-store` y `no-referrer`. Recargar ese callback mientras aún está pendiente requiere iniciar el acceso nuevamente. Las pruebas locales del callback no sustituyen una validación con Google real.

El área del donador distingue consultas pendientes, historial vacío, perfil inexistente y errores. El dashboard consulta el resumen y el historial por separado y reutiliza el mismo historial para aportes, recompensas, comprobantes y estadísticas. Un error del historial no se interpreta como un perfil inexistente. En el perfil, un fallo de consulta no abre el formulario de creación: solo una ausencia confirmada permite ese recorrido. Los fallos temporales ofrecen reintento y un HTTP 401 ofrece iniciar sesión. Durante una recarga o tras un fallo se ocultan los resultados anteriores de la consulta afectada, sin modificar los datos guardados. Las regresiones `donor-query-states.test.mjs` y `donor-query-states.spec.ts` cubren estos estados y su recuperación. No requiere migraciones.

La API conserva `/api/v1` y los contratos usados por React, incluyendo paginación y campos en camelCase. Las vistas de administración conservan sus respuestas en snake_case. Consulta todas las rutas con `php artisan route:list --path=api/v1`. La mensajería agrega `POST /chat/conversations/{id}/messages` y `POST /broadcasting/auth` dentro del mismo prefijo.

Los endpoints temporales de creación de superadministrador y publicación de historias de prueba se sustituyeron por operaciones locales y autenticadas. KYC y documentos nuevos se guardan fuera de `public/` y se sirven con enlaces firmados de 15 minutos.

## Tipos de campaña web

Las modalidades disponibles son `donation` (Donación) y `reward` (Con recompensas). El formulario permite elegirlas y envía `campaignType`; la API conserva ese valor al editar, revisar, publicar y consultar campañas. Crear sin ese campo mantiene el valor predeterminado `donation`. Los aportes usan saldo simulado y la selección de una recompensa es opcional en ambas modalidades; no se implementan pagos reales ni participación accionaria.

Las campañas históricas `equity` y de tipos desconocidos conservan su valor original y su historial. La web identifica expresamente la modalidad no disponible, sin convertirla en donación. No se permite crear, editar, enviar a revisión, aprobar, publicar ni recibir nuevos aportes en esas modalidades. La consulta y las operaciones existentes de cierre, cancelación y reembolso mantienen sus reglas habituales. El catálogo permite filtrar por modalidad, incluido `equity` histórico; la API también admite filtrar por otros valores históricos exactos.

Este cambio no requiere migraciones ni conversiones de datos. Las respuestas públicas usan `campaignType` y las administrativas `campaign_type`; ambos exponen el tipo original. Los campos alternativos `type` y `campaign_type` no se aceptan para crear o editar desde la API web.

## Recuperación de contraseña web

Desde «Olvidé mi contraseña» en el login se solicita un enlace en `/forgot-password`. El correo abre `/reset-password`; el enlace caduca a los 60 minutos y solo se puede usar una vez. Cambiar la contraseña revoca todos los tokens de acceso y las sesiones de base de datos de esa cuenta. Las cuentas que utilizan exclusivamente Google deben continuar con Google; las cuentas vinculadas a Google que también tienen contraseña local sí pueden recuperarla.

La solicitud responde con el mismo mensaje para cualquier dirección válida. El envío se procesa en una cola separada para que la respuesta no revele si existe la cuenta. Además de Laravel, Vite y Reverb, inicia este trabajador desde `web/`:

```powershell
php artisan queue:work database --queue=password-recovery --sleep=1 --tries=3
```

`PASSWORD_RESET_QUEUE_CONNECTION` selecciona la conexión del trabajador (por defecto `database`); si la cambias, usa esa conexión en el comando. No admite `sync`. Ejecuta las migraciones habituales para disponer de las tablas de cola y recuperación. En producción mantén el trabajador mediante el supervisor de procesos y reinícialo con `php artisan queue:restart` después de desplegar cambios. Los envíos fallidos se reintentan hasta tres veces; revisa `php artisan queue:failed` antes de reintentarlos con `queue:retry`.

El valor predeterminado `MAIL_MAILER=log` registra el correo en el log y **no entrega mensajes**. Para un capturador SMTP local configura `MAIL_MAILER=smtp`, `MAIL_HOST=127.0.0.1` y `MAIL_PORT=1025`, con credenciales vacías. Para entregar a buzones reales configura los datos SMTP del proveedor, un remitente autorizado y su transporte seguro. `APP_URL` debe apuntar al origen público correcto (HTTPS en producción), ya que determina el enlace del correo. Tras cambiar configuración en un despliegue con caché, ejecuta `php artisan config:cache` y reinicia el trabajador.

La API pública ofrece `POST /api/v1/auth/forgot-password` (`email`) y `POST /api/v1/auth/reset-password` (`email`, `token`, `password`, `password_confirmation`). Exige contraseñas de 8 a 128 caracteres, con mayúscula y número. Limita solicitudes de enlace a una por minuto por correo y cinco por minuto por IP, y restablecimientos a diez por minuto por IP. Solicitar otro enlace después del período de espera invalida el anterior.

La prueba `php artisan test --filter=PasswordRecovery` usa una base SQLite en memoria y un capturador SMTP efímero en `127.0.0.1`, sin envío externo; comprueba el correo recibido y utiliza su enlace para restablecer la contraseña.

## Verificación de correo web

Las cuentas locales pueden enviar y reenviar su enlace desde **Configuración de Cuenta**. No se envía automáticamente al registrarse: la solicitud se hace desde la sesión de la cuenta. El enlace abre `/verify-email`, exige iniciar sesión con esa misma cuenta y confirmar mediante un botón. Abrir el enlace por GET no modifica la cuenta. La firma protege la cuenta, la dirección y el vencimiento de 60 minutos; los enlaces dejan de servir si cambia el correo. Reenviar no invalida enlaces anteriores todavía vigentes. Confirmar varias veces no repite el evento de verificación.

**Política:** todas las cuentas, incluidas las existentes, necesitan correo verificado para realizar aportes y para enviar campañas a revisión o publicarlas. Se conserva el estado anterior de cada usuario, sin verificar automáticamente cuentas pendientes. Se mantienen disponibles el login, exploración, configuración, recuperación de contraseña, edición de perfiles y borradores, e historial de aportes. La verificación de correo y la revisión de identidad KYC son requisitos independientes. Los correos verificados por Google conservan su verificación; una nueva autenticación de Google con correo verificado también confirma una cuenta vinculada coincidente.

El envío usa el mismo servicio SMTP que la recuperación, con una cola separada. Desde `web/`, inicia:

```powershell
php artisan queue:work database --queue=email-verification --sleep=1 --tries=3
```

`EMAIL_VERIFICATION_QUEUE_CONNECTION` selecciona la conexión (por defecto `database`, nunca `sync`); usa esa conexión en el comando. También puedes atender ambas colas con `--queue=email-verification,password-recovery`. El trabajador debe mantenerse activo y reiniciarse tras desplegar. Se reintenta hasta tres veces; los fallos persistentes aparecen en `queue:failed`. Con `MAIL_MAILER=log` el correo solo se escribe en el log; configura SMTP para entregarlo. `APP_URL` determina el origen público de los enlaces y debe usar HTTPS en producción. Un trabajo pendiente se descarta si la cuenta fue verificada, desactivada, eliminada o cambió de correo.

La API autenticada permite `POST /api/v1/auth/email/verification` (sin email en el cuerpo; siempre usa el de la sesión), limitado a una solicitud por minuto por cuenta y cinco por IP. `POST /api/v1/auth/email/verify/{id}/{hash}` confirma la URL firmada recibida por correo, con límite de diez intentos por minuto por IP. Las operaciones restringidas responden `403` con código `EMAIL_VERIFICATION_REQUIRED` y las interfaces muestran cómo ir a verificar. No hay cambios de esquema ni migración de los usuarios existentes para este flujo.

## Notificaciones de actividad por correo

La preferencia **Notificaciones por correo** controla avisos individuales de eventos nuevos; no genera resúmenes periódicos ni envía notificaciones históricas. Se conservan las preferencias existentes y sus valores predeterminados. La campana web y el correo son canales independientes: desactivar la campana no desactiva el email. Cada categoría desactivada y cada exclusión por evento se respeta en ambos canales. Los correos de recuperación y verificación de cuenta no dependen de estas preferencias.

| Eventos | Preferencia adicional al canal de correo |
| --- | --- |
| Aporte confirmado, recibido o reembolsado | `investmentAlerts` |
| Estados de campaña: borrador, envío/revisión, aprobación/rechazo, publicación, financiación, cierre, cancelación o suspensión | `campaignStatusUpdates` |
| Comentarios y mensajes privados nuevos | `commentAlerts` |
| Avance publicado e hito completado | `milestoneUpdates` |
| Revisión KYC, recompensa enviada/entregada, documento aprobado/rechazado, auditoría de movimiento verificado/rechazado/con observaciones/pendiente | Preferencia general y exclusión por evento en `categories` |

Solo se envía a cuentas activas con correo verificado. Se vuelven a consultar estos requisitos, la dirección original y las preferencias al procesar cada trabajo. Si cambiaron, el envío queda `skipped`; no se recupera automáticamente al reactivar preferencias. Los mensajes de chat solo avisan de un mensaje nuevo, sin copiar el contenido privado. Los enlaces del correo apuntan al origen configurado en `APP_URL` y requieren la autenticación y permisos habituales para acceder a información privada.

Para habilitar el canal usa **SMTP** (`MAIL_MAILER=smtp`), remitente y credenciales del proveedor, `APP_URL` correcto y `ACTIVITY_MAIL_ENABLED=true`. En producción configura TLS según el proveedor. `log` y `array` no se consideran entrega disponible para estos avisos. `ACTIVITY_MAIL_QUEUE_CONNECTION` admite conexiones `database`, `redis`, `sqs` o `beanstalkd`; por defecto usa `database`. La API de preferencias informa `emailChannel.available` y `reason` sin exponer credenciales. Ese estado indica configuración y elegibilidad, no comprueba la conexión SMTP ni que el trabajador esté activo.

Este cambio **requiere una migración** para crear `activity_email_deliveries`. Desde `web/`:

```powershell
php artisan migrate
php artisan queue:work database --queue=activity-mail --sleep=1 --tries=3
php artisan schedule:work
```

Puedes usar un trabajador para `--queue=email-verification,password-recovery,activity-mail`. Si cambias la conexión, usa la misma en el comando. En producción mantén los trabajadores mediante un supervisor y ejecuta `schedule:run` cada minuto desde el programador del sistema. Después de desplegar, actualiza la caché de configuración y ejecuta `queue:restart`. El programador recupera cada minuto los envíos pendientes que no pudieron entrar a la cola; espera diez minutos antes de reencolar un trabajo ya despachado. El aviso y su registro de envío se guardan dentro de la transacción del evento y solo se encolan después del commit, sin esperar al SMTP en la petición web.

Cada envío conserva estado, intentos, resultado y un `Message-ID` estable, independientemente de que el usuario elimine el aviso de la campana. Un trabajo repetido no vuelve a enviar una fila `sent`. Los fallos al conectar/autenticar SMTP antes de enviar el mensaje se reintentan hasta tres veces, con esperas de 30 y 120 segundos. Los estados son `pending`, `sending`, `sent` (aceptado por SMTP, no confirmación de llegada al buzón), `skipped`, `failed` y `uncertain`.

```powershell
php artisan notifications:mail-status --status=failed
php artisan notifications:mail-status --status=uncertain
php artisan notifications:dispatch-mail --retry-failed
```

El último comando reintenta únicamente fallos de conexión seguros. **SMTP no garantiza una entrega exactamente una vez** si se pierde la respuesta tras aceptar un mensaje. Por eso, los errores posteriores a la conexión y los intentos interrumpidos que permanecen en `sending` más de dos minutos se marcan `uncertain` y no se reenvían automáticamente, ni mediante `queue:retry`. Revisa los registros del proveedor usando el `Message-ID` antes de decidir cualquier reenvío manual. El comando de estado omite destinatarios y contenido; la tabla contiene una copia privada del correo y su mensaje, que debe protegerse como el resto de los datos de cuenta.

Para probar sin entrega externa: `php artisan test --filter=ActivityMail`. La integración levanta un capturador SMTP efímero en `127.0.0.1`, verifica el correo recibido y comprueba que reprocesar el trabajo no lo duplique.

## Cierre automático de campañas vencidas

El programador revisa cada minuto las campañas `published`, `partially_funded` y `funded` con `end_date` definido y menor o igual al instante actual. Las fechas almacenadas se interpretan en `America/La_Paz`, igual que el resto de la aplicación; el límite es inclusivo y conserva el instante de entradas con UTC u otros offsets. Alcanzar la meta antes del vencimiento no adelanta el cierre automático.

Una campaña que alcanzó la meta pasa a `completed`, conservando sus aportes y recompensas. Si no la alcanzó, pasa a `failed`: se devuelve el saldo simulado de cada aporte completado, se registran transacciones y movimientos de reembolso, se cancelan las reclamaciones de recompensas, se liberan sus cupos y se actualizan los totales de campaña y emprendedor. Los aportes a otras campañas conservan su saldo comprometido. El contador histórico de aportes del donador mantiene el comportamiento del cierre manual.

Quedan fuera los borradores, estados de revisión, aprobadas sin publicar, suspendidas, canceladas, completadas, fallidas, campañas futuras y campañas sin fecha. El cierre manual continúa disponible con sus reglas actuales, incluso antes de vencer. Ambos caminos usan la misma transacción financiera. El automático registra `changed_by=null` con el motivo «Cierre automático por fecha de vencimiento»; las consultas de historial identifican al autor como «Sistema (cierre automático)». No se crea una cuenta ficticia ni se atribuye la acción al emprendedor.

Desde `web/`, puedes revisar candidatos sin escribir datos y ejecutar el proceso explícitamente:

```powershell
php artisan campaigns:close-expired --dry-run
php artisan campaigns:close-expired
```

`--chunk=100` controla cuántos candidatos se leen por lote (entre 1 y 1000); todos los lotes se procesan en la misma ejecución. La simulación muestra candidatos, pero no valida que todos sus datos financieros estén completos. Antes de habilitar el programador en una instalación existente, revisa la simulación: también serán elegibles campañas históricas que sigan activas y vencidas. Este issue no requiere migraciones nuevas.

La ejecución programada está habilitada por defecto con `CAMPAIGN_AUTO_CLOSE_ENABLED=true`. Puedes pausarla con `false`; el comando explícito sigue disponible. Tras cambiar configuración con caché, reconstruye la caché habitual. En desarrollo mantén `php artisan schedule:work` activo. En producción ejecuta `php artisan schedule:run` cada minuto desde el programador del sistema. El cierre financiero no usa una cola adicional; sus correos, si están habilitados, utilizan la cola `activity-mail` documentada arriba.

El programador utiliza un bloqueo de caché con vencimiento de cinco minutos para evitar ejecuciones solapadas. En varios servidores usa una caché compartida si quieres coordinar ese bloqueo. La integridad financiera no depende de él: cada cierre bloquea y vuelve a leer la campaña dentro de la transacción, antes de modificar saldos. Si otro proceso ya cerró la campaña o cambió la fecha/estado, el automático la omite; el manual conserva su respuesta `422` al intentar cerrar una campaña ya finalizada. Los movimientos de reembolso conservan además su unicidad por aporte y origen.

Si una campaña falla, se revierte su transacción completa, incluidos historial, avisos y correos pendientes; las demás campañas siguen procesándose. Los bloqueos/deadlocks reconocidos se reintentan hasta tres veces dentro de la operación. Una campaña que continúa fallando permanece elegible para la siguiente ejecución del minuto, sin duplicar devoluciones ya confirmadas. El comando devuelve código `1` cuando hay fallos, `2` ante parámetros inválidos y `0` cuando termina sin fallos. Su resumen muestra seleccionadas, cerradas, omitidas y fallidas. Supervisa la salida del programador y los mensajes `Automatic campaign closure failed`/`summary` del log, que incluyen el ID de campaña. Corrige datos incompletos u otros errores persistentes antes de reintentar. Tras una terminación abrupta, el bloqueo de programación puede demorar el siguiente intento hasta cinco minutos; no elimines bloqueos de otros procesos activos.

Validación automatizada:

```powershell
php artisan test --filter="CampaignAutomaticClosureTest|CampaignClosureConcurrencyTest|CampaignClosingTimeTest"
```

La prueba de concurrencia utiliza una base SQLite temporal aislada y dos procesos PHP independientes, tanto para automático/automático como para automático/manual. Comprueba un solo cierre, reembolso, movimiento, liberación de cupo y aviso por destinatario. No utiliza la base local de la aplicación. **SQLite no reproduce los bloqueos por fila de MySQL/PostgreSQL.** Antes de desplegar en otro motor, repite en una base de pruebas aislada de ese motor: prepara una campaña vencida con aportes y recompensas, lanza dos comandos simultáneos y luego combina un comando con una petición de cierre manual. Verifica un único historial final, una transacción y un movimiento de reembolso por aporte, saldos correctos, reclamaciones canceladas y avisos no duplicados. Repite la ejecución después de provocar un fallo y confirmar la reversión completa.

## Suspensión y reactivación de cuentas

La gestión de usuarios permite suspender, reactivar y consultar el historial de una cuenta. Ambas acciones requieren un motivo de 3 a 2000 caracteres. La interfaz solo ofrece las acciones autorizadas por el servidor, conserva el motivo ante errores y actualiza el estado únicamente con la respuesta confirmada. Un cambio de cuenta no elimina perfiles, campañas, aportes, recompensas ni sus historiales; tampoco cambia roles, contraseñas o verificaciones. Reactivar una cuenta no vuelve a publicar campañas suspendidas ni modifica permisos particulares de su perfil administrativo.

| Operador | Cuentas que puede suspender/reactivar y cuyo historial puede consultar |
| --- | --- |
| Administrador | Usuarios sin roles ni perfil administrativos |
| Superadministrador | Usuarios comunes y administradores comunes |

La propia cuenta y todos los superadministradores están protegidos en ambas operaciones. Si un perfil administrativo identifica al destinatario como superadministrador, esa protección también se aplica aunque sus roles estén desalineados. El operador debe estar activo y conservar un token válido. Si tiene perfil administrativo, ese perfil debe estar activo y permitir `can_manage_users`; para cuentas heredadas con rol administrativo pero sin perfil se conserva la autorización basada en roles. La política se comprueba nuevamente dentro de la transacción, sin confiar en los permisos o identificadores de actor enviados por el navegador.

**Requiere migración:** `php artisan migrate` desde `web/` crea `user_status_history` y añade `users.status_version`. Las cuentas existentes conservan su estado; no se inventan motivos, responsables ni fechas para suspensiones antiguas. El historial registra cada transición nueva, con actor, fecha, motivo, estado anterior/nuevo y versión. Su consulta es administrativa, paginada a 20 entradas y ordenada de la más reciente a la más antigua. El modelo impide modificar o eliminar entradas mediante Eloquent; la referencia de la cuenta impide borrarla físicamente mientras conserve historial.

La API web usa `PATCH /api/v1/admin/users/{id}/status` con `isActive`, `reason` y `expectedVersion` (obtenida de `status_version` en la lista). Una solicitud antigua que intenta cambiar un estado distinto del confirmado recibe `409`: cierra el diálogo, actualiza la lista y revisa la cuenta antes de repetirla. Repetir una solicitud cuyo estado ya coincide con el actual no crea otra entrada ni revoca una sesión nueva. `DELETE /api/v1/admin/users/{id}` se conserva como alias de suspensión, exige `reason` y acepta `expectedVersion` opcional. `GET /api/v1/admin/users/{id}/status-history?page=1` consulta el historial. La lista devuelve `can_suspend`, `can_reactivate` y `can_view_history` según el operador actual.

Cada cambio bloquea y vuelve a leer al operador y al destinatario, actualiza el estado y su versión, revoca todos los tokens de acceso, renueva `remember_token`, elimina sus sesiones de base de datos y registra el historial en una sola transacción. Si falla alguna parte, se revierte todo. La reactivación también elimina tokens que pudieran conservar suspensiones heredadas. El usuario debe iniciar sesión nuevamente; no se restauran tokens revocados. La emisión de tokens de login y Google se serializa con estos cambios y rechaza una cuenta inactiva o una lectura anterior de su versión/contraseña.

Pruebas: `php artisan test --filter=UserStatusTest` y `node --test frontend/tests/user-status.test.mjs` desde `web/`. Comprueban permisos, motivos, idempotencia, conflictos de versión, revocación de accesos, reversión ante fallo de auditoría, preservación de registros e historial, además de errores y confirmaciones en la interfaz.

## Datos originales y migración a otra base

La migración local conserva **13 usuarios, 10 campañas, 36 inversiones y 36 transacciones**, además de perfiles, comentarios, recompensas, actualizaciones y notificaciones. Los UUID y hashes de contraseña se conservan. `legacy_records` guarda una copia íntegra de cada fila del origen, incluyendo los campos y tablas históricos que no utiliza la aplicación activa. El respaldo original está en `storage/app/private/legacy-export.json`, excluido de Git y del servidor público.

Para repetir el traslado en otra base vacía, detén primero las escrituras al backend anterior y haz un respaldo. El exportador usa PostgreSQL y las credenciales de `backend/.env`, en una transacción de solo lectura:

```powershell
node scripts/export-legacy.cjs storage/app/private/otra-exportacion.json
```

Configura la base de destino en `.env`. Para MySQL usa `DB_CONNECTION=mysql`, puerto 3306, nombre, usuario y contraseña propios; para PostgreSQL instala la extensión PDO PostgreSQL y usa `DB_CONNECTION=pgsql`. Usa una base nueva, separada del origen. Después:

```powershell
php artisan migrate
php artisan legacy:import storage/app/private/otra-exportacion.json --dry-run
php artisan legacy:import storage/app/private/otra-exportacion.json
php artisan legacy:verify storage/app/private/otra-exportacion.json
php artisan db:seed
```

El importador exige tablas de negocio vacías y revierte todo si falla una restricción. `--dry-run` realiza los mismos inserts y los revierte al terminar. No ejecutes los seeders antes de importar.

`legacy:verify` comprueba los registros activos y la copia histórica íntegra sin escribir en la base. La exportación inicial de este equipo contiene 383 filas y fue verificada después de importarla.

Copia a `public/uploads` únicamente recursos públicos, como imágenes de perfiles y campañas. **No copies `backend/uploads/kyc` ni documentos privados al directorio público.** Los KYC heredados se protegen mediante el procedimiento de la [issue 4.1](docs/4.1-kyc-heredado.md):

```powershell
php artisan legacy:secure-kyc --dry-run
php artisan legacy:secure-kyc
```

El segundo comando debe ejecutarse con las escrituras detenidas. Verifica los archivos mediante SHA-256, conserva un respaldo privado de referencias, actualiza las rutas de los perfiles y retira únicamente copias con respaldo verificado. También conserva archivos sin referencias activas. Puede repetirse después de un fallo; si falta un archivo o hay contenido diferente con el mismo nombre, se detiene sin retirar los originales. Ejecuta `legacy:verify` de nuevo tras la migración: admite las rutas KYC privadas equivalentes y sigue comprobando íntegra la copia histórica del JSON.

Los archivos nuevos se almacenan en `storage/app/public` y los documentos privados en `storage/app/private`. Conserva el JSON original para auditoría. Antes de actualizar un checkout que todavía versione KYC, respalda esos documentos fuera del repositorio: la corrección los retira del árbol versionado. Consulta la guía 4.1 para las reglas de Apache/Nginx y la revisión del historial de Git.

## Configuración externa y despliegue

Google necesita el callback `http://localhost:8765/api/v1/auth/google/callback` autorizado en la consola de Google (o el dominio HTTPS definitivo). Las credenciales existentes de Google y DeepSeek se trasladaron al `.env` local sin incluirlas en archivos versionados. La autenticación externa y las respuestas reales de IA requieren credenciales válidas; las pruebas no consumen esos servicios.

En producción configura `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL`, las credenciales de base de datos y secretos propios. El document root debe ser **`public/`**. Ejecuta `composer install --no-dev`, `npm ci`, `npm run build`, `php artisan migrate --force`, `php artisan storage:link` y `php artisan optimize`. Ejecuta Reverb como servicio con HTTPS/WebSocket y configura su host público, puerto y `REVERB_ALLOWED_ORIGINS`. Los cambios `VITE_REVERB_*` requieren recompilar React. Los datos financieros siguen usando saldo simulado, como en el proyecto original.

## Verificación

Desde `web/`, con las dependencias instaladas y la configuración de instalación preparada:

```powershell
npm run lint
npm test
npm run build
npm run bundle:check
composer test
composer validate --strict
```

`npm test` descubre todos los archivos `frontend/tests/*.test.mjs`, incluidas las nuevas regresiones que se añadan con ese nombre. Usa Node Test Runner y JSDOM, sin servidor ni credenciales externas. Ejecuta los archivos de forma secuencial para evitar los bloqueos observados en paralelo, con un límite de 60 segundos por prueba y un límite de cinco minutos para el paso de React en CI. También funciona desde `web/frontend/`. La compilación verifica TypeScript y genera assets; se ejecuta antes de PHP porque algunas pruebas de rutas web renderizan la entrada de Vite. `composer test` limpia la caché de configuración y ejecuta `php artisan test`. Cualquier prueba fallida devuelve un código de salida distinto de cero.

Para verificar un checkout limpio sin importar datos reales, instala PHP y Node según los requisitos y ejecuta desde `web/`:

```powershell
Copy-Item .env.example .env
composer install --no-interaction --prefer-dist
php artisan key:generate
npm ci
npm run lint
npm test
npm run build
npm run bundle:check
composer test
composer validate --strict
```

La copia de `.env` es solo para una instalación nueva; conserva tu configuración si ya existe. No se necesita `migrate --seed`, crear usuarios ni levantar Laravel, Reverb o trabajadores para estas verificaciones. `phpunit.xml` selecciona SQLite en memoria, correo simulado y servicios de prueba. Los casos SMTP levantan capturadores locales efímeros y el caso de concurrencia crea su propia base SQLite temporal. Las regresiones verifican autenticación, contratos de API, roles, propiedad de recursos, aportes, precisión decimal, reembolsos, recompensas, PDF/CSV, KYC privado, comentarios, chat e importación reversible.

El workflow [Web checks](.github/workflows/web-checks.yml) ejecuta instalación desde los lockfiles, ESLint, regresiones React, compilación, presupuesto de JavaScript, regresiones PHP, validación de Composer y navegación Chromium del build de producción en cada push y pull request; también admite ejecución manual. Usa Node 24 y PHP 8.4 en un entorno nuevo, sin secretos del proyecto. Un resultado correcto solo acredita las comprobaciones ejecutadas. Consulta [la medición del bundle y sus límites](docs/FRONTEND_BUNDLE.md).

Se distinguen tres clases de evidencia:

- **Regresiones automatizadas:** `web/tests/Unit`, `web/tests/Feature` y `web/frontend/tests`. Exigen el comportamiento esperado; reproducir un defecto debe hacerlas fallar. Los scripts de `web/tests/Support` son auxiliares de estas pruebas, no diagnósticos de aceptación independientes.
- **Diagnósticos históricos:** [la auditoría de octubre](docs/AUDITORIA_ACTUAL.md) y [la auditoría de noviembre](docs/AUDITORIA_FUNCIONAL_2026-11-14.md) conservan hallazgos y resultados de su fecha. Sus diagnósticos no forman parte de la suite actual ni se requieren en un checkout limpio. Los casos corregidos están cubiertos por regresiones; por ejemplo, `CampaignPublicationTest`, `RewardSelectionTest`, `CampaignReadVisibilityTest`, `AdminEmailNormalizationTest` y `frontend/tests/kyc-preview.test.mjs`. Si se crea un diagnóstico exploratorio, debe quedar fuera de las carpetas descubiertas por las suites y documentar que reproducir un fallo no es aceptación.
- **Validaciones adicionales:** las integraciones reales con Google, IA o WebSocket requieren evidencia propia. La suite [Playwright](web/e2e/README.md) completa se ejecuta aparte mediante `npm run test:e2e`; el workflow incluye los casos de carga y navegación de `bundle-loading.spec.ts`, de inicialización de sesión de `oauth-session.spec.ts`, de guardado de campañas de `campaign-saving.spec.ts` y de recuperación de subidas de `campaign-upload-recovery.spec.ts`. La concurrencia con bloqueo de filas debe comprobarse también en el motor de producción: SQLite serializa escrituras y no reproduce el comportamiento de MySQL/PostgreSQL.

Verificación de arranque del **12 de noviembre de 2026**: **36 pruebas y 326 aserciones correctas**, compilación TypeScript/Vite completa y requisitos PHP satisfechos. Se comprobó `composer dev` desde `web/`, la portada y el catálogo en el navegador sin errores de consola, HTTP 200 en las rutas públicas y HTTP 401 en las rutas protegidas sin sesión. Las migraciones locales están aplicadas. Vite avisa que el bundle principal supera 500 kB; no impide compilar ni ejecutar la aplicación. Esta comprobación no valida Google OAuth ni llamadas reales al proveedor de IA.

`npm run lint` comprueba TypeScript y TSX con las reglas recomendadas de ESLint, TypeScript, React Hooks y React Refresh. Se exigen cero errores y cero advertencias (`--max-warnings 0`), también en CI. Se mantienen las comprobaciones de dependencias, inmutabilidad, pureza, referencias y componentes estables. Los contratos conocidos usan tipos concretos; los datos aún no interpretados y los errores usan `unknown`, con comprobación antes de acceder a ellos. Solo los parámetros de compatibilidad intencionalmente ignorados pueden llevar prefijo `_`; las variables e importaciones sin uso se eliminan. No se desactivan reglas globalmente ni se difieren actualizaciones con temporizadores para eludirlas. Consulta también [la guía de interfaz](web/frontend/README.md).

La comparación con la exportación histórica detecta un cambio en `users.last_login_ip`; una base que ya recibe sesiones puede diferir de esa instantánea.

La conexión WebSocket, la suscripción privada y la publicación de un evento se comprobaron contra Reverb local en el puerto 9091 (8000, 8080 y 9000 no responden en este equipo). El script `node scripts/verify-reverb.cjs` repite esa comprobación sin crear registros; utiliza `ws` del backend anterior como dependencia de verificación.
