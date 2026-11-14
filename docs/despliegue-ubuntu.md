# Despliegue de UniFundme en Ubuntu Server

> **Registro histórico de una instalación en una VM.** Esta guía conserva los pasos y resultados de ese entorno, pero la rama actual no incluye el `Dockerfile` ni el archivo Compose mencionados. No constituye un procedimiento reproducible de despliegue de esta versión. Para la estructura y los comandos actuales, consulta el [README](../README.md), que ejecuta Laravel desde `web/`. Antes de reutilizar los pasos de contenedores hay que recuperar o preparar su configuración y verificarla.

Guía de los comandos usados para instalar y verificar UniFundme en la VM Ubuntu Server. Las contraseñas, `APP_KEY` y otros secretos se configuran en `.env` y no deben copiarse en esta documentación.

## 1. Identificar el servidor y comprobar recursos

```bash
hostnamectl
```

Muestra el hostname y datos del sistema. En esta instalación el hostname configurado es `unifundme-srv`.

```bash
ip -4 -br address
```

Muestra las interfaces y direcciones IPv4. La IP depende del modo de red de VirtualBox: se observó `192.168.43.124` en modo puente y `10.0.2.15` después de cambiar a NAT.

```bash
df -h /
```

Muestra el espacio usado y disponible en la partición raíz.

## 2. Actualizar Ubuntu e instalar herramientas

```bash
sudo apt update
```

Actualiza el índice de paquetes disponibles.

```bash
sudo apt install ca-certificates curl git nginx -y
```

Instala certificados CA, `curl`, Git y Nginx. `-y` acepta las confirmaciones de instalación.

### Instalar Docker Engine y Docker Compose

Se preparó el directorio de claves de APT y se descargó la clave oficial del repositorio de Docker:

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
```

`install` crea el directorio con permisos; `curl` guarda la clave; `chmod` permite que APT la lea.

Se añadió el repositorio oficial de Docker usando la versión de Ubuntu y la arquitectura detectadas automáticamente:

```bash
. /etc/os-release
printf 'Types: deb\nURIs: https://download.docker.com/linux/ubuntu\nSuites: %s\nComponents: stable\nArchitectures: %s\nSigned-By: /etc/apt/keyrings/docker.asc\n' "${UBUNTU_CODENAME:-$VERSION_CODENAME}" "$(dpkg --print-architecture)" | sudo tee /etc/apt/sources.list.d/docker.sources
```

Luego se actualizaron los índices y se instalaron Docker Engine, el cliente, containerd, Buildx y el complemento de Compose:

```bash
sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin -y
```

Comprobaciones realizadas:

```bash
systemctl is-active docker
docker compose version
git --version
sudo docker run --rm hello-world
```

`systemctl is-active` confirmó que Docker estaba `active`; Compose informó su versión; Git informó su versión; `hello-world` confirmó que el motor pudo descargar y ejecutar un contenedor.

## 3. Crear una cuenta de servicio con privilegios mínimos

```bash
sudo adduser --system --group --home /opt/unifundme --shell /usr/sbin/nologin unifundme
```

Crea el usuario y grupo de sistema `unifundme`, con directorio propio y sin shell interactivo. No se agregó al grupo `sudo`.

Comprobaciones:

```bash
id unifundme
getent passwd unifundme
ls -ld /opt/unifundme
```

Muestran sus UID/GID/grupos, la entrada de cuenta y los permisos del directorio.

## 4. Descargar el proyecto y preparar variables

```bash
git clone https://github.com/elingeyesdev/t3-crowdfunding-inversion.git ~/unifundme
cd ~/unifundme
```

Clona el repositorio y entra en su carpeta.

```bash
cp .env.example .env
chmod 600 .env
nano .env
```

Copia la plantilla de variables, limita el acceso al archivo al propietario y permite editarlo. En `.env` se configuraron los valores de Laravel y PostgreSQL. Los secretos deben ser propios, fuertes y mantenerse fuera de Git y de capturas compartidas.

Se generó una clave de aplicación y una contraseña de base de datos con `openssl rand`; los valores secretos no se incluyen aquí. La base se configuró con PostgreSQL, host `db`, base y usuario `unifundme`.

## 5. Validar y construir los contenedores

```bash
sudo docker compose config -q
```

Valida la sintaxis y el esquema de `compose.yaml`. Si no imprime errores, la configuración es válida.

```bash
sudo docker compose build app
```

Construye la imagen de la aplicación. Durante la construcción apareció un error de Laravel Reverb al descubrir paquetes. Se resolvió configurando temporalmente `BROADCAST_CONNECTION=log` en el paso de `composer dump-autoload` del Dockerfile; la aplicación no incluye un servicio Reverb en este despliegue.

```bash
sudo docker compose up -d
```

Crea e inicia los servicios en segundo plano. El archivo Compose define la base `db` y la aplicación `app`; ambos tienen política `restart: unless-stopped`.

```bash
sudo docker compose ps
```

Muestra el estado de los contenedores. En la última comprobación, `unifundme-db-1` estaba `Up (healthy)` y `unifundme-app-1` estaba `Up`.

## 6. Crear esquema, datos iniciales y administrador

```bash
sudo docker compose exec app php artisan migrate --force
```

Ejecuta las migraciones de Laravel dentro del contenedor `app`. `--force` permite ejecutarlas sin confirmación interactiva.

```bash
sudo docker compose exec app php artisan db:seed --force
```

Ejecuta los seeders para cargar datos iniciales como roles y categorías. La salida mostró avisos de bloqueo temporal de CPU de la VM; luego volvió al prompt. Conviene confirmar posteriormente los datos que el seeder debía crear.

```bash
sudo docker compose exec app php artisan app:create-admin admin@unifundme.test --super
```

Crea un superadministrador. El comando solicitó una contraseña nueva y confirmó `Administrador creado`. La contraseña se escribe de forma oculta y no se documenta.

## 7. Configurar Nginx como proxy

El sitio se configuró en `/etc/nginx/sites-available/unifundme` para recibir HTTP y reenviar solicitudes al contenedor local en `127.0.0.1:8080`. Se habilitó con:

```bash
sudo ln -s /etc/nginx/sites-available/unifundme /etc/nginx/sites-enabled/unifundme
sudo unlink /etc/nginx/sites-enabled/default
```

La regla del sitio incluye las cabeceras de proxy. Para conservar el puerto publicado por VirtualBox se cambió:

```nginx
proxy_set_header Host $host;
```

por:

```nginx
proxy_set_header Host $http_host;
```

Validación y recarga:

```bash
sudo nginx -t
sudo systemctl reload nginx
systemctl is-active nginx
```

`nginx -t` confirmó que la sintaxis y la configuración eran correctas; Nginx informó `active`.

## 8. Configurar UFW y comprobar los servicios

La política configurada es bloquear conexiones entrantes por defecto y permitir las salientes. Se permitió SSH y luego HTTP de Nginx:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx HTTP'
sudo ufw status verbose
```

