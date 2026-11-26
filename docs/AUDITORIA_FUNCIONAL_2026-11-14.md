# Auditoría funcional y plan de estabilización

Fecha: 14 de noviembre de 2026.

Nota de mantenimiento (19 de noviembre de 2026): los diagnósticos de `docs/AuditDiagnosticsTest.php` se retiraron al corregir el último defecto que reproducían (issue 4.20). Las correcciones están cubiertas por pruebas de regresión en `web/tests/Feature/`; los resultados y comandos de este informe se conservan como registro de la auditoría original.

## Alcance y conclusión

Se revisó la aplicación activa Laravel + React en `web/`: rutas, controladores, servicios, modelos, pantallas, clientes de API y pruebas. NestJS en `web/backend/` es referencia histórica, no el servidor activo. Esta revisión identifica 22 incidencias concretas y separa las funciones pendientes y las comprobaciones todavía necesarias. No representa una garantía de ausencia de otros defectos.

El sistema tiene una base operativa, pero todavía no está listo para ampliar funcionalidades sin una etapa de estabilización. Las prioridades son privacidad, publicación de campañas, integridad de la auditoría financiera y contratos entre React y Laravel.

No se modificó la lógica de negocio ni se escribieron datos en la base real. Se añadió un archivo de diagnóstico fuera de la suite habitual. La compilación regeneró los assets ignorados por Git y eliminó `public/hot` mediante el script habitual de postbuild.

## Verificaciones realizadas

| Comprobación | Resultado actual |
| --- | --- |
| `php artisan test` | 36 pruebas, 326 aserciones correctas |
| `php artisan test ../docs/AuditDiagnosticsTest.php` | 11 diagnósticos, 47 aserciones: reproducen defectos actuales |
| `npm run build` | Correcto; JavaScript principal de 1.647,42 kB, 431,53 kB gzip |
| `npm run lint` | Falla: 373 errores y 11 advertencias |
| Fechas y detección de PDF firmados | Reproducciones de las expresiones JavaScript confirmadas con Node |

Las pruebas PHP usaron SQLite en memoria. Dentro del aislamiento, PHP podía cargar el autoloader pero `is_readable()` devolvía falso y PHPUnit se detenía; la ejecución autorizada fuera del aislamiento resolvió esa limitación. No es un defecto funcional atribuido a la app.

No se ejecutó una revisión visual completa en navegador, ni llamadas reales a Google, DeepSeek, correo o pagos. La concurrencia en MySQL/PostgreSQL y la reconexión WebSocket de extremo a extremo quedan pendientes. Los resultados históricos del README no sustituyen estas verificaciones.

## Inventario por funcionalidad

| Funcionalidad | Estado revisado | Observaciones |
| --- | --- | --- |
| Registro, login, logout y roles | Base cubierta por pruebas | El duplicado por mayúsculas está corregido en registro, pero persiste al crear administradores |
| Configuración y seguridad de cuenta | Incompleta | Cambio de contraseña sin endpoint; recuperación y verificación por correo sin flujo |
| Perfiles e imágenes | Base cubierta parcialmente | No se validaron visualmente todos los formularios ni condiciones simultáneas |
| KYC y revisión administrativa | Parcial | Archivos nuevos privados; archivos heredados en carpeta pública; visor falla con enlaces firmados |
| Creación y revisión de campañas | Parcial | Se puede omitir aprobación; fecha local enviada como UTC |
| Catálogo y detalle público | Base operativa con errores | Las finalizadas desaparecen; consultas auxiliares no respetan visibilidad |
| Aportes, saldo y reembolsos | Operativos como simulación | Selección de recompensas incoherente; dinero real fuera del alcance actual |
| Gestión y seguimiento de recompensas | Parcial | Historial omite envíos; se pueden reactivar entregas canceladas por reembolso |
| Plan de fondos y movimientos | Parcial | Gastos auditados mutables; consultas públicas demasiado amplias |
| Hitos, evidencias y actualizaciones | Parcial | Asociación entre campañas incorrecta; rutas de consulta usadas por React inexistentes |
| Dashboard del donador | Parcial | Seguimiento de recompensas y novedades afectado por contratos incompletos |
| Estadísticas y reportes PDF/CSV | Base cubierta por pruebas | Hooks inválidos en auditoría pública; falta validar rendimiento con volumen real |
| Comentarios y likes | Base cubierta por pruebas | No se verificaron visualmente todos los estados de carga/error ni moderación |
| Notificaciones | Parcial | Preferencias por categoría ignoradas; contador incorrecto al marcar por tipo; correo pendiente |
| Chat privado | Backend cubierto parcialmente | La lista no incorpora conversaciones nuevas recibidas en tiempo real |
| Administración y superadministración | Parcial | Error 500 con correo duplicado en mayúsculas; reactivación de usuarios no expuesta |
| Historias y DonaTok | Implementados, verificación parcial | Portada utiliza cifras inventadas; recorrido visual completo pendiente |
| IA de soporte y campañas / Google OAuth | Integraciones presentes | Funcionamiento real con proveedores no validado en esta auditoría |
| Calidad y operación | Pendiente de estabilizar | Lint falla, bundle grande y faltan pruebas de recorridos completos del frontend |

