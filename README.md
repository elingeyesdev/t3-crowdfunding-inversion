# UniFundMe — Laravel + React

La aplicación se ejecuta desde `web/` con Laravel 13, PHP 8.3 o superior y React 19. La interfaz original permanece en `web/frontend/src`; Laravel sirve las páginas, la API y los archivos. Vite compila React y Tailwind desde `web/vite.config.ts`. Los comandos y rutas del resto de esta guía son relativos a `web/`.

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

Requisitos: PHP 8.3+, Composer, Node 22.12+ y extensiones PHP habituales de Laravel, incluyendo PDO SQLite o PDO MySQL, BCMath, Fileinfo y Mbstring.

```powershell
composer install
Copy-Item .env.example .env
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

La API conserva `/api/v1` y los contratos usados por React, incluyendo paginación y campos en camelCase. Las vistas de administración conservan sus respuestas en snake_case. Consulta todas las rutas con `php artisan route:list --path=api/v1`. La mensajería agrega `POST /chat/conversations/{id}/messages` y `POST /broadcasting/auth` dentro del mismo prefijo.

Los endpoints temporales de creación de superadministrador y publicación de historias de prueba se sustituyeron por operaciones locales y autenticadas. KYC y documentos nuevos se guardan fuera de `public/` y se sirven con enlaces firmados de 15 minutos.

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

La auditoría funcional del 14 de noviembre de 2026 y el plan de correcciones del milestone 4 están en [docs/AUDITORIA_FUNCIONAL_2026-11-14.md](docs/AUDITORIA_FUNCIONAL_2026-11-14.md). Los diagnósticos allí documentados reproducen defectos conocidos y se ejecutan por separado de la suite de regresión.

```powershell
php artisan test
npm run build
composer validate --strict
```

Las pruebas usan SQLite en memoria: verifican autenticación, compatibilidad de contraseñas, contratos de API, roles, propiedad de recursos, aportes, precisión decimal, reembolsos, recompensas, PDF/CSV, KYC privado, comentarios, chat e importación reversible. La concurrencia con bloqueo de filas debe comprobarse también en el motor elegido para producción; SQLite serializa escrituras y no reproduce el comportamiento de MySQL/PostgreSQL.

Verificación de arranque del **12 de noviembre de 2026**: **36 pruebas y 326 aserciones correctas**, compilación TypeScript/Vite completa y requisitos PHP satisfechos. Se comprobó `composer dev` desde `web/`, la portada y el catálogo en el navegador sin errores de consola, HTTP 200 en las rutas públicas y HTTP 401 en las rutas protegidas sin sesión. Las migraciones locales están aplicadas. Vite avisa que el bundle principal supera 500 kB; no impide compilar ni ejecutar la aplicación. Esta comprobación no valida Google OAuth ni llamadas reales al proveedor de IA.

ESLint todavía reporta deuda previa de tipado y reglas de React; `npm run lint` no pasa. Se corrigió el orden condicional de hooks del panel de estadísticas y se añadieron regresiones para correos duplicados con mayúsculas y solicitudes a la API sin sesión ni cabecera Accept. La comparación con la exportación histórica detecta un cambio en `users.last_login_ip`; una base que ya recibe sesiones puede diferir de esa instantánea.

La conexión WebSocket, la suscripción privada y la publicación de un evento se comprobaron contra Reverb local en el puerto 9091 (8000, 8080 y 9000 no responden en este equipo). El script `node scripts/verify-reverb.cjs` repite esa comprobación sin crear registros; utiliza `ws` del backend anterior como dependencia de verificación.
