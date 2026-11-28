# Pruebas SQA con Playwright

Desde `web/`:

```powershell
npm ci
npx playwright install chromium
npm run build
npm run test:e2e
```

La suite usa Playwright Test para interfaz Chromium y API HTTP real de Laravel.
GitHub Actions ejecuta `npm run test:e2e` sin filtrar archivos: incluye todos los
casos de `e2e/tests`, tanto la aceptación por API de `acceptance.spec.ts` como los
recorridos de navegador y las nuevas regresiones que se incorporen a esa carpeta.
La aceptación por API comprueba contratos y efectos de negocio; los recorridos
Chromium aportan evidencia de interfaz para los flujos que ejercitan.

Las cuentas sintéticas habituales tienen correo verificado para alcanzar las
operaciones autorizadas y sus validaciones de negocio. `otherOwner` conserva su
KYC pendiente aunque su correo esté verificado. Las cuentas `unverifiedDonor` y
`unverifiedOwner` conservan correo pendiente; esta última tiene KYC aprobado y
campañas propias con fechas válidas para aislar la restricción de correo.
`email-verification-policy.spec.ts` comprueba estos estados contra la identidad
autenticada de Laravel, el rechazo de aportes y de envío/publicación de campañas,
y la conservación de saldos, aportes, contadores, estados e historial tras los
rechazos. El registro de una cuenta nueva sigue esperando correo sin verificar.
Estas condiciones se definen en `support/seed.php`, sin cambios puntuales de
verificación dentro de cada prueba, y se restauran desde la instantánea por caso.

Para comprobar únicamente la carga del frontend compilado, ejecuta
`npm run test:e2e -- bundle-loading.spec.ts` después de `npm run build`.
Estos casos verifican aislamiento de módulos, rutas directas, recargas, descarga
diferida de gráficos y recuperación de errores; se incluyen en GitHub Actions.
`npm run test:e2e -- oauth-session.spec.ts` verifica el callback de acceso con tokens
opacos reales del Laravel local: identidad del servidor, roles, datos anteriores,
controles de sesión, recarga, cierre y recuperación de errores. También se incluye
en CI. No contacta a Google ni acredita la integración externa con el proveedor.
`npm run test:e2e -- campaign-saving.spec.ts` comprueba creación y edición desde
Mis Campañas y el perfil del emprendedor: bloqueo de solicitudes pendientes,
errores visibles, conservación de campos y archivos, reintento y guardado real.
Los casos usan archivos sintéticos y también se ejecutan en CI.
`npm run test:e2e -- campaign-upload-recovery.spec.ts` comprueba creación y edición
desde ambas pantallas con subidas parciales, reintentos repetidos y respuestas
perdidas después de guardar archivos en Laravel. Verifica una sola campaña,
el mismo documento recibido, la portada conservada y descargas autorizadas.
También forma parte de CI y usa únicamente la base y el almacenamiento aislados.
`npm run test:e2e -- campaign-existing-documents.spec.ts` verifica la edición con
documentos pendientes y aprobados sin volver a subirlos, la incorporación de un
documento nuevo, la reapertura del editor y el envío a revisión desde el perfil.
Incluye fallos de consulta con reintento y conservación de campos y archivos en
ambas pantallas. Las descargas y la conservación de referencias se comprueban
contra Laravel real; estos casos también forman parte de CI.
`npm run test:e2e -- donor-query-states.spec.ts` verifica errores de red, HTTP 500
y sesión vencida en el dashboard y el historial del perfil. Incluye reintentos
con respuestas reales de Laravel, errores del perfil que no disparan la creación
y la ausencia confirmada de perfil. Estos casos también se ejecutan en CI.
`npm run test:e2e -- campaign-comments.spec.ts` comprueba consultas fallidas con
recuperación, conservación del borrador, bloqueo de publicaciones duplicadas y
restauración de likes y sus contadores. Los reintentos usan Laravel y verifican
los comentarios y likes guardados en la base temporal. También forma parte de CI.
`npm run test:e2e -- catalog-modality-links.spec.ts` verifica los enlaces del pie
de página para donaciones y recompensas, su consulta real a Laravel, el selector,
la recarga y la navegación hacia atrás y adelante. También comprueba que cambiar
modalidad reinicie la página conservando los demás filtros y que limpiar filtros
actualice la URL y el campo de búsqueda. Usa ambas modalidades en la base temporal
y también forma parte de CI.
`npm run test:e2e -- campaign-donor-chat.spec.ts` comprueba el acceso al chat desde
los donadores en las vistas del emprendedor y de consulta administrativa. Incluye
fallos con reintento, clics repetidos, destinatario y campaña correctos, reutilización
de conversaciones y rechazos reales por destinatario inactivo o campaña privada.
Usa aportes y cuentas sintéticos en la base temporal; no envía mensajes. También
forma parte de CI.
No ejecuta PHPUnit como sustituto de Playwright. Los casos funcionales conservan la HU y,
cuando corresponde, el criterio verificable; la matriz del plan distingue una
prueba de servicio de la aceptación completa de interfaz.

`run.mjs` prepara una carpeta marcada dentro de `tmp/playwright/run-*`, genera
una clave efímera, crea una base SQLite propia, carga fixtures sintéticos e
inicia PHP en un puerto local libre. Los archivos `.env`, base importada,
cachés y almacenamiento ordinarios de Laravel quedan fuera de ese entorno.
Cada caso restaura su instantánea inicial y la suite ejecuta un solo worker.
El servidor se detiene al terminar; los runtimes temporales se conservan para
diagnóstico. No contienen cuentas de producción; no se deben publicar los
tokens de fixtures ni trazas sin revisión.

La aplicación necesita PHP con SQLite y BCMath, dependencias Composer y una
compilación frontend previa. Si existe `public/hot`, ejecutar el build antes
de las pruebas para que se utilicen los assets compilados. No se reutiliza un
servidor ni una base ya abiertos.

Los reportes HTML y JSON se guardan en `playwright-report/`; trazas y capturas
de fallos, en `test-results/`. Ambas carpetas están excluidas de Git. Los casos
API validan contratos y efectos de negocio, sin acreditar por sí solos los
controles visuales. Las 80 historias y 304 criterios del catálogo se incluyen
en el plan; la suite inicial no constituye cobertura automatizada completa.

Playwright no controla la interfaz nativa Flutter. Los contratos compartidos
se verifican por HTTP; la aceptación de Android requiere evidencia propia.

Fuentes técnicas: [API testing](https://playwright.dev/docs/api-testing) y
[configuración](https://playwright.dev/docs/test-configuration) de Playwright.