## Incidencias priorizadas

P0: privacidad, tratar primero. P1: afecta controles centrales o flujos visibles. P2: coherencia funcional. P3: presentación o deuda que puede abordarse después de los bloqueos. Son prioridades propuestas, no estimaciones de duración.

### A01 · P0 · Archivos KYC heredados en ubicaciones públicas y en Git

- Evidencia: existen 18 archivos en `web/public/uploads/kyc/`; sus originales están versionados en `web/backend/uploads/kyc/`. El README indica copiar todo `backend/uploads` a `public/uploads`.
- Impacto: los enlaces firmados de los archivos nuevos no protegen estas copias antiguas. Una configuración web que sirva esa carpeta puede entregarlas sin autorización. No se inspeccionó su contenido ni se confirmó que sean documentos reales de personas.
- Cierre: inventariar las referencias, migrar los documentos heredados a almacenamiento privado, restringir su entrega, retirar las copias públicas preservando los datos y comprobar acceso anónimo denegado. Revisar el historial del repositorio si contienen datos reales. Corregir las instrucciones de migración. La publicación HTTP efectiva debe verificarse en el despliegue.

### A02 · P0 · Consultas públicas exponen datos de campañas privadas y actualizaciones no públicas

- Evidencia reproducida: `CampaignController::financialLedger`, `fundingPlan`, `milestones` y `showMilestone` no comprueban el estado público. Los hitos cargan `updates` sin filtrar `is_public`. Una petición anónima devuelve movimientos de un borrador y contenido de una actualización con `is_public=false`.
- Archivos: `web/app/Http/Controllers/CampaignController.php:334`, `:406`, `:510`; `web/app/Models/CampaignMilestone.php`.
- Cierre: separar consultas públicas y del propietario; comprobar visibilidad de campaña, filtrar actualizaciones privadas y definir qué notas y campos financieros son realmente públicos. Pruebas de anónimo, propietario, tercero y administrador.

### A03 · P1 · Publicar omite revisión administrativa y nueva comprobación KYC

- Evidencia reproducida: `transition()` permite `draft -> published`, incluso con propietario no verificado, sin filas en `campaign_reviews`.
- Archivo: `web/app/Http/Controllers/CampaignController.php:168`.
- Cierre: publicación del propietario únicamente desde aprobado, revalidando identidad y vigencia. Probar borrador, rechazo, KYC revocado y fechas vencidas. Revisar también la política de publicación directa administrativa y documentar sus excepciones.

### A04 · P1 · La auditoría financiera no conserva la integridad de lo aprobado

- Evidencia reproducida: el propietario puede cambiar concepto de un gasto `verified` y este mantiene su aprobación; luego puede eliminarlo. También existe reemplazo de comprobante sin invalidar revisión. La referencia de los ingresos de sistema es editable y es precisamente el dato utilizado para impedir borrarlos.
- Archivo: `web/app/Http/Controllers/CampaignController.php:470`, `:486`, `:496`.
- Cierre: registros de sistema inmutables; cambios en gastos auditados mediante versión o nueva revisión, con historial de actor/fecha/cambio. Probar que no se borren gastos aprobados ni aportes/reembolsos del sistema alterando referencias.