`ufw status verbose` muestra la política y reglas activas. La regla de Nginx respondió `Rule added` y `Rule added (v6)`.

Comprobaciones locales:

```bash
sudo ss -ltnp | grep ':80'
curl -sS -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1/
```

`ss` muestra los procesos que escuchan en el puerto 80. `curl` comprobó que Nginx respondía `HTTP 200`.

La base de datos no publica un puerto al host: `docker compose ps` muestra `5432/tcp` sin un mapeo `HOST:5432`. La aplicación se publica solo en el loopback de Ubuntu (`127.0.0.1:8080->80/tcp`) y Nginx la atiende en el puerto 80.

## 9. Acceso desde Windows y resolución del incidente

Al probar `192.168.43.124` desde Windows, la conexión falló: Windows tenía `10.26.7.61`, estaban en redes distintas y la VM no consiguió IPv4 por DHCP en modo puente. Se cambió el adaptador de VirtualBox a NAT, que asignó `10.0.2.15`.

En VirtualBox se configuró una redirección TCP desde el host `127.0.0.1:18080` al invitado, puerto `80`. Así se abrió la web desde Windows en:

```text
http://127.0.0.1:18080
```

La primera carga mostró una página en blanco porque los recursos JavaScript se solicitaban sin el puerto `18080`. Se corrigió la cabecera `Host` de Nginx de `$host` a `$http_host`; después de validar y recargar Nginx la página completa cargó. Este acceso por NAT está limitado al equipo anfitrión porque la IP anfitrión de la regla es `127.0.0.1`.

La prueba de red realizada desde PowerShell fue:

```powershell
Test-NetConnection 192.168.43.124 -Port 80
```

Falló por la diferencia de redes; documenta el incidente que llevó al cambio de modo de red.

## 10. Verificación de la aplicación

Se comprobó en el navegador que:

- La página pública carga completa.
- El inicio de sesión funciona con el administrador recién creado.
- El panel muestra un usuario y cero campañas/donaciones, como se espera en una base nueva.
- Gestión de usuarios, campañas y verificaciones KYC cargan correctamente.
- La verificación final de servicios mostró la aplicación `Up`, PostgreSQL `healthy` y Nginx `active`.

La API aún necesita una prueba explícita de endpoint y la aplicación móvil aún no se ha conectado.

## 11. Pendientes para completar la lista de la actividad

- Crear un backup de PostgreSQL y demostrar la restauración en una base de prueba.
- Probar un endpoint de la API y registrar su respuesta.
- Configurar y probar PuTTY/SSH otra vez con NAT (por ejemplo, una redirección del host `127.0.0.1:2222` al invitado `22`).
- Habilitar un acceso de red que pueda usar el dispositivo móvil; la regla actual solo acepta conexiones del propio Windows.
- Confirmar la política de reinicio efectiva de ambos contenedores con `docker inspect`.
- Completar esta guía con las pruebas pendientes y pedir a otro estudiante que siga los pasos desde cero.
