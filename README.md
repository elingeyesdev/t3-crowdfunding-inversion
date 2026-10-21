# UniFundMe — Laravel + React

La aplicación se ejecuta desde esta raíz con Laravel 13, PHP 8.3 o superior y React 19. La interfaz original permanece en `frontend/src`; Laravel sirve las páginas, la API y los archivos. Vite compila React y Tailwind desde `vite.config.ts`.

## Arranque en este equipo

La configuración local ya apunta a `database/migrated.sqlite`, que contiene la importación de PostgreSQL. No ejecutes `migrate:fresh` sobre esa base.

```powershell
composer dev
```

Abre **http://localhost:8000**. El comando inicia Laravel, Vite y Reverb. Para usar los archivos ya compilados bastan dos terminales:

```powershell
php artisan serve
php artisan reverb:start
```

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

Copia `backend/uploads` a `public/uploads` para conservar las URL anteriores. Los archivos nuevos se almacenan en `storage/app/public` y los documentos privados en `storage/app/private`. Conserva el JSON original para auditoría. Una copia anterior a la migración puede restaurarse apuntando nuevamente al backend NestJS y su base original.

## Configuración externa y despliegue

Google necesita el callback `http://localhost:8000/api/v1/auth/google/callback` autorizado en la consola de Google (o el dominio HTTPS definitivo). Las credenciales existentes de Google y DeepSeek se trasladaron al `.env` local sin incluirlas en archivos versionados. La autenticación externa y las respuestas reales de IA requieren credenciales válidas; las pruebas no consumen esos servicios.

En producción configura `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL`, las credenciales de base de datos y secretos propios. El document root debe ser **`public/`**. Ejecuta `composer install --no-dev`, `npm ci`, `npm run build`, `php artisan migrate --force`, `php artisan storage:link` y `php artisan optimize`. Ejecuta Reverb como servicio con HTTPS/WebSocket y configura su host público, puerto y `REVERB_ALLOWED_ORIGINS`. Los cambios `VITE_REVERB_*` requieren recompilar React. Los datos financieros siguen usando saldo simulado, como en el proyecto original.

## Verificación

```powershell
php artisan test
npm run build
composer validate --strict
```

Las pruebas usan SQLite en memoria: verifican autenticación, compatibilidad de contraseñas, contratos de API, roles, propiedad de recursos, aportes, precisión decimal, reembolsos, recompensas, PDF/CSV, KYC privado, comentarios, chat e importación reversible. La concurrencia con bloqueo de filas debe comprobarse también en el motor elegido para producción; SQLite serializa escrituras y no reproduce el comportamiento de MySQL/PostgreSQL.

Resultado de la verificación local: **27 pruebas y 151 aserciones correctas**, compilación TypeScript/Vite completa, manifiestos de dependencias válidos y rutas cacheables. El bundle principal conserva el tamaño de la interfaz original y Vite avisa que supera 500 kB; no impide compilar ni ejecutar la aplicación.

La conexión WebSocket, la suscripción privada y la publicación de un evento se comprobaron contra Reverb local en el puerto 9000 (8080 está bloqueado en este equipo). El script `node scripts/verify-reverb.cjs` repite esa comprobación sin crear registros; utiliza `ws` del backend anterior como dependencia de verificación.