### A05 · P1 · Cambio de contraseña no funciona

- Evidencia reproducida: React envía `PATCH /api/v1/users/me/password`; Laravel devuelve 404 porque no tiene esa ruta.
- Archivos: `web/frontend/src/api/auth.api.ts:43`; `web/routes/api.php`.
- Cierre: implementar y conectar validación de contraseña actual, contraseña nueva y política de sesiones; probar cambio y acceso posterior con la nueva contraseña.

### A06 · P1 · Evidencias públicas llaman a una ruta inexistente

- Evidencia reproducida: `GET /api/v1/campaigns/public/{id}/documents` devuelve 404. La pantalla transforma el fallo en lista vacía.
- Archivos: `web/frontend/src/api/public-campaigns.api.ts`; `web/frontend/src/components/campaign-detail/CampaignTransparencySection.tsx`.
- Cierre: contrato público explícito, con documentos autorizados y enlaces correctos; distinguir error de carga y ausencia de documentos.

### A07 · P1 · Bitácora pública llama a una ruta inexistente

- Evidencia reproducida: React pide `/campaigns/public/{id}/updates`, pero la ruta implementada es `/campaigns/{id}/updates`. La primera devuelve 404 y la pantalla queda vacía.
- Archivos: los mismos de A06 y `web/routes/api.php`.
- Cierre: unificar ruta y campos esperados, asegurar visibilidad de campaña y autor, y probar una actualización real en la bitácora.

### A08 · P1 · Novedades de proyectos apoyados no cargan

- Evidencia reproducida: `GET /api/v1/investments/backed-campaigns/updates` no existe. `DonorBackedUpdatesFeed` registra el error en consola y muestra una lista vacía.
- Archivos: `web/frontend/src/api/investor.api.ts`; `web/frontend/src/components/donor-tracking/DonorBackedUpdatesFeed.tsx`.
- Cierre: consulta paginada limitada a campañas respaldadas por el usuario, con política de acceso y estado de error visible.

### A09 · P1 · El donador no recibe el seguimiento real de recompensas

- Evidencia reproducida: tras marcar una recompensa como enviada, `/investments/me` omite `rewardClaimStatus`, `trackingNumber` y `trackingUrl`. El componente interpreta la ausencia como `pending`.
- Archivos: `web/app/Http/Controllers/InvestmentController.php:22`; `web/frontend/src/components/donor-tracking/DonorRewardsTracker.tsx`.
- Cierre: completar respuesta con claim, estado, fechas y envío; probar el recorrido pendiente -> enviada -> entregada y la cancelación.

### A10 · P1 · Hooks condicionales en la auditoría financiera pública

- Evidencia estática: `PublicFinancialAuditing` retorna si `finance` es nulo antes de tres `useMemo`; ESLint marca tres infracciones de `react-hooks/rules-of-hooks` en líneas 79, 99 y 114.
- Archivo: `web/frontend/src/components/campaign-detail/transparency/PublicFinancialAuditing.tsx`.
- Impacto: si la pestaña se abre durante carga y después recibe datos, el orden de hooks cambia y puede fallar el render. No se reprodujo en navegador durante esta revisión.
- Cierre: mantener hooks incondicionales o separar componente de carga; verificar carga -> datos, error y cambio de campaña.

### A11 · P2 · La recompensa confirmada puede diferir de la asignada

- Evidencia reproducida: el frontend envía `rewardTierId`; `InvestmentEngine` lo ignora y elige por porcentaje. Seleccionar A puede registrar B.
- Archivos: `web/app/Services/InvestmentEngine.php:42`; `web/frontend/src/pages/CampaignDetailPage.tsx:1215`.
- Cierre: definir una sola regla y mostrar la asignación definitiva antes de confirmar; validar campaña, vigencia y cupos de recompensa, sin sustitución silenciosa.

### A12 · P2 · Una actualización puede vincularse a un hito de otra campaña

