# Revisión funcional del sistema

Fecha: 15 de octubre de 2026. Alcance: código Laravel/React, contratos entre interfaz y API, pruebas aisladas en SQLite en memoria y análisis estático de React. No se modificaron los datos reales ni la lógica de la aplicación durante esta revisión.

La suite existente pasa: 27 pruebas, 151 aserciones. Cuatro casos de diagnóstico adicionales reprodujeron errores que esa suite no cubre. Sus pruebas están en `storage/app/private/audit/AuditBehaviorTest.php`, fuera de la suite normal; describen el comportamiento defectuoso observado, no el resultado deseado.

## Errores y prioridades

### 1. Alta: publicación sin revisión administrativa

`app/Http/Controllers/CampaignController.php:160` permite publicar desde `draft`, además de `approved`.

Reproducción confirmada: un emprendedor propietario llama a `POST /api/v1/entrepreneurs/me/campaigns/{id}/publish` con una campaña en borrador. La API devuelve 200, la deja publicada y no existe ninguna revisión administrativa. Esto permite saltar el flujo de revisión que presenta el formulario.

Corrección propuesta: exigir aprobación administrativa para publicar y volver a comprobar los requisitos de identidad y vigencia antes del lanzamiento.

### 2. Media: documentos KYC firmados se detectan como imágenes

`frontend/src/components/admin/KYCReviewModal.tsx:88` comprueba si la URL completa termina en `.pdf`. La línea 111 hace una comprobación equivalente para video. `app/Support/Api.php:54` entrega enlaces con parámetros `?expires=...&signature=...`.

Por eso, un PDF o un video servido con un enlace firmado entra en la rama de imagen y no puede previsualizarse correctamente. El archivo no se pierde: falla la elección del visor. Además, el backend acepta MOV y el visor no lo contempla.

Corrección propuesta: almacenar y utilizar el MIME del archivo, o analizar la extensión de `new URL(url).pathname`, conservando intactos los parámetros de autorización.

### 3. Media: la recompensa confirmada puede ser distinta de la asignada

La interfaz muestra la recompensa elegida en `frontend/src/components/campaign-detail/ContributionConfirmModal.tsx` y envía su ID desde `frontend/src/pages/CampaignDetailPage.tsx:971`. La API valida el formato de `rewardTierId`, pero `app/Services/InvestmentEngine.php:42` selecciona otra recompensa por porcentaje, sin consultar ese ID.

Reproducción confirmada: se envía la recompensa A junto a un aporte cuyo porcentaje corresponde a B. La inversión se registra con B, aunque la interfaz había confirmado A. La respuesta tampoco se utiliza para advertir al usuario de la sustitución.

Corrección propuesta: unificar la regla de negocio. Si la recompensa es automática, mostrar antes de confirmar la que realmente corresponde al aporte. Si es elegible, validar y respetar la selección en el backend.

### 4. Media: finalizar una campaña financiada rompe su enlace público

`app/Services/InvestmentEngine.php:93` cambia la campaña a `completed`, pero `app/Models/Campaign.php:7` no incluye ese estado entre los visibles públicamente.

Reproducción confirmada: una campaña financiada devuelve 200 en su detalle público; el dueño la finaliza correctamente; el mismo detalle devuelve 404 inmediatamente. Los enlaces compartidos y los accesos desde el historial de aportes dejan de mostrarla.

Corrección propuesta: permitir consultar las campañas finalizadas en modo de lectura, manteniendo bloqueados los nuevos aportes.

### 5. Media: el filtro «Finalizadas» usa estados equivocados

`frontend/src/components/entrepreneur-profile/CampaignsFeed.tsx:67` incluye `approved` y `rejected`, pero excluye `completed`, `failed` y `cancelled`. Una campaña aprobada puede aparecer como finalizada y una campaña realmente finalizada no aparece en ese filtro.

Corrección propuesta: alinear los grupos de estados con los de la API y definir por separado aprobación y finalización.

### 6. Media: correo duplicado con mayúsculas provoca error 500

`app/Http/Controllers/AuthController.php:16` comprueba unicidad antes de convertir el correo a minúsculas en la línea 18.

Reproducción confirmada con el SQLite actual: existe `audit@example.test`; registrar `AUDIT@EXAMPLE.TEST` supera la comprobación inicial, se transforma en el mismo correo y falla al insertar por la restricción única. La API responde 500 en lugar de un error de validación. No se creó una cuenta duplicada.

Corrección propuesta: normalizar el correo antes de validarlo. Revisar también la creación administrativa de usuarios, que sigue el mismo orden.

### 7. Media: los chats nuevos no se incorporan a la lista en tiempo real

`frontend/src/pages/ChatPage.tsx:98` actualiza las conversaciones existentes mediante `.map()`. Si llega el primer mensaje de una conversación que todavía no está en la lista, no añade ninguna conversación ni vuelve a consultarlas.

Consecuencia: el receptor que ya tiene abierta la página de chat puede necesitar recargar o volver a entrar para encontrar el chat nuevo. El mensaje sí queda guardado por el backend.

Corrección propuesta: al recibir un ID desconocido, consultar e incorporar la conversación a la lista.

### 8. Media: hooks condicionales en las estadísticas financieras

`frontend/src/components/CampaignAnalyticsDashboard.tsx:36` retorna cuando no hay datos antes de ejecutar los `useMemo` de las líneas 57, 90 y 111.

ESLint confirmó tres infracciones de `react-hooks/rules-of-hooks`. La estructura debe corregirse para mantener el mismo orden de hooks al cambiar entre carga y datos. No se reprodujo un cierre del panel en el navegador durante esta revisión; este hallazgo está confirmado por análisis estático.

Corrección propuesta: separar el estado de carga del componente que calcula las estadísticas o ejecutar siempre los hooks antes de retornar.

## Funcionalidades pendientes o limitadas

- **Dinero real:** el capital, las inversiones y los reembolsos usan saldo simulado. No hay una pasarela de cobro ni un flujo de desembolso bancario operativo. Es una limitación del alcance actual, no una pérdida de dinero detectada.
- **Recuperación de contraseña:** existe la tabla de tokens, pero no hay un flujo de solicitud, envío y restablecimiento expuesto por las rutas actuales.
- **Vencimiento automático:** se rechazan aportes después del cierre, pero no hay una tarea programada que finalice las campañas vencidas o ejecute los reembolsos. La finalización actual es manual.
- **Estadísticas de portada:** `frontend/src/pages/LandingPage.tsx:457` utiliza valores fijos para likes y comentarios; también contiene textos fijos como «100+ donadores activos» y «94% campañas exitosas». No representan métricas calculadas desde la base.
- **Google OAuth e IA:** tienen integración en código, pero su funcionamiento completo con proveedores externos y credenciales válidas sigue pendiente de validación. Esta revisión no realizó llamadas de pago ni autenticación externa.

## Repetir las verificaciones

```powershell
php artisan test
php artisan test storage/app/private/audit/AuditBehaviorTest.php
```

Prioridad sugerida: publicación y KYC; después coherencia de recompensas y estados de campaña; luego registro y chat. Las pruebas de diagnóstico deben convertirse en regresiones con el resultado correcto cuando se implementen las correcciones.