- Evidencia reproducida: se valida que `milestoneId` exista globalmente, sin exigir que pertenezca a la campaña editada. El enlace incorrecto se guarda y contamina sus consultas.
- Archivo: `web/app/Http/Controllers/CampaignController.php:303`.
- Cierre: validar pertenencia al mismo proyecto; prueba con hito propio y ajeno.

### A13 · P2 · Se puede marcar entregada una recompensa cancelada por reembolso

- Evidencia reproducida: finalizar sin meta cancela el claim; `updateClaim` permite cambiarlo a `delivered` aunque la inversión esté reembolsada.
- Archivo: `web/app/Http/Controllers/RewardController.php:76`.
- Cierre: validar transiciones y estado de inversión, bloquear entrega de reembolsadas y reflejar cancelación en el donador.

### A14 · P2 · Finalizar rompe el detalle público de la campaña

- Evidencia reproducida: `funded -> completed` cambia un detalle público de 200 a 404. Las fallidas también quedan fuera del conjunto público.
- Archivos: `web/app/Models/Campaign.php:7`; `web/app/Services/InvestmentEngine.php`.
- Cierre: definir estados históricos consultables, mantener lectura desde enlaces e historial y bloquear aportes a estados cerrados. No basta con agregarlos indiscriminadamente al catálogo activo.

### A15 · P2 · Preferencias de notificaciones por categoría no se respetan

- Evidencia reproducida: guardar `investmentAlerts=false` no impide crear una notificación de inversión. La interfaz guarda `investmentAlerts`, `commentAlerts`, etc.; `Notifier` solo consulta `inAppEnabled` y `categories[código]`.
- Archivos: `web/app/Services/Notifier.php:37`; `web/frontend/src/pages/NotificationsPage.tsx`.
- Cierre: mapear explícitamente cada categoría de la interfaz a los eventos, con pruebas de cada interruptor y preservación de preferencias no modificadas.

### A16 · P2 · Marcar leídas por tipo devuelve un contador falso

- Evidencia reproducida: con dos tipos pendientes, marcar uno devuelve `unreadCount=0`, pero la consulta posterior devuelve 1.
- Archivo: `web/app/Http/Controllers/NotificationController.php:99`.
- Cierre: contar los pendientes reales después de actualizar y sincronizar campana/listado. La interfaz actual puede no usar el filtro, pero el contrato de API sí lo admite.

### A17 · P2 · El visor KYC confunde PDF y video firmados con imágenes

- Evidencia: comprueba `.endsWith('.pdf')` o expresión regular al final de la URL. Los enlaces firmados terminan en parámetros de firma. La expresión devuelve falso para un PDF firmado. MOV se acepta en backend y no se contempla en visor.
- Archivo: `web/frontend/src/components/admin/KYCReviewModal.tsx:88`.
- Cierre: usar MIME o el pathname de la URL, preservando autorización; probar PDF, imagen, MP4, WebM y la política para MOV, además de caducidad del enlace.

### A18 · P2 · Crear administrador con correo duplicado en mayúsculas devuelve 500

- Evidencia reproducida: la unicidad se valida antes de convertir a minúsculas; el insert falla por restricción única.
- Archivo: `web/app/Http/Controllers/AdminController.php:101`.
- Cierre: normalizar antes de validar y devolver error de campo. El registro normal ya tiene esta corrección; no volver a considerarlo pendiente.

### A19 · P2 · Filtros de campañas clasifican mal los estados

- Evidencia estática: «Finalizadas» incluye `approved` y `rejected`, y omite `completed`, `failed` y `cancelled`; «Activas» solo incluye `published`.
- Archivo: `web/frontend/src/components/entrepreneur-profile/CampaignsFeed.tsx:62`.
- Cierre: compartir una clasificación de estados entre API, etiquetas y filtros; comprobar todos los estados con datos de ejemplo.

### A20 · P2 · La fecha de cierre local se interpreta como UTC

- Evidencia: `CampaignForm` agrega `Z` directamente al valor `datetime-local`; al editar usa `toISOString().slice(0,16)`, también en UTC. Una entrada de 20/11/2026 18:00 se envía como 18:00Z, que equivale a 14:00 en Bolivia.
- Archivo: `web/frontend/src/components/CampaignForm.tsx:60`, `:139`, `:212`.
- Cierre: convertir desde hora local a ISO y convertir de vuelta para editar. Verificar ida y vuelta en America/La_Paz y otra zona, sin desplazamiento de hora.

### A21 · P2 · Conversaciones nuevas no aparecen al recibir el primer mensaje

- Evidencia estática: `handleConversationUpdated` solo hace `map()` sobre la lista actual; no inserta ni vuelve a consultar una conversación desconocida.
- Archivo: `web/frontend/src/pages/ChatPage.tsx:98`.
- Cierre: incorporar conversación nueva y ordenar correctamente, sin duplicar mensajes o no leídos. Validar con dos sesiones abiertas, receptor en `/chat` y reconexión.

### A22 · P3 · La portada presenta estadísticas inventadas

- Evidencia: `mockStats` genera likes y comentarios fijos; «100+ donadores activos» y «94% campañas exitosas» son textos constantes.
- Archivo: `web/frontend/src/pages/LandingPage.tsx`.
- Cierre: calcular métricas reales con definición del indicador o retirar las afirmaciones. Diferenciar contenido demostrativo del contenido público.

## Funcionalidades incompletas y decisiones de alcance

| ID | Función | Situación y criterio de cierre |
| --- | --- | --- |
| F01 | Recuperación de contraseña | No hay solicitud, correo y restablecimiento en rutas/UI. Implementar token temporal de un uso, respuesta que no revele si existe una cuenta y recorrido completo |
| F02 | Verificación de correo local | Se muestra «Sin verificar», pero no existe flujo de envío/reenvío/confirmación. Definir cuándo se exige y completar el recorrido |
| F03 | Notificaciones por correo | La preferencia `emailEnabled` se guarda, pero el servicio actual solo crea filas de notificaciones; no despacha correo. Implementar con cola/reintentos o deshabilitar la opción hasta que funcione |
| F04 | Cierre automático de campañas vencidas | El motor bloquea aportes vencidos, pero no hay tarea programada de finalización/reembolso. Implementar política de cierre, idempotencia, reintentos y seguimiento de fallos |
| F05 | Reactivar usuarios suspendidos | Existe desactivación, pero no ruta ni acción de reactivación. Completar si la suspensión debe ser reversible y registrar actor/motivo |
| F06 | Dinero real | Saldo y reembolsos son simulados. Si el producto sigue siendo demostrativo, basta con expresarlo claramente; si manejará dinero real, requiere proyecto separado de cobros, conciliación y desembolsos antes del lanzamiento |
| F07 | Tipos de campaña | El backend acepta donation/reward/equity; el tipo del formulario solo contempla donation y el dashboard transforma equity en donation. Definir el alcance actual y alinear contrato, interfaz y datos importados; no asumir que equity sea funcional |

Los textos «Módulo en Desarrollo» encontrados en perfiles están en ramas de respaldo: las pestañas actuales tienen implementaciones específicas. No se contabilizan como módulos incompletos accesibles sin demostrar un recorrido que llegue a ellas.

## Deuda técnica y verificaciones que faltan

- **Lint:** 373 errores y 11 advertencias, detalle en `docs/auditoria-eslint.txt`. No equivalen a 373 fallos funcionales. Resolver primero orden de hooks, mutaciones, referencias y dependencias; después tipado `any`, variables sin uso y estilo. Acordar reglas que realmente se exigirán en CI.
- **Tamaño de frontend:** bundle principal ~1,65 MB sin comprimir. `App.tsx` importa todas las páginas directamente. Dividir carga por rutas y módulos pesados, medir en dispositivo/conexión representativos y establecer presupuesto de tamaño.
- **Pruebas de frontend:** falta un comando de pruebas frontend y cobertura de recorridos completos que compruebe los contratos usados por las pantallas. Añadir los recorridos de mayor impacto; evitar pruebas que solo repitan implementación.
- **Concurrencia:** comprobar aportes simultáneos, último cupo de recompensa, aporte contra finalización y reembolso repetido en el motor de base de producción. SQLite no reproduce el bloqueo de filas de MySQL/PostgreSQL.
- **Servicios externos:** ejecutar Google OAuth con rol de inversor/emprendedor, rechazo/cancelación y sesión; IA con éxito, timeout y error; correo real cuando exista; WebSocket entre dos sesiones y reconexión. No se clasifican como rotos solo por no haberlos probado.
- **Errores de carga:** varias pantallas convierten fallos HTTP en listas vacías o solo escriben en consola. A06–A08 son ejemplos confirmados. Revisar error visible, reintento y distinción entre vacío/error por recorrido.
- **Presupuestos y balance:** las validaciones por partida no garantizan que el plan total coincida con la meta; el ledger suma gastos de todos los estados. Definir si muestra ejecución declarada o ejecución aprobada antes de imponer una regla o calificar el total como incorrecto.
- **Archivos:** comprobar expiración/renovación de enlaces privados, eliminación de archivos huérfanos y respaldos/restauración. No borrar ni mover archivos heredados sin resolver referencias y preservar respaldo.
- **Navegación y roles:** `PrivateRoute` solo verifica presencia local del token; backend sí comprueba permisos. Revisar redirección por rol/sesión expirada como mejora de experiencia, sin confundirlo con permiso administrativo efectivo.

## Orden de ejecución propuesto

### Seguimiento en GitHub

El trabajo está registrado en el [milestone 4 — Estabilización y corrección de errores del sistema](https://github.com/elingeyesdev/t3-crowdfunding-inversion/milestone/5). Los prefijos 4.x indican el orden acordado; los identificadores Axx conservan la referencia de esta auditoría.

| Issue del milestone | Incidencia | Issue de GitHub |
| --- | --- | --- |
| 4.1 | A01 | [#48](https://github.com/elingeyesdev/t3-crowdfunding-inversion/issues/48) |
| 4.2 | A02 | [#49](https://github.com/elingeyesdev/t3-crowdfunding-inversion/issues/49) |
| 4.3 | A04 | [#50](https://github.com/elingeyesdev/t3-crowdfunding-inversion/issues/50) |
| 4.4 | A12 | [#51](https://github.com/elingeyesdev/t3-crowdfunding-inversion/issues/51) |
| 4.5 | A03 | [#52](https://github.com/elingeyesdev/t3-crowdfunding-inversion/issues/52) |
| 4.6 | A14 | [#53](https://github.com/elingeyesdev/t3-crowdfunding-inversion/issues/53) |
| 4.7 | A19 | [#54](https://github.com/elingeyesdev/t3-crowdfunding-inversion/issues/54) |
| 4.8 | A20 | [#55](https://github.com/elingeyesdev/t3-crowdfunding-inversion/issues/55) |
| 4.9 | A05 | [#56](https://github.com/elingeyesdev/t3-crowdfunding-inversion/issues/56) |
| 4.10 | A06 | [#57](https://github.com/elingeyesdev/t3-crowdfunding-inversion/issues/57) |
| 4.11 | A07 | [#58](https://github.com/elingeyesdev/t3-crowdfunding-inversion/issues/58) |
| 4.12 | A08 | [#59](https://github.com/elingeyesdev/t3-crowdfunding-inversion/issues/59) |
| 4.13 | A10 | [#60](https://github.com/elingeyesdev/t3-crowdfunding-inversion/issues/60) |
| 4.14 | A17 | [#61](https://github.com/elingeyesdev/t3-crowdfunding-inversion/issues/61) |
| 4.15 | A18 | [#62](https://github.com/elingeyesdev/t3-crowdfunding-inversion/issues/62) |
| 4.16 | A09 | [#63](https://github.com/elingeyesdev/t3-crowdfunding-inversion/issues/63) |
| 4.17 | A11 | [#64](https://github.com/elingeyesdev/t3-crowdfunding-inversion/issues/64) |
| 4.18 | A13 | [#65](https://github.com/elingeyesdev/t3-crowdfunding-inversion/issues/65) |
| 4.19 | A15 | [#66](https://github.com/elingeyesdev/t3-crowdfunding-inversion/issues/66) |
| 4.20 | A16 | [#67](https://github.com/elingeyesdev/t3-crowdfunding-inversion/issues/67) |
| 4.21 | A21 | [#68](https://github.com/elingeyesdev/t3-crowdfunding-inversion/issues/68) |
| 4.22 | A22 | [#69](https://github.com/elingeyesdev/t3-crowdfunding-inversion/issues/69) |

Cada corrección parte de `Develop` actualizado, se desarrolla en su propia rama y se integra mediante un PR hacia `Develop`, con revisión del otro colaborador. Este documento y los diagnósticos son una línea base histórica: las issues y los PR registrarán el cierre de cada incidencia.

### Paquetes de trabajo

Cada fila es un paquete de trabajo; las incidencias dentro de él pueden cerrarse individualmente. No se recomiendan fechas hasta acordar alcance y verificar el primer paquete.

| Orden | Trabajo | Incidencias | Condición para pasar al siguiente |
| --- | --- | --- | --- |
| 1 | Proteger información y registros auditados | A01, A02, A04, A12 | Acceso privado probado, relaciones entre campañas válidas y movimientos de sistema protegidos |
| 2 | Consolidar ciclo de campaña | A03, A14, A19, A20, F04 | Revisión obligatoria, fechas correctas, cierre idempotente y enlaces históricos utilizables |
| 3 | Reparar recorridos de cuenta y transparencia | A05, A06, A07, A08, A10, A17, A18 | Pantallas consumen rutas existentes, muestran errores y permiten completar el recorrido |
| 4 | Unificar aportes y recompensas | A09, A11, A13 | Lo confirmado coincide con lo registrado y el donador ve estado/envío/cancelación reales |
| 5 | Sincronizar comunicación | A15, A16, A21, F03 | Preferencias y contadores correctos; chat nuevo visible en dos sesiones |
| 6 | Cerrar alcance y calidad | A22, F01, F02, F05, F06, F07 y deuda técnica | Funciones prometidas implementadas o retiradas explícitamente del alcance; checks obligatorios verdes |

Los errores funcionales de lint se atienden junto con su paquete; la limpieza restante puede avanzar por módulo sin una reescritura general.

## Regla de cierre por incidencia

1. Registrar el resultado esperado y convertir la reproducción en una regresión que inicialmente falle.
2. Corregir backend y frontend afectados por el mismo contrato.
3. Ejecutar la prueba específica y las comprobaciones relevantes; probar visualmente el recorrido afectado.
4. Documentar cambios de datos o migraciones, si hacen falta, preservando respaldo.
5. Cerrar solo con evidencia y sin romper las pruebas existentes.

Antes de incorporar nuevas funcionalidades: cerrar P0/P1, resolver los P2 del alcance acordado, completar los recorridos críticos y hacer pasar los controles de calidad acordados. La aprobación de un producto demostrativo no equivale a la preparación para manejar dinero real.

## Comandos utilizados en la auditoría histórica

El archivo `AuditDiagnosticsTest.php` fue retirado, como indica la nota inicial. Este bloque registra la ejecución original y no es una guía vigente para un checkout limpio. Consulta los [comandos de regresión actuales](../README.md#verificación).

Desde `web/`:

```powershell
php artisan test
php artisan test ../docs/AuditDiagnosticsTest.php
npm run build
npm run lint
```

**Atención al interpretar el segundo comando:** sus aserciones describen errores observados, de modo que pasar significa reproducirlos. Se dejó fuera de la suite habitual deliberadamente. Al corregir una incidencia, trasladar el caso relevante a `tests/Feature/` con el resultado correcto y retirar o actualizar el diagnóstico correspondiente.

La auditoría histórica `docs/AUDITORIA_ACTUAL.md` conserva valor como antecedente, pero este documento es la evaluación más reciente. Su fallo de correo duplicado del registro normal y el orden de hooks de `CampaignAnalyticsDashboard` ya fueron corregidos; el problema de hooks descrito aquí pertenece a otro componente, `PublicFinancialAuditing`.
