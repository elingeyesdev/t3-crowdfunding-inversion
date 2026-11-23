"""Genera la guía HTML, los SVG y las fuentes Mermaid sin dependencias externas.
Ejecutar desde cualquier directorio: python docs/diagramas-web/generar.py
Los flujos describen controles React montados y conectados, revisados el 23/11/2026.
"""
from pathlib import Path
import html
import json
import textwrap
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
FLOWS = []


def step(text, kind="process", link=None):
    return {"text": text, "kind": kind, **({"link": link} if link else {})}


def decision(text, alternative, target=None, main="Sí", other="No", link=None):
    return {"text": text, "kind": "decision", "main": main,
            "branch": {"text": alternative, "target": target, "label": other,
                       **({"link": link} if link else {})}}


def flow(id, role, title, entry, pre, nodes, sources, note="", related=()):
    FLOWS.append(dict(id=id, role=role, title=title, entry=entry, pre=pre,
                      nodes=[step("Inicio", "terminal")] + nodes + [step("Fin", "terminal")],
                      sources=sources.split("|"), note=note, related=list(related)))


PUBLIC = "Visitante y consulta pública"
ACCESS = "Acceso y funciones compartidas"
DONOR = "Donador"
OWNER = "Emprendedor"
ADMIN = "Administrador"
SUPER = "Superadministrador"

flow("V01", PUBLIC, "Explorar y buscar campañas", "Inicio → Explorar · /explore", "No requiere una cuenta.", [
    step("Abrir Inicio y elegir Explorar"),
    step("Escribir una búsqueda y enviarla con Enter; seleccionar una categoría en Sector"),
    decision("¿Hay resultados?", "Cambiar o limpiar los filtros", 2),
    step("Recorrer las páginas y seleccionar una campaña"),
    step("Continuar en V02: consultar la campaña", "connector", "V02"),
], "web/frontend/src/pages/ExploreCampaignsPage.tsx|web/frontend/src/hooks/usePublicCampaigns.ts|web/app/Http/Controllers/CampaignController.php", "Sector permite elegir una categoría o Todos los sectores. No hay un selector visible de orden. Se puede abrir una sugerencia de búsqueda directamente o usar Ver todos los resultados. La paginación aparece cuando hay más de una página.", ("V02", "V03", "V04"))

flow("V02", PUBLIC, "Consultar una campaña", "Explorar → seleccionar campaña · /campaign/:id", "Campaña visible públicamente.", [
    step("Abrir la ficha de la campaña"),
    decision("¿La campaña está disponible?", "Volver a Explorar; si falló la carga, usar Reintentar", link="V01"),
    step("Leer el título, resumen, creador, Recaudado, Meta, Donantes y Días Restantes"),
    step("Localizar Historia y Proyecto, Transparencia y Fondos e Hitos y Avances"),
    step("Si Comentarios no aparece, desplazar horizontalmente esa misma barra hacia la derecha"),
    decision("¿Quieres conocer el proyecto?", "Pulsar Historia y Proyecto; leer Historia del Proyecto, recompensas y Sobre el Emprendedor", main="No", other="Sí"),
    decision("¿Quieres consultar fondos y evidencias?", "Pulsar Transparencia y Fondos; continuar con sus opciones en V06", main="No", other="Sí", link="V06"),
    decision("¿Quieres consultar los avances?", "Pulsar Hitos y Avances; consultar los hitos y las novedades publicadas", main="No", other="Sí"),
    decision("¿Quieres leer o publicar comentarios?", "Pulsar Comentarios, a la derecha de Hitos y Avances; para participar, seguir C09", main="No", other="Sí", link="C09"),
    decision("¿Quieres realizar un aporte?", "Consultar las condiciones del aporte y continuar con D03", main="No", other="Sí", link="D03"),
    decision("¿Quieres compartir la campaña?", "Pulsar Compartir Campaña y continuar con V05", main="No", other="Sí", link="V05"),
    decision("¿Quieres contactar al creador?", "En Historia y Proyecto, bajar hasta Sobre el Emprendedor; continuar con C03", main="No", other="Sí", link="C03"),
    step("Volver a Explorar para consultar otra campaña", "connector", "V01"),
], "web/frontend/src/pages/CampaignDetailPage.tsx|web/app/Models/Campaign.php", "La barra principal tiene cuatro pestañas. Comentarios está a la derecha de Hitos y Avances y puede quedar fuera de la zona visible; desplaza la barra horizontalmente para encontrarlo. Después de consultar una sección, puedes elegir otra pestaña. Las campañas cerradas conservan la información pública y los comentarios para consulta, pero ya no permiten nuevos aportes ni participación en comentarios.", ("V06", "C09", "V05", "C03", "D03"))

flow("V03", PUBLIC, "Descubrir campañas con DonaTok", "Barra superior → DonaTok · /donatok", "No requiere una cuenta.", [
    step("Entrar en DonaTok"),
    decision("¿Hay campañas con video?", "Volver a Explorar para buscar otras campañas", link="V01"),
    step("Ver el video y el resumen de la campaña"),
    decision("¿Quieres abrir la campaña?", "Desplazarse verticalmente al siguiente video", 3),
    step("Pulsar Ver Campaña y Donar"),
    step("Continuar en V02", "connector", "V02"),
], "web/frontend/src/pages/PitchFeedPage.tsx|web/frontend/src/components/campaigns/PitchVideoPlayer.tsx", related=("V01", "V02"))

flow("V04", PUBLIC, "Ver historias y novedades recientes", "Explorar → barra de historias", "Debe existir una actualización pública reciente.", [
    step("Abrir Explorar y localizar los avatares de historias"),
    decision("¿Hay historias disponibles?", "No hay historias recientes; consultar una campaña en V02", link="V02"),
    step("Seleccionar un avatar para abrir sus novedades"),
    step("Leer las novedades y avanzar o retroceder entre historias"),
    step("Cerrar el visor; para conocer el proyecto, buscar su campaña en Explorar"),
], "web/frontend/src/components/StoriesAvatarBar.tsx|web/app/Http/Controllers/CampaignController.php", "La barra agrupa actualizaciones públicas de las últimas 24 horas; no es un registro de todas las novedades.", ("V02", "D06", "E09"))

flow("V05", PUBLIC, "Compartir una campaña", "Ficha de campaña → Compartir Campaña; en Explorar → icono de compartir", "Campaña disponible en el catálogo público.", [
    step("Pulsar Compartir Campaña en la ficha, o el icono de compartir de su tarjeta en Explorar"),
    decision("¿Quieres copiar el enlace?", "Elegir WhatsApp, Facebook, X o LinkedIn; se abre el servicio externo", main="Sí", other="Red social"),
    step("Pulsar Copiar enlace"),
    step("Comprobar la confirmación de copia y pegarlo donde corresponda"),
    step("Cerrar la ventana para seguir navegando"),
], "web/frontend/src/components/ShareModal.tsx|web/frontend/src/pages/ExploreCampaignsPage.tsx|web/frontend/src/pages/CampaignDetailPage.tsx", "En redes sociales, la publicación se completa en el servicio externo. UniFundme abre el enlace de compartir.", ("V02",))

flow("V06", PUBLIC, "Consultar fondos, evidencias e hitos", "Ficha de campaña → Transparencia y Fondos", "No requiere sesión; solo se muestran los documentos autorizados para publicación.", [
    step("En la barra principal de la campaña, pulsar Transparencia y Fondos"),
    step("Localizar Plan de Fondos, Auditoría y Movimientos, Hitos del Proyecto, Evidencias y Bitácora"),
    step("Si alguna opción no aparece, desplazar horizontalmente la barra de submenús hacia la derecha"),
    step("Pulsar Plan de Fondos para consultar la distribución prevista del dinero"),
    step("Pulsar Auditoría y Movimientos para consultar recaudación, gráficos y aportes recientes"),
    step("En los aportes recientes, elegir Todos, Directos o Recompensas"),
    step("Pulsar Hitos del Proyecto para consultar las etapas y su estado"),
    step("Pulsar Evidencias; el número junto al nombre indica cuántos documentos hay"),
    decision("¿Hay evidencias públicas?", "La sección muestra No hay evidencias públicas disponibles; continuar con Bitácora", 11),
    step("Pulsar Abrir documento en la evidencia elegida; se abre en otra pestaña"),
    step("Volver a la campaña y pulsar Bitácora para consultar las novedades publicadas"),
    step("Para ver hitos y novedades juntos, pulsar Hitos y Avances en la barra principal"),
], "web/frontend/src/components/campaign-detail/CampaignTransparencySection.tsx|web/frontend/src/components/campaign-detail/transparency/PublicFinancialAuditing.tsx|web/frontend/src/components/campaign-detail/transparency/PublicEvidenceDocuments.tsx|web/frontend/src/components/campaign-detail/transparency/ProjectMilestones.tsx|web/app/Http/Controllers/CampaignReadController.php", "Los hitos y planes que aparezcan como ejemplos o valores de respaldo de la interfaz no deben interpretarse como información registrada del proyecto.", ("V02", "A05"))

flow("V07", PUBLIC, "Asistente IA: no disponible", "Inicio", "El asistente IA todavía no está disponible.", [
    step("El asistente IA no está disponible por el momento"),
    step("Consultar el índice de esta guía y elegir la funcionalidad que necesitas"),
], "web/frontend/src/pages/LandingPage.tsx|web/frontend/src/components/AISupportChat.tsx|web/app/Http/Controllers/AiController.php", "Aunque aparezca un botón de chat en Inicio, el asistente IA no está habilitado actualmente. Puedes consultar los diagramas de esta guía para conocer cómo usar la plataforma.")

flow("C01", ACCESS, "Crear una cuenta", "Iniciar sesión → registro · /register", "Disponible para donador y emprendedor.", [
    step("Abrir Crea tu cuenta"),
    step("Elegir Donador o Emprendedor"),
    step("Ingresar correo y contraseña; enviar el formulario"),
    decision("¿Se completaron registro e inicio de sesión?", "Revisar el error: corregir datos o ir a Iniciar sesión si la cuenta ya existe", 3),
    decision("¿Elegiste Donador?", "Se abre Mi Perfil de emprendedor; continuar en E01", link="E01"),
    step("Se abre Mi Panel; completar Mi Perfil con D01", "connector", "D01"),
], "web/frontend/src/pages/RegisterPage.tsx|web/app/Http/Controllers/AuthController.php", "El registro público no crea administradores. La contraseña local exige al menos 8 caracteres, una mayúscula y un número.", ("C02", "D01", "E01"))

flow("C02", ACCESS, "Iniciar sesión con correo", "Barra superior → Iniciar Sesión · /login", "Cuenta existente y activa.", [
    step("Abrir Iniciar sesión e ingresar correo y contraseña"),
    step("Opcional: marcar Recordarme para conservar el correo"),
    step("Enviar el formulario"),
    decision("¿Las credenciales y la cuenta son válidas?", "Leer el error, corregir los datos y volver a intentar", 1),
    decision("¿Es una cuenta administrativa?", "Volver a la ruta solicitada; si no hay una, abrir Mi Panel o Mi Perfil", main="Sí"),
    step("Administrador: /admin; superadministrador: /superadmin"),
], "web/frontend/src/pages/LoginPage.tsx|web/app/Http/Controllers/AuthController.php", "Recordarme conserva el correo. Si una pantalla protegida pide iniciar sesión, usar este flujo y regresar a la función correspondiente.", ("D02", "E01", "A01", "S01", "C08"))

flow("C08", ACCESS, "Acceso con Google: no disponible", "Inicio de sesión o registro", "El acceso con Google todavía no está disponible.", [
    step("El acceso con Google no está disponible por el momento"),
    step("Para iniciar sesión con correo y contraseña, continuar en C02", "connector", "C02"),
], "web/frontend/src/pages/LoginPage.tsx|web/frontend/src/pages/RegisterPage.tsx|web/frontend/src/pages/OAuthCallbackPage.tsx|web/app/Http/Controllers/AuthController.php", "Aunque aparezca el botón de Google, utiliza el acceso con correo y contraseña. Si aún no tienes una cuenta, puedes crearla con tu correo en C01.", ("C02", "C01"))

flow("C03", ACCESS, "Iniciar o continuar una conversación", "Historia y Proyecto → Sobre el Emprendedor → Contactar Emprendedor; para conversaciones existentes: Mensajes", "Sesión iniciada. Para una nueva conversación se selecciona al creador de una campaña.", [
    step("En Historia y Proyecto, bajar hasta Sobre el Emprendedor y pulsar Contactar Emprendedor"),
    decision("¿Hay una sesión iniciada?", "Iniciar sesión y volver a la campaña", link="C02"),
    step("Abrir o recuperar la conversación; también se puede elegir una en Mensajes"),
    step("Leer el historial; subir o pulsar Ver mensajes anteriores cuando aparezca"),
    step("Escribir el mensaje y pulsar el botón con el icono de enviar"),
    decision("¿Se envió correctamente?", "Revisar la conexión y reintentar el envío", 5),
    step("Leer la respuesta; seguir conversando o seleccionar otra conversación"),
], "web/frontend/src/pages/CampaignDetailPage.tsx|web/frontend/src/pages/ChatPage.tsx|web/frontend/src/components/chat/ChatWindow.tsx|web/app/Http/Controllers/ChatController.php", "No se puede abrir una conversación consigo mismo. Mensajes muestra conversaciones existentes; no se documenta un buscador general para iniciar chats.", ("V02", "C02"))

flow("C04", ACCESS, "Leer y gestionar notificaciones", "Campana → centro de notificaciones · /notifications", "Sesión iniciada.", [
    step("Pulsar la campana y abrir el centro de notificaciones"),
    step("Buscar y filtrar por estado y categoría; recorrer las páginas"),
    decision("¿Hay notificaciones coincidentes?", "Restablecer filtros o volver más tarde", 2),
    step("Abrir una notificación: se marca leída y navega a su destino si tiene enlace"),
    step("Volver al centro para marcar todas como leídas, eliminar una o limpiar las leídas"),
], "web/frontend/src/components/NotificationBell.tsx|web/frontend/src/pages/NotificationsPage.tsx|web/app/Http/Controllers/NotificationController.php", related=("C05", "D04", "E04", "A04"))

flow("C05", ACCESS, "Configurar preferencias de notificación", "Centro de notificaciones → Preferencias", "Sesión iniciada.", [
    step("Abrir el centro y pulsar Preferencias"),
    step("Activar o desactivar las opciones disponibles de notificaciones"),
    step("Guardar preferencias"),
    decision("¿Se guardaron los cambios?", "Revisar el error y volver a guardar", 2),
    step("Ver la confirmación; la ventana se cierra y regresa al centro"),
], "web/frontend/src/pages/NotificationsPage.tsx|web/app/Http/Controllers/NotificationController.php", related=("C04",))

flow("C06", ACCESS, "Cambiar la contraseña", "Barra superior → Configuración · /account-settings", "Sesión iniciada; la edición requiere contraseña local.", [
    step("Abrir Configuración de Cuenta → Seguridad y Acceso"),
    decision("¿La cuenta tiene contraseña local?", "Esta cuenta no permite cambiar la contraseña desde esta pantalla", main="Sí"),
    step("Ingresar contraseña actual, nueva contraseña y confirmación"),
    step("Pulsar Actualizar contraseña"),
    decision("¿Los datos son válidos?", "Corregir contraseña actual, requisitos o coincidencia y reenviar", 3),
    step("Confirmar el éxito; la sesión actual continúa y se cierran las demás"),
], "web/frontend/src/pages/AccountSettingsPage.tsx|web/app/Http/Controllers/AuthController.php", "La web revisada no ofrece recuperación de contraseña por correo.", ("C02", "C07"))

flow("C07", ACCESS, "Cerrar sesión", "Barra superior → Salir; panel admin → Cerrar Sesión", "Sesión iniciada.", [
    step("Pulsar Salir o Cerrar Sesión"),
    step("Si se usa Configuración, confirmar Cerrar sesión; cancelar conserva la sesión"),
    step("El sistema cierra la sesión y limpia el acceso local"),
    step("Volver al login; una pantalla privada requiere autenticarse de nuevo"),
], "web/frontend/src/components/Navbar.tsx|web/frontend/src/components/admin/AdminLayout.tsx|web/frontend/src/pages/AccountSettingsPage.tsx|web/frontend/src/api/auth.api.ts", related=("C02",))

flow("D01", DONOR, "Crear o editar el perfil de donador", "Barra superior → Mi Perfil · /profile", "Cuenta de donador y sesión iniciada.", [
    step("Abrir Mi Perfil; si no existe, se propone completar el perfil"),
    step("Elegir Editar o una sección: datos básicos, fiscales, ubicación o preferencias"),
    step("Completar los datos y guardar"),
    decision("¿Se guardaron correctamente?", "Corregir los campos indicados y volver a guardar", 3),
    step("Opcional: cambiar foto o portada con sus controles de imagen"),
    step("Consultar Información, Donaciones o Capital / Fondos del perfil"),
], "web/frontend/src/pages/InvestorProfilePage.tsx|web/frontend/src/components/investor-profile/EditProfileModal.tsx|web/frontend/src/components/investor-profile/ProfileHeader.tsx|web/app/Http/Controllers/ProfileController.php", "Los datos del perfil se guardan por secciones. El rol donador se denomina investor en las rutas y el código.", ("D02", "D03", "D04"))

flow("D02", DONOR, "Consultar el panel y aumentar capital simulado", "Barra superior → Mi Panel · /dashboard", "Perfil de donador creado; límite de capital configurado para ver el botón de aumento.", [
    step("Abrir Mi Panel y revisar capital disponible, total donado y donaciones"),
    decision("¿Aparece Aumentar Capital?", "Completar el perfil y configurar sus preferencias de capital", link="D01"),
    step("Pulsar Aumentar Capital"),
    step("Elegir o escribir un monto; agregar notas si se desea"),
    decision("¿El monto es al menos Bs. 100?", "Corregir el monto", 4),
    step("Enviar y comprobar la confirmación y el saldo actualizado"),
], "web/frontend/src/pages/InvestorDashboardPage.tsx|web/frontend/src/components/InvestorDashboardOverview.tsx|web/frontend/src/components/AddCapitalModal.tsx|web/app/Http/Controllers/ProfileController.php", "Se aumenta saldo simulado. Este flujo no cobra a tarjetas ni registra una transferencia bancaria real.", ("D01", "D03"))

flow("D03", DONOR, "Donar a una campaña", "Ficha de campaña → formulario de donación", "Sesión de donador y perfil creado; disponer de saldo simulado.", [
    step("Abrir la campaña elegida", "connector", "V02"),
    decision("¿Acepta donaciones y sigue vigente?", "Elegir otra campaña: esta está cerrada, financiada o no disponible", link="V01"),
    step("Ingresar el monto; opcionalmente elegir un nivel en Historia y Proyecto → Niveles de Recompensa"),
    decision("¿Cumple monto y condiciones de recompensa?", "Ajustar monto o recompensa: revisar mínimos, máximos, vigencia y cupos", 3),
    step("Pulsar Donar Bs. [monto] y revisar la ventana Confirmar Aporte"),
    decision("¿Confirmar el aporte?", "Cancelar y volver al formulario", 3),
    decision("¿El servidor acepta el aporte?", "Leer el error: revisar rol, perfil, saldo, meta restante o recompensa; corregir y reintentar", 3),
    step("Ver el aporte confirmado; descargar el PDF o abrir Mi Panel para consultar el saldo"),
], "web/frontend/src/pages/CampaignDetailPage.tsx|web/frontend/src/components/campaign-detail/ContributionConfirmModal.tsx|web/app/Services/InvestmentEngine.php", "No se puede aportar a la propia campaña ni superar lo que falta para alcanzar la meta. Si falta sesión, seguir C02. Si falta saldo, seguir D02. Los cobros son simulados.", ("C02", "D01", "D02", "D04", "D05"))

flow("D04", DONOR, "Consultar donaciones e historial", "Mi Panel → Mis Aportes · /dashboard?tab=contributions", "Sesión de donador.", [
    step("Abrir Mi Panel y seleccionar Mis Aportes"),
    step("Buscar por campaña; filtrar Todos, Completados o Pendientes y elegir un orden"),
    decision("¿Hay aportes coincidentes?", "Limpiar filtros o explorar campañas para realizar el primero", link="V01"),
    step("Revisar campaña, fecha, monto y estado de cada aporte"),
    step("Pulsar Ver Proyecto; si el aporte está completado, descargar su Recibo"),
], "web/frontend/src/pages/InvestorDashboardPage.tsx|web/frontend/src/components/donor-tracking/DonorContributionsFeed.tsx|web/app/Http/Controllers/InvestmentController.php", "El perfil también muestra un historial en su pestaña Donaciones.", ("V02", "D05", "D08"))

flow("D05", DONOR, "Descargar comprobantes PDF", "Mi Panel → Comprobantes · /dashboard?tab=receipts", "Tener una donación completada; esta pestaña solo lista esos aportes y solo el titular descarga sus recibos.", [
    step("Abrir Comprobantes y buscar por proyecto o código de recibo"),
    decision("¿Se encontró un comprobante?", "Limpiar la búsqueda; si no hay aportes completados, realizar uno", link="D03"),
    step("Pulsar Descargar PDF"),
    decision("¿Se generó la descarga?", "Leer el error y volver a intentar", 3),
    step("Guardar o abrir el PDF desde las descargas del navegador"),
], "web/frontend/src/components/donor-tracking/DonorReceiptsList.tsx|web/app/Http/Controllers/InvestmentController.php", "También puede descargarse justo después de donar o desde el historial. La descarga técnica no acredita por sí sola validez tributaria.", ("D03", "D04"))

flow("D06", DONOR, "Seguir novedades de proyectos apoyados", "Mi Panel → Novedades · /dashboard?tab=updates", "Sesión de donador; tener campañas apoyadas para ver novedades asociadas.", [
    step("Abrir Novedades en Mi Panel"),
    step("Elegir todos los proyectos o una campaña concreta"),
    decision("¿Hay novedades publicadas?", "Mostrar el estado sin novedades; cambiar filtro o volver más tarde", 2),
    step("Leer las publicaciones y consultar sus imágenes o videos"),
    step("Usar Anterior o Siguiente si aparecen, o pulsar Ver Campaña para abrir el proyecto"),
], "web/frontend/src/components/donor-tracking/DonorBackedUpdatesFeed.tsx|web/frontend/src/hooks/useBackedCampaignUpdates.ts|web/app/Http/Controllers/InvestmentController.php", related=("V02", "E09"))

flow("D07", DONOR, "Consultar el seguimiento de recompensas", "Mi Panel → Recompensas · /dashboard?tab=rewards", "Tener aportes con recompensa seleccionada.", [
    step("Abrir Recompensas en Mi Panel"),
    step("Buscar por recompensa o proyecto y filtrar por estado"),
    decision("¿Hay recompensas coincidentes?", "Limpiar filtros; los aportes sin recompensa no generan seguimiento", 2),
    step("Consultar el estado: espera, preparación, envío, entrega, incidencia o cancelación"),
    step("Abrir el seguimiento externo si existe o consultar la campaña"),
], "web/frontend/src/components/donor-tracking/DonorRewardsTracker.tsx|web/frontend/src/utils/rewardTracking.ts", "El donador consulta el estado; la web no incluye un formulario propio para confirmar entrega o reportar incidencias de la recompensa.", ("E08", "C03"))

flow("D08", DONOR, "Consultar estadísticas y reembolsos", "Mi Panel → Rendimiento · /dashboard?tab=analytics", "Sesión de donador.", [
    step("Abrir Rendimiento en Mi Panel"),
    decision("¿Existen donaciones completadas?", "Mostrar la invitación a realizar la primera donación", link="D03"),
    step("Consultar aporte promedio, monto reembolsado y evolución acumulada"),
    step("Para ver un reembolso concreto, abrir Mis Aportes"),
    step("Revisar estado Reembolsado y capital disponible actualizado"),
], "web/frontend/src/components/InvestorDashboardAnalytics.tsx|web/frontend/src/components/donor-tracking/DonorContributionsFeed.tsx|web/app/Services/InvestmentEngine.php", "La devolución se registra al finalizar sin alcanzar la meta. No hay solicitud manual de reembolso desde el panel. Si no quedan aportes completados, Rendimiento puede mostrar el estado inicial: consultar el historial.", ("D04", "D02", "E10"))

flow("C09", ACCESS, "Publicar comentarios y marcar Me gusta", "Ficha de campaña → barra principal → Comentarios, a la derecha de Hitos y Avances", "La lectura es pública. Para participar, la campaña debe admitir comentarios y debes iniciar sesión como donador o emprendedor.", [
    step("Abrir la campaña y localizar la barra de Historia y Proyecto, Transparencia y Fondos e Hitos y Avances"),
    step("Desplazar esa barra horizontalmente a la derecha, si hace falta, y pulsar Comentarios"),
    step("Leer los comentarios existentes en la sección Comentarios"),
    decision("¿La campaña permite participar?", "La campaña está cerrada: sus comentarios se conservan solo para consulta"),
    decision("¿Hay una sesión de donador o emprendedor?", "Pulsar Inicia sesión y seguir C02; después regresar a Comentarios", link="C02"),
    step("Si quieres comentar: escribir en Escribe un comentario... y pulsar el icono de enviar"),
    step("Si quieres marcar Me gusta: pulsar el icono de pulgar arriba del comentario elegido"),
    decision("¿Se registró la acción?", "Comprobar el resultado; corregir el texto o revisar el acceso e intentar de nuevo", 6),
    step("Ver el comentario o el contador actualizado; otro clic alterna el Me gusta"),
], "web/frontend/src/pages/CampaignDetailPage.tsx|web/frontend/src/components/campaign-detail/CampaignComments.tsx|web/app/Http/Controllers/CommunityController.php", "Comentarios es una cuarta pestaña principal; no está dentro de Transparencia y Fondos. El cuadro admite hasta 2000 caracteres. Puedes comentar o marcar Me gusta de forma independiente. La lectura no exige iniciar sesión, pero las campañas cerradas no permiten publicar ni dar Me gusta.", ("V02", "C02"))

flow("E01", OWNER, "Crear o editar el perfil de emprendedor", "Barra superior → Mi Perfil · /entrepreneur-profile", "Cuenta de emprendedor y sesión iniciada.", [
    step("Abrir Mi Perfil y crear los datos básicos si aún no existe"),
    step("Editar biografía, empresa, sitio web, LinkedIn y ubicación"),
    step("Guardar cada sección; completar también los datos bancarios si corresponde"),
    decision("¿Los datos se guardaron?", "Corregir los campos indicados y guardar de nuevo", 2),
    step("Opcional: cambiar foto o portada y consultar Información, Datos Bancarios o Finanzas"),
    step("Continuar con verificación de identidad E02", "connector", "E02"),
], "web/frontend/src/pages/EntrepreneurProfilePage.tsx|web/frontend/src/components/entrepreneur-profile/EditProfileModal.tsx|web/app/Services/ProfileReadiness.php", "Para crear campañas el servidor exige biografía de al menos 30 caracteres, empresa o proyecto de al menos 2, sitio web y LinkedIn válidos, país e identidad verificada. El porcentaje visual de perfil no sustituye esta validación.", ("E02", "E03", "E12"))

flow("E02", OWNER, "Solicitar verificación de identidad KYC", "Mi Perfil → Iniciar Verificación; Mis Campañas → Verificar Identidad / Reintentar KYC", "Perfil de emprendedor creado; no tener una solicitud ya pendiente. KYC significa verificación de identidad.", [
    step("Pulsar Iniciar Verificación, Verificar Identidad o Reintentar KYC según la pantalla"),
    step("Paso 1: adjuntar documento oficial legible en formato permitido"),
    step("Paso 2: tomar una selfie con la cámara o adjuntar selfie/video con documento"),
    decision("¿Ambos archivos cumplen las reglas?", "Revisar formato, tamaño o permisos de cámara y reemplazar el archivo", 2),
    step("Pulsar Enviar a Revisión y esperar la revisión administrativa A04"),
    decision("¿La identidad fue aprobada?", "Pendiente: esperar. Rechazada: leer el motivo y volver a E02 para reenviar", link="E02"),
    step("Ver el estado verificado y continuar con la creación de campañas"),
], "web/frontend/src/components/KYCUploadModal.tsx|web/frontend/src/utils/kycFiles.ts|web/app/Http/Controllers/ProfileController.php|web/app/Http/Controllers/AdminController.php", "Los documentos KYC son privados. Si vence un enlace de revisión, se vuelve a cargar desde la pantalla autorizada.", ("A04", "E01", "E03", "C04"))

flow("E03", OWNER, "Crear una campaña y guardarla como borrador", "Mis Campañas → Lanzar Campaña · /entrepreneur-campaigns", "Perfil completo e identidad KYC aprobada.", [
    step("Abrir Mis Campañas y pulsar Lanzar Campaña"),
    decision("¿El perfil cumple los requisitos?", "Completar perfil o solicitar KYC; volver cuando esté aprobado", link="E01"),
    step("Completar título, eslogan, descripción, categorías, meta y fecha de cierre si corresponde"),
    step("Agregar portada o video si se desea; definir recompensas si corresponde"),
    step("Seleccionar respaldo, escribir justificación y pulsar Añadir Documento"),
    step("Pulsar Guardar Borrador y confirmar"),
    decision("¿Se creó correctamente?", "Leer el error y corregir los datos antes de volver a guardar", 3),
    step("Ver el borrador en Mis Campañas; abrir vista previa y comprobar archivos"),
], "web/frontend/src/components/CampaignForm.tsx|web/frontend/src/pages/MyCampaignsPage.tsx|web/frontend/src/hooks/useCampaigns.ts|web/app/Http/Controllers/CampaignController.php", "El formulario exige título de 5–50 caracteres, eslogan de 10–50, descripción de 50–800, meta de al menos Bs. 100 y una categoría. La fecha puede omitirse al guardar, pero se requiere una fecha futura para publicar. El video opcional es de YouTube o TikTok. En Mis Campañas se usa Guardar Borrador y luego E04; desde Mi Perfil → Campañas también existe Enviar a Revisión. Añadir al menos un respaldo es obligatorio. Comprobar portada y documentos: una carga posterior puede fallar aunque se haya creado el borrador.", ("E01", "E02", "E04", "E06"))

flow("E04", OWNER, "Enviar una campaña a revisión y corregir rechazos", "Mis Campañas → Vista Previa → Enviar Revisión", "Campaña propia en borrador o rechazada.", [
    step("Buscar la campaña y abrir Vista Previa"),
    step("Revisar Detalles de Proyecto, Documentación e historial"),
    decision("¿Está lista para revisión?", "Editar los datos permitidos y guardar los cambios", link="E06"),
    step("Pulsar Enviar Revisión y comprobar el estado pendiente"),
    step("Esperar revisión del administrador A03"),
    decision("¿La campaña fue aprobada?", "Pendiente: esperar. Rechazada: leer el motivo, corregir con E06 y reenviar", link="E06"),
    step("Continuar con E05 para lanzarla públicamente", "connector", "E05"),
], "web/frontend/src/components/CampaignPreviewModal.tsx|web/frontend/src/hooks/useCampaigns.ts|web/app/Http/Controllers/CampaignController.php", "La vista previa permite reenviar campañas rechazadas. La tarjeta muestra el envío directo solo para borradores.", ("E06", "A03", "E05", "C04"))

flow("E05", OWNER, "Publicar una campaña aprobada", "Mis Campañas → campaña aprobada → Lanzar", "Campaña aprobada; identidad vigente y fecha de cierre futura.", [
    step("Localizar la campaña en estado Aprobada"),
    step("En Vista Previa pulsar Lanzar, o pulsar Publicar Campaña en la tarjeta"),
    decision("¿Se permite la publicación?", "Leer el error; revisar KYC y fecha de cierre antes de volver a intentar", 1),
    step("Ver el estado Publicada"),
    step("Consultar la campaña en Explorar y compartirla"),
], "web/frontend/src/components/CampaignCard.tsx|web/frontend/src/components/CampaignPreviewModal.tsx|web/app/Services/CampaignPublication.php|web/app/Http/Controllers/CampaignController.php", "Aprobar no publica automáticamente. Si una fecha de cierre vencida bloquea el lanzamiento y la edición no está disponible por el estado, la web no ofrece una corrección directa.", ("E04", "V02", "V05"))

flow("E06", OWNER, "Consultar, filtrar y editar campañas propias", "Barra superior → Mis Campañas · /entrepreneur-campaigns", "Sesión de emprendedor.", [
    step("Buscar por título y elegir una pestaña de estado; alternar vista de tarjetas o lista"),
    step("Abrir la campaña en Vista Previa"),
    step("Consultar detalles, historial, documentos y las pestañas disponibles"),
    decision("¿Está en borrador o rechazada?", "La edición está bloqueada; continuar con consulta o gestión permitida"),
    step("Pulsar Editar, modificar datos, adjuntar respaldo requerido y guardar"),
    decision("¿Se guardó correctamente?", "Corregir el error y guardar nuevamente", 5),
    step("Volver a la lista y comprobar el resultado"),
], "web/frontend/src/pages/MyCampaignsPage.tsx|web/frontend/src/components/CampaignPreviewModal.tsx|web/frontend/src/components/CampaignForm.tsx|web/app/Http/Controllers/CampaignController.php", "Mis Campañas filtra las campañas cargadas y no muestra controles de orden ni de paginación. El formulario exige agregar respaldo incluso al editar. El botón visible es Guardar Borrador; Descartar pide confirmación. Para reemplazar la portada, usar la edición de campaña; el acceso Actualizar Portada de la vista previa se conecta desde Mi Perfil, no desde Mis Campañas.", ("E04", "E07", "E08", "E11"))

flow("E07", OWNER, "Consultar recaudación, estadísticas y donadores", "Mis Campañas → Vista Previa → Progreso Económico / Donadores Activos", "Campaña propia publicada o financiada para estas pestañas.", [
    step("Abrir Vista Previa de la campaña"),
    step("Seleccionar Progreso Económico"),
    step("Consultar recaudación, evolución, desglose y proyección"),
    step("Seleccionar Donadores Activos"),
    decision("¿Hay donadores registrados?", "Mostrar el listado vacío; volver al progreso de la campaña"),
    step("Recorrer las páginas y abrir la ficha de un donador para consultar sus datos"),
], "web/frontend/src/components/CampaignPreviewModal.tsx|web/frontend/src/components/CampaignAnalyticsDashboard.tsx|web/frontend/src/components/CampaignInvestorsTab.tsx", "Las proyecciones son estimaciones. El perfil del emprendedor también muestra un resumen financiero. La lista de donadores anuncia mensajería futura: no se documenta como acción operativa desde esa lista.", ("E06", "C03"))

flow("E08", OWNER, "Consultar recompensas y actualizar sus entregas", "Mis Campañas → Vista Previa → Recompensas", "Campaña propia; la pestaña se muestra cuando la campaña ya tiene niveles de recompensa.", [
    step("Abrir Recompensas desde Vista Previa"),
    step("Consultar título, descripción y rango de cada nivel"),
    decision("¿Hay donadores con recompensas?", "No hay entregas para actualizar; volver cuando exista un aporte con recompensa"),
    step("Para entregas: desplegar Donadores con Recompensas"),
    decision("¿El selector permite cambiar el estado?", "Consultar solamente: no hay transiciones disponibles para ese registro"),
    step("Elegir en cada registro uno de los estados de seguimiento permitidos"),
    decision("¿Se guardó el nuevo estado?", "Revisar el error; la lista intenta recargar el estado vigente antes de reintentar", 6),
    step("El donador consulta el estado actualizado en D07"),
], "web/frontend/src/components/CampaignPreviewModal.tsx|web/frontend/src/components/CampaignRewardsTab.tsx|web/app/Http/Controllers/RewardController.php|web/app/Models/RewardClaim.php", "La vista previa monta los niveles en modo de solo lectura, pero habilita el selector de entregas para el propietario. Crear o editar niveles se hace desde el formulario de campaña E03/E06, en los estados que permiten editar. El seguimiento avanza de pendiente a preparación, enviada y entregada, o se cancela cuando el selector lo permite. Entregadas, canceladas y aportes reembolsados no se editan.", ("E03", "E06", "D07"))

flow("E09", OWNER, "Publicar una actualización con texto, imagen o video", "Mis Campañas → campaña publicada → Publicar Novedad", "Campaña propia publicada; usar la acción disponible de la tarjeta.", [
    step("Elegir Publicar Novedad en la campaña"),
    step("Ingresar título de al menos 3 caracteres y contenido de al menos 10"),
    step("Elegir texto, imagen o video; adjuntar el archivo si corresponde"),
    decision("¿Cumple los requisitos del formulario?", "Completar título, contenido y archivo requerido", 2),
    step("Publicar y esperar la confirmación"),
    decision("¿Se publicó correctamente?", "Leer el error y volver a intentar", 2),
    step("Abrir la campaña y pulsar Hitos y Avances; los donadores también la ven en Mi Panel → Novedades"),
], "web/frontend/src/components/CampaignCard.tsx|web/frontend/src/components/PublishUpdateModal.tsx|web/app/Http/Controllers/CampaignController.php", "El formulario publica novedades públicas. Las recientes también pueden aparecer en la barra de historias.", ("D06", "V04", "V02"))

flow("E10", OWNER, "Finalizar una campaña desde la web", "Mis Campañas → tarjeta publicada → Finalizar Campaña", "La tarjeta web ofrece Finalizar Campaña cuando el estado es Publicada.", [
    step("Localizar la campaña publicada y pulsar Finalizar Campaña"),
    decision("¿Confirmar la finalización?", "Cancelar y conservar la campaña sin finalizar"),
    step("El sistema comprueba el estado y procesa la finalización"),
    decision("¿La finalización fue aceptada?", "Leer el error en Mis Campañas y volver a cargar antes de intentar otra acción"),
    step("Consultar el estado actualizado y abrir Vista Previa para ver el historial"),
    step("Si quedó Fallida, los donadores consultan la devolución en Mis Aportes y Mi Panel"),
], "web/frontend/src/components/CampaignCard.tsx|web/frontend/src/hooks/useCampaigns.ts|web/app/Services/InvestmentEngine.php", "Sin alcanzar la meta, el sistema marca Fallida, devuelve saldo simulado y cancela recompensas. Con la meta alcanzada, el servidor puede registrar Completada, pero la tarjeta ya no ofrece Finalizar al pasar a Financiada. No se presenta esa capacidad del servidor como una acción disponible en la web. El vencimiento por sí solo no ejecuta la finalización.", ("D08", "D04", "C04"))

flow("E11", OWNER, "Eliminar un borrador o campaña rechazada", "Mis Campañas → menú de la tarjeta → Eliminar", "Campaña propia en borrador o rechazada.", [
    step("Abrir el menú de la campaña y elegir Eliminar"),
    decision("¿Confirmar la eliminación?", "Cancelar y regresar a la lista"),
    decision("¿No tiene aportes ni movimientos con trazabilidad?", "El sistema bloquea la eliminación; conservar la campaña"),
    step("Eliminar la campaña y comprobar que ya no aparece en la lista"),
], "web/frontend/src/components/CampaignCard.tsx|web/app/Http/Controllers/CampaignController.php", related=("E06",))

flow("E12", OWNER, "Eliminar perfil: no disponible", "Mi Perfil de emprendedor", "La eliminación del perfil no está disponible en la versión web.", [
    step("Consultar Mi Perfil de emprendedor"),
    step("La pantalla no muestra un botón para eliminar el perfil"),
    step("No se puede iniciar esta operación desde la web actual"),
], "web/frontend/src/pages/EntrepreneurProfilePage.tsx|web/frontend/src/components/entrepreneur-profile/ProfileSidebar.tsx|web/app/Http/Controllers/ProfileController.php", "Puedes consultar o editar tus datos desde Mi Perfil siguiendo E01.", ("E01",))

flow("A01", ADMIN, "Consultar el panel administrativo", "Login → panel administrativo · /admin", "Administrador o superadministrador autenticado.", [
    step("Abrir Estadísticas en la barra lateral"),
    step("Consultar indicadores de usuarios, campañas y tareas pendientes"),
    step("Elegir un acceso: usuarios, campañas, KYC, revisión o auditoría de gastos"),
    step("Continuar en el flujo administrativo correspondiente"),
], "web/frontend/src/pages/admin/AdminDashboardPage.tsx|web/frontend/src/components/admin/AdminLayout.tsx|web/app/Http/Controllers/AdminController.php", "El superadministrador también puede usar todas las funciones administrativas de esta sección.", ("A02", "A03", "A04", "A06", "A07", "A08"))

flow("A02", ADMIN, "Buscar y suspender usuarios", "Panel → Gestión de Usuarios · /admin/users", "Administrador o superadministrador autenticado.", [
    step("Abrir Gestión de Usuarios y buscar por correo electrónico"),
    step("Revisar correo, roles y estado del usuario"),
    step("Seleccionar la acción de suspensión"),
    decision("¿Confirmar la suspensión?", "Cancelar y volver a la lista"),
    decision("¿La cuenta se puede suspender?", "Bloquear la operación: no se permite la propia cuenta ni un superadministrador"),
    step("Desactivar la cuenta y comprobar la lista actualizada"),
], "web/frontend/src/pages/admin/AdminUsersPage.tsx|web/app/Http/Controllers/AdminController.php", "Aunque se usa una operación de borrado en la API, el resultado es desactivar al usuario. La pantalla revisada no incluye reactivación.", ("S03",))

flow("A03", ADMIN, "Revisar, aprobar o rechazar campañas", "Panel → Revisión de Campañas · /admin/campaigns/review", "La pantalla carga campañas pendientes de revisión.", [
    step("Buscar por título o emprendedor con Enter; recorrer las páginas de pendientes"),
    step("Abrir el detalle y examinar propuesta, propietario, documentos e historial"),
    step("Revisar documentos con A05 si es necesario", "connector", "A05"),
    decision("¿La campaña cumple los criterios de revisión?", "Escribir motivo, rechazar y notificar al emprendedor para corregir y reenviar", link="E04"),
    step("Pulsar Aprobar y completar la confirmación si se solicita"),
    decision("¿Se registró la aprobación?", "Leer el error y volver a cargar la campaña antes de reintentar", 2),
    step("La campaña queda Aprobada; el emprendedor debe lanzarla en E05"),
], "web/frontend/src/pages/admin/CampaignReviewPage.tsx|web/frontend/src/components/CampaignPreviewModal.tsx|web/app/Http/Controllers/AdminController.php", "El listado solicita solo pendientes; no muestra un filtro para incluir En revisión. El detalle conectado permite Aprobar o Rechazar, con motivo obligatorio para rechazar. Las acciones rápidas del listado usan confirmación o solicitud de motivo. Gestión de Campañas muestra botones de decisión en algunos detalles sin conectar sus acciones: decidir desde Revisión de Campañas.", ("A05", "E04", "E05"))

flow("A04", ADMIN, "Revisar la identidad KYC", "Panel → Verificaciones KYC · /admin/kyc", "Solicitud KYC pendiente de un emprendedor.", [
    step("Abrir Verificaciones KYC y seleccionar una solicitud"),
    step("Revisar perfil, documento de identidad y selfie o video"),
    decision("¿Los archivos se pueden revisar?", "Volver a cargar los enlaces; descargar el formato permitido si no se visualiza", 2),
    decision("¿La identidad es válida?", "Ingresar motivo y rechazar; el emprendedor recibe aviso y puede reenviar", link="E02"),
    step("Pulsar Aprobar KYC y aceptar la confirmación; cancelar conserva la solicitud"),
    step("El sistema guarda la revisión y notifica; comprobar que ya no figure como pendiente"),
], "web/frontend/src/pages/admin/AdminKycPage.tsx|web/frontend/src/components/admin/KYCReviewModal.tsx|web/frontend/src/components/admin/KycFileViewer.tsx|web/app/Http/Controllers/AdminController.php", "Una solicitud que ya fue revisada debe volver a cargarse; no se decide sobre una copia desactualizada.", ("E02", "E03"))

flow("A05", ADMIN, "Revisar documentos y autorizar su publicación", "Detalle administrativo de campaña → Documentación", "Administrador o superadministrador; documentos cargados por el emprendedor.", [
    step("Abrir la campaña desde Gestión o Revisión de Campañas"),
    step("Entrar en Documentación y abrir el archivo"),
    decision("¿El documento pendiente se aprueba?", "Indicar el motivo y rechazar; actualizar la lista de documentos"),
    step("Pulsar Aprobar y comprobar el estado"),
    step("En un documento aprobado, usar Publicar evidencia o Retirar publicación"),
    decision("¿El cambio se guardó?", "Leer el error, verificar que exista el archivo y recargar", 2),
    step("Consultar estado y visibilidad; solo lo autorizado aparece públicamente"),
], "web/frontend/src/components/CampaignPreviewModal.tsx|web/app/Http/Controllers/AdminController.php|web/app/Http/Controllers/CampaignReadController.php", "Usar Ver Documento para abrir el archivo. Los botones Aprobar y Rechazar aparecen solo en documentos pendientes; los aprobados tienen el control de publicación y los rechazados se consultan. Aprobar un documento no lo publica automáticamente. El archivo debe existir para publicarlo.", ("A03", "A06", "V06"))

flow("A06", ADMIN, "Consultar campañas y eliminarlas cuando se permite", "Panel → Gestión de Campañas · /admin/campaigns", "Administrador o superadministrador autenticado.", [
    step("Buscar por título, creador o correo; seleccionar un estado y usar Actualizar si hace falta"),
    step("Abrir Vista Previa para consultar detalles, progreso, historial y documentos"),
    decision("¿Se desea eliminar la campaña?", "Cerrar el detalle y continuar consultando"),
    step("Elegir Eliminar en el listado y confirmar; cancelar conserva la campaña"),
    decision("¿No tiene aportes ni movimientos con trazabilidad?", "Bloquear la eliminación y conservar el registro"),
    step("Eliminar y actualizar el listado"),
], "web/frontend/src/pages/admin/AdminCampaignsPage.tsx|web/frontend/src/components/CampaignPreviewModal.tsx|web/app/Http/Controllers/CampaignController.php", "La gestión web revisada ofrece consulta y eliminación. Los cambios administrativos de suspensión, cancelación y otros estados tienen API, pero no un control conectado en esta pantalla.", ("A03", "A05"))

flow("A07", ADMIN, "Auditar movimientos financieros", "Panel → Auditoría de Gastos · /admin/expenses", "Administrador o superadministrador autenticado.", [
    step("Buscar por concepto, factura, notas o campaña; filtrar tipo, estado y comprobante"),
    step("Pulsar Revisar en el movimiento; usar las páginas si hay más resultados"),
    step("Revisar importe, categoría, comprobante, versiones e historial"),
    decision("¿El movimiento permite revisión?", "Consultar solamente: los movimientos del sistema o bloqueados no son revisables"),
    step("Elegir Aprobar / Verificado, Marcar Observado o Rechazar"),
    step("Escribir notas; son obligatorias al observar o rechazar"),
    step("Pulsar Confirmar Dictamen"),
    decision("¿Se aceptó la revisión vigente?", "Leer el error; si cambió la versión, volver a cargar antes de revisar", 2),
    step("Actualizar lista, resumen e historial de auditoría"),
], "web/frontend/src/pages/admin/AdminExpensesAuditPage.tsx|web/frontend/src/components/admin/FinancialMovementHistory.tsx|web/app/Http/Controllers/AdminController.php|web/app/Services/FinancialMovementAudit.php", "La auditoría consulta movimientos existentes. No implica que la web ofrezca al emprendedor un formulario para registrarlos.", ("A08", "V06"))

flow("A08", ADMIN, "Comparar presupuesto y ejecución de una campaña", "Auditoría de Gastos → botón de auditoría de campaña", "Administrador o superadministrador; elegir una campaña del listado.", [
    step("Abrir Auditoría de Gastos y localizar la campaña"),
    step("En un movimiento, pulsar el icono de gráfico: Auditar Plan de Fondos de la Campaña"),
    step("Comparar importes planificados y egresos por categoría"),
    step("Revisar varianza, comprobantes faltantes, sobregiros y gastos en categorías no planificadas"),
    step("Cerrar la auditoría y revisar un movimiento concreto con A07 si corresponde"),
], "web/frontend/src/pages/admin/AdminExpensesAuditPage.tsx|web/app/Http/Controllers/AdminController.php", related=("A07",))

flow("S01", SUPER, "Consultar administradores y navegar la administración", "Login de superadministrador → /superadmin", "Cuenta con nivel superadministrador.", [
    step("Iniciar sesión y abrir Gestión de Admins"),
    step("Consultar la lista de administradores y sus niveles"),
    step("Elegir crear administrador S02 o retirar permisos S03"),
    step("Para gestionar el sistema, usar Estadísticas y los módulos A01–A08 en la barra lateral"),
], "web/frontend/src/pages/admin/SuperAdminDashboardPage.tsx|web/frontend/src/components/admin/AdminLayout.tsx|web/routes/api.php", "La creación inicial de un superadministrador se hace mediante comando local; no es un registro público web.", ("S02", "S03", "A01"))

flow("S02", SUPER, "Crear un administrador", "Gestión de Admins → formulario de creación · /superadmin", "Superadministrador autenticado.", [
    step("Abrir Gestión de Admins"),
    step("Ingresar correo y contraseña del nuevo administrador"),
    step("Pulsar Crear Administrador"),
    decision("¿Los datos y el correo son válidos?", "Leer el error, corregir los datos y volver a enviar", 2),
    step("Crear la cuenta administrativa y comprobar la lista actualizada"),
], "web/frontend/src/pages/admin/SuperAdminDashboardPage.tsx|web/app/Http/Controllers/AdminController.php", "El formulario crea administradores comunes; no ofrece ascender un usuario existente ni crear otro superadministrador.", ("S01", "S03"))

flow("S03", SUPER, "Retirar permisos de un administrador", "Gestión de Admins → acción de quitar permisos", "Superadministrador autenticado.", [
    step("Seleccionar al administrador en Gestión de Admins"),
    decision("¿Es otro administrador común?", "Bloquear la acción: no se retiran los propios permisos ni los de un superadministrador"),
    step("Pulsar Revocar"),
    decision("¿Confirmar la operación?", "Cancelar y conservar los permisos"),
    step("Retirar perfil y roles administrativos; conservar la cuenta"),
    step("Comprobar la lista de administradores actualizada"),
], "web/frontend/src/pages/admin/SuperAdminDashboardPage.tsx|web/app/Http/Controllers/AdminController.php", "Quitar permisos administrativos no equivale a suspender la cuenta de usuario.", ("S01", "A02"))


def escaped(text):
    return html.escape(str(text), quote=True)


def lines(text, width=38):
    return textwrap.wrap(text, width=width, break_long_words=False, break_on_hyphens=False) or [""]


def svg_for(f):
    # Cada paso ocupa su propia fila. Las alternativas salen a la derecha;
    # las vueltas rodean las cajas y entran por la derecha del paso de destino.
    nodes = f["nodes"]
    row = 150
    height = 40 + row * len(nodes)
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1040 {height}" role="img" aria-labelledby="title desc">',
           f'<title id="title">{escaped(f["id"] + " · " + f["title"])}</title>',
           '<desc id="desc">Flujo vertical. Seguir las flechas de arriba hacia abajo; cada decisión tiene una alternativa rotulada. Los pasos enlazados llevan a otro diagrama de la guía.</desc>',
           '<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#526578"/></marker></defs>',
           '<style>text{font-family:Arial,sans-serif;fill:#193449;font-size:18px} .label{font-size:16px;fill:#42596b} .edge{fill:none;stroke:#526578;stroke-width:1.8;marker-end:url(#arrow)} a:hover rect,a:hover polygon{stroke:#176941;stroke-width:3}</style>']

    def box(n, x, y, branch=False):
        wrapped = lines(n["text"], 28 if n["kind"] == "decision" else 37)
        h = max(70, len(wrapped) * 22 + 18)
        if n["kind"] == "decision":
            h = max(130, len(wrapped) * 26 + 30)
        w = 390
        fill = "#fff6df" if n["kind"] == "decision" else "#eef5f9"
        if n["kind"] == "terminal":
            fill = "#e4f1df"
        if n["kind"] == "connector":
            fill = "#e7f3ea"
        if branch:
            fill = "#fff8ef"
        if n.get("link"):
            out.append(f'<a href="#{n["link"]}" aria-label="Ir a {n["link"]}">')
        if n["kind"] == "decision":
            out.append(f'<polygon points="{x},{y-h/2} {x+w/2},{y} {x},{y+h/2} {x-w/2},{y}" fill="{fill}" stroke="#a38b49"/>')
        else:
            radius = 35 if n["kind"] == "terminal" else 8
            out.append(f'<rect x="{x-w/2}" y="{y-h/2}" width="{w}" height="{h}" rx="{radius}" fill="{fill}" stroke="#a9bdca"/>')
        out.append(f'<text x="{x}" y="{y-(len(wrapped)-1)*11+6}" text-anchor="middle">')
        for i, line in enumerate(wrapped):
            out.append(f'<tspan x="{x}" dy="{22 if i else 0}">{escaped(line)}</tspan>')
        out.append('</text>')
        if n.get("link"):
            out.append('</a>')
        return h

    heights = []
    for i, n in enumerate(nodes):
        heights.append(max(130, len(lines(n["text"], 28))*26+30) if n['kind']=='decision' else max(70,len(lines(n['text']))*22+18))
    for i, n in enumerate(nodes):
        y = 80 + i * row
        if i < len(nodes) - 1:
            y1, y2 = y + heights[i]/2, y + row - heights[i+1]/2
            out.append(f'<path class="edge" d="M 290 {y1} V {y2}"/>')
            if n['kind'] == 'decision':
                out.append(f'<text class="label" x="305" y="{(y1+y2)/2+5}">{escaped(n["main"])}</text>')
        if n.get("branch"):
            b = n["branch"]
            bh = max(70, len(lines(b["text"])) * 22 + 18)
            out.append(f'<path class="edge" d="M 485 {y} H 590"/>')
            out.append(f'<text class="label" x="535" y="{y-10}" text-anchor="middle">{escaped(b["label"])}</text>')
            if b.get('target') is not None:
                target = b['target']
                ty = 80 + target * row
                out.append(f'<path class="edge" d="M 980 {y} H 1010 V {ty} H 485"/>')
            box({"text": b["text"], "kind": "connector" if b.get("link") else "process" if b.get('target') is not None else "terminal", **({"link": b["link"]} if b.get("link") else {})},785,y,True)
    for i,n in enumerate(nodes):
        box(n,290,80+i*row)
    out.append('</svg>')
    return '\n'.join(out)


def mermaid_for(f):
    out = [f'%% {f["id"]} · {f["title"]}', f'%% Rol: {f["role"]}', f'%% Entrada: {f["entry"]}', 'flowchart TD']
    for i,n in enumerate(f['nodes']):
        text = n['text'].replace('"', '&quot;')
        if n['kind']=='decision':
            out.append(f'  N{i}{{"{text}"}}')
        elif n['kind']=='terminal':
            out.append(f'  N{i}(["{text}"])')
        else:
            out.append(f'  N{i}["{text}"]')
        if i<len(f['nodes'])-1:
            label = f'|"{n["main"]}"|' if n['kind']=='decision' else ''
            out.append(f'  N{i} -->{label} N{i+1}')
        if n.get('branch'):
            b=n['branch']
            branch_text=b['text'].replace(chr(34), '&quot;')
            out.append(f'  B{i}["{branch_text}"]' if b.get('target') is not None else f'  B{i}(["{branch_text}"])')
            out.append(f'  N{i} -->|"{b["label"]}"| B{i}')
            if b.get('target') is not None:
                out.append(f'  B{i} --> N{b["target"]}')
    return '\n'.join(out)+'\n'


LIMITS = [
    ("Planes de fondos, hitos y movimientos financieros", "Hay API y funciones cliente para crear o editar estos registros, pero no se encontraron formularios React conectados. La guía cubre consulta pública y auditoría administrativa; no inventa un recorrido de carga para el emprendedor.", "web/frontend/src/api/campaign.api.ts|web/routes/api.php"),
    ("Asistentes IA", "El asistente de Inicio no está disponible actualmente, según confirmación del responsable del sistema. El componente de asistencia de campañas tampoco está montado en una pantalla. V07 es un aviso de indisponibilidad.", "web/frontend/src/components/AICampaignAssistant.tsx|web/frontend/src/pages/LandingPage.tsx"),
    ("Reportes generales PDF/CSV", "El servidor genera reportes de campañas, pero no se encontró un botón de descarga conectado en las pantallas web. Los comprobantes individuales PDF sí están incluidos en D05.", "web/app/Http/Controllers/InvestmentController.php|web/frontend/src/api/campaign.api.ts"),
    ("Finalizar una campaña financiada", "El servidor permite finalizar campañas financiadas, pero la tarjeta web solo ofrece Finalizar en estado Publicada. E10 documenta la regla del servidor y esta limitación de acceso.", "web/frontend/src/components/CampaignCard.tsx|web/app/Services/InvestmentEngine.php"),
    ("Envío a revisión desde el formulario", "En Mis Campañas no se pasa onSubmitForReview y el formulario oculta Enviar a Revisión: usar Guardar Borrador y después la tarjeta o vista previa. Desde Mi Perfil → Campañas sí se conecta el envío directo del formulario.", "web/frontend/src/pages/MyCampaignsPage.tsx|web/frontend/src/pages/EntrepreneurProfilePage.tsx|web/frontend/src/components/CampaignForm.tsx"),
    ("Primer nivel de recompensa", "La pestaña Recompensas de la vista previa se muestra solo si ya existen niveles. Agregar los primeros desde el formulario de campaña; después usar E08.", "web/frontend/src/components/CampaignPreviewModal.tsx|web/frontend/src/components/CampaignForm.tsx"),
    ("Edición de archivos de respaldo", "El formulario permite adjuntar respaldo y la vista previa permite consultarlo. No se encontró un control web conectado para borrar documentos, aunque existe un endpoint.", "web/frontend/src/components/CampaignForm.tsx|web/frontend/src/components/CampaignPreviewModal.tsx|web/routes/api.php"),
    ("Eliminar perfiles de donador y emprendedor", "Ambas páginas tienen manejadores y API, pero sus componentes laterales no muestran un botón conectado para eliminar el perfil. E12 conserva su identificador como constancia de que el recorrido anterior no está disponible.", "web/frontend/src/pages/InvestorProfilePage.tsx|web/frontend/src/components/investor-profile/ProfileSidebar.tsx|web/frontend/src/pages/EntrepreneurProfilePage.tsx|web/frontend/src/components/entrepreneur-profile/ProfileSidebar.tsx"),
    ("Orden, filtros y paginación no expuestos", "Explorar ofrece búsqueda, Sector y paginación, sin selector de orden. Mis Campañas ofrece búsqueda por título y pestañas de estado, sin selector de orden ni paginación visible. Revisión de Campañas lista pendientes y permite buscar, sin filtro de estado visible. Auditoría de Gastos filtra tipo, estado y comprobante, sin selectores de origen o fechas.", "web/frontend/src/pages/ExploreCampaignsPage.tsx|web/frontend/src/pages/MyCampaignsPage.tsx|web/frontend/src/pages/admin/CampaignReviewPage.tsx|web/frontend/src/pages/admin/AdminExpensesAuditPage.tsx"),
    ("Decisiones en Gestión de Campañas", "La vista previa puede renderizar Aprobar y Rechazar sin recibir onApprove y onReject en Gestión de Campañas. Para decidir sobre una solicitud pendiente, usar Revisión de Campañas (A03), que sí conecta esas acciones.", "web/frontend/src/pages/admin/AdminCampaignsPage.tsx|web/frontend/src/pages/admin/CampaignReviewPage.tsx|web/frontend/src/components/CampaignPreviewModal.tsx"),
    ("Estados administrativos y reactivación", "La API admite transiciones adicionales de campañas; no se encontró un selector conectado para ellas. Tampoco hay un control de reactivación de usuarios en la pantalla revisada.", "web/app/Http/Controllers/AdminController.php|web/frontend/src/pages/admin/AdminCampaignsPage.tsx|web/frontend/src/pages/admin/AdminUsersPage.tsx"),
    ("Hitos y planes mostrados como respaldo visual", "Algunos componentes contienen datos de ejemplo cuando no reciben información real. Consultarlos no prueba que el emprendedor haya registrado esos compromisos.", "web/frontend/src/components/campaign-detail/transparency/ProjectMilestones.tsx|web/frontend/src/components/campaign-detail/transparency/FundAllocationPlan.tsx"),
]


PUBLIC_NOTES = {
    'V01': 'En Sector, elige una categoría o Todos los sectores. Puedes abrir una sugerencia de búsqueda o pulsar Ver todos los resultados. Las páginas aparecen cuando hay más resultados.',
    'V06': 'Consulta las evidencias y novedades del proyecto para conocer sus avances. Los planes e hitos mostrados como ejemplos no representan compromisos confirmados del emprendedor.',
    'C06': 'El cambio requiere una contraseña actual y una nueva contraseña que cumpla los requisitos indicados. El acceso con Google todavía no está disponible.',
    'D01': 'Guarda los datos de cada sección antes de continuar con otra.',
    'D05': 'También puedes descargar el comprobante justo después de donar o desde el historial de aportes completados.',
    'D08': 'Los reembolsos se registran al finalizar una campaña sin alcanzar la meta. Consulta Mis Aportes y el capital disponible en Mi Panel. No existe una solicitud manual de reembolso en el panel.',
    'E01': 'Para crear campañas necesitas una biografía de al menos 30 caracteres, nombre de empresa o proyecto, sitio web y LinkedIn válidos, país e identidad verificada.',
    'E03': 'Completa título de 5–50 caracteres, eslogan de 10–50, descripción de 50–800, meta de al menos Bs. 100 y una categoría. Añade al menos un documento de respaldo. La fecha de cierre puede omitirse al guardar un borrador, pero debe ser futura para publicar. El video opcional debe ser de YouTube o TikTok. Comprueba que la portada y los documentos se hayan cargado.',
    'E05': 'Una campaña aprobada debe publicarse para recibir aportes. Si el lanzamiento está bloqueado, consulta el mensaje y comprueba tu verificación de identidad y la fecha de cierre.',
    'E06': 'Edita únicamente campañas en borrador o rechazadas. Añade un documento de respaldo y pulsa Guardar Borrador. Si prefieres salir, usa Descartar y confirma la decisión.',
    'E07': 'Las proyecciones de recaudación son estimaciones. Puedes consultar la información de los donadores; el envío de mensajes desde esas fichas todavía no está disponible.',
    'E08': 'Los niveles se consultan en Recompensas y se editan desde el formulario de campaña cuando el estado lo permite. Las entregas avanzan de pendiente a preparación, enviada y entregada. Solo puedes elegir los estados habilitados; una recompensa entregada, cancelada o de un aporte reembolsado no se modifica.',
    'E10': 'Si la campaña finaliza sin alcanzar la meta, queda Fallida y los aportes vuelven al saldo simulado de los donadores. Finalizar Campaña aparece únicamente en campañas publicadas. Llegar a la fecha de cierre no ejecuta por sí solo esta finalización.',
    'A02': 'Suspender desactiva el acceso del usuario. La pantalla no ofrece una opción para reactivar la cuenta.',
    'A03': 'Realiza la aprobación o el rechazo desde Revisión de Campañas. Para rechazar, escribe un motivo. También puedes usar las acciones rápidas del listado.',
    'A06': 'Para aprobar o rechazar solicitudes pendientes, entra en Revisión de Campañas y sigue A03.',
    'A07': 'Esta pantalla permite consultar y revisar movimientos existentes.',
    'S01': 'El superadministrador también puede utilizar los módulos del administrador.',
}


CAMPAIGN_MENU_LABELS = {
    'web/frontend/src/pages/CampaignDetailPage.tsx': (
        '<span>Historia y Proyecto</span>', '<span>Transparencia y Fondos</span>',
        '<span>Hitos y Avances</span>', '<span>Comentarios</span>',
    ),
    'web/frontend/src/components/campaign-detail/CampaignTransparencySection.tsx': (
        '<span>Plan de Fondos</span>', '<span>Auditoría y Movimientos</span>',
        '<span>Hitos del Proyecto</span>', '<span>Evidencias (', '<span>Bitácora (',
    ),
}


def main():
    for source, labels in CAMPAIGN_MENU_LABELS.items():
        markup=(ROOT.parent.parent/source).read_text(encoding='utf-8')
        for label in labels:
            assert label in markup, f'Comprobar el nombre del menú antes de generar la guía: {label} ({source})'
    (ROOT/'svg').mkdir(parents=True,exist_ok=True)
    (ROOT/'mermaid').mkdir(exist_ok=True)
    ids={f['id'] for f in FLOWS}
    assert len(ids)==len(FLOWS)
    for f in FLOWS:
        for rel in f['related']:
            assert rel in ids,rel
        for n in f['nodes']:
            if n.get('link'): assert n['link'] in ids
            if n.get('branch'):
                b=n['branch']
                if b.get('link'): assert b['link'] in ids
                if b.get('target') is not None: assert 0<=b['target']<len(f['nodes'])
        for s in f['sources']:
            assert (ROOT.parent.parent/s).is_file(),s
        svg=svg_for(f)
        ET.fromstring(svg)
        # Los SVG individuales regresan a la guía; el SVG insertado usa anclas locales.
        standalone=svg.replace('href="#','href="../index.html#')
        (ROOT/'svg'/f'{f["id"]}.svg').write_text(standalone,encoding='utf-8',newline='\n')
        (ROOT/'mermaid'/f'{f["id"]}.mmd').write_text(mermaid_for(f),encoding='utf-8',newline='\n')
    (ROOT/'flujos.json').write_text(json.dumps(FLOWS,ensure_ascii=False,indent=2),encoding='utf-8',newline='\n')
    roles=[PUBLIC,ACCESS,DONOR,OWNER,ADMIN,SUPER]
    nav=[]
    sections=[]
    for role in roles:
        group=[f for f in FLOWS if f['role']==role]
        nav.append(f'<h3>{escaped(role)} <small>{len(group)}</small></h3>')
        for f in group:
            nav.append(f'<a href="#{f["id"]}"><b>{f["id"]}</b> {escaped(f["title"])}</a>')
            note=PUBLIC_NOTES.get(f['id'], f['note'])
            links=''.join(f'<a href="#{r}">{r} · {escaped(next(x["title"] for x in FLOWS if x["id"]==r))}</a>' for r in f['related'])
            # Prefijos para evitar IDs SVG repetidos en un mismo documento.
            svg=svg_for(f).replace('id="title"',f'id="title-{f["id"]}"').replace('id="desc"',f'id="desc-{f["id"]}"').replace('aria-labelledby="title desc"',f'aria-labelledby="title-{f["id"]} desc-{f["id"]}"').replace('id="arrow"',f'id="arrow-{f["id"]}"').replace('url(#arrow)',f'url(#arrow-{f["id"]})')
            sections.append(f'''<article id="{f['id']}" data-role="{escaped(role)}">
<header><p class="eyebrow">{escaped(role)} / {f['id']}</p><h2>{escaped(f['title'])}</h2></header>
{('<p class="note"><strong>No disponible por el momento.</strong> Consulta las alternativas indicadas a continuación.</p>') if f['id'] in ('V07','C08','E12') else ''}
<p><strong>Dónde entrar:</strong> {escaped(f['entry'])}</p><p><strong>Antes de empezar:</strong> {escaped(f['pre'])}</p>
<div class="diagram">{svg}</div>
{('<p class="note"><strong>Ten en cuenta:</strong> '+escaped(note)+'</p>') if note else ''}
<nav class="related" aria-label="Flujos relacionados">{links}</nav>
<footer><a href="svg/{f['id']}.svg" download>Descargar SVG</a> · {('<a href="png/'+f['id']+'.png" download>Descargar PNG</a> · ') if (ROOT/'png'/f'{f["id"]}.png').exists() else ''}<a href="mermaid/{f['id']}.mmd" download>Fuente Mermaid</a> · <a href="#inicio">Volver al índice</a></footer>
</article>''')
    limits=''.join(f'<li><strong>{escaped(title)}.</strong> {escaped(desc)}<details><summary>Fuentes</summary><ul>'+''.join(f'<li><a href="../../{s}">{s}</a></li>' for s in paths.split('|'))+'</ul></details></li>' for title,desc,paths in LIMITS)
    route_map=[('/', 'V01, V07'),('/explore','V01, V04, V05'),('/donatok','V03'),('/campaign/:id','V02, V06, D03, C03, C09'),('/login','C02, C08'),('/register','C01, C08'),('/auth/callback','C08'),('/chat y /chat/:conversationId','C03'),('/dashboard','D02, D04–D08'),('/profile','D01, D04'),('/entrepreneur-profile','E01, E02, E03, E12'),('/entrepreneur-campaigns','E03–E11'),('/account-settings','C06, C07'),('/notifications','C04, C05'),('/admin','A01'),('/admin/users','A02'),('/admin/campaigns','A05, A06'),('/admin/campaigns/review','A03, A05'),('/admin/kyc','A04'),('/admin/expenses','A07, A08'),('/superadmin','S01–S03')]
    rows=''.join(f'<tr><td><code>{r}</code></td><td>{v}</td></tr>' for r,v in route_map)
    document='''<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>UniFundme · Diagramas de flujo web</title>
<style>
:root{color-scheme:light;--ink:#193449;--green:#316b24;--paper:#fff;--line:#d7e1e6}*{box-sizing:border-box}body{margin:0;background:#f4f7f8;color:var(--ink);font:16px/1.55 system-ui,Arial,sans-serif}a{color:#236238;text-underline-offset:3px}a:focus-visible,button:focus-visible,input:focus-visible{outline:3px solid #cf930e;outline-offset:3px}.layout{display:grid;grid-template-columns:300px minmax(0,1fr)}aside{padding:26px 20px;background:#fff;border-right:1px solid var(--line);position:sticky;top:0;height:100vh;overflow-y:auto}aside h2{margin:0 0 12px;font-size:21px}aside h3{font-size:14px;margin:24px 0 8px;color:#526578}aside a{display:block;font-size:13px;text-decoration:none;padding:7px 0;border-bottom:1px solid #eef2f4}aside a:hover{background:#eef5e8}small{font-weight:400}main{padding:40px clamp(20px,4vw,70px);max-width:1400px;min-width:0}h1{font-size:42px;line-height:1.15;margin:8px 0 20px;letter-spacing:-1px}h2{line-height:1.25;margin:8px 0 16px}p{margin:10px 0}.eyebrow{font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#54704a}.intro{max-width:860px;margin-bottom:35px}.intro ul{padding-left:22px}.roles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:24px 0}.roles a{padding:16px;background:white;border:1px solid var(--line);border-radius:10px;text-decoration:none}.roles span{display:block;color:#526578;font-size:14px}article{background:#fff;border:1px solid var(--line);border-radius:14px;padding:28px;margin:25px 0;scroll-margin-top:16px}article>p{font-size:15px}.diagram{margin:20px auto;max-width:920px}.diagram svg{display:block;width:100%;height:auto}.note{padding:14px 18px;background:#fff8e6;border-left:3px solid #b9983d}.related{display:flex;flex-wrap:wrap;gap:8px 18px;margin:20px 0;font-size:14px}footer{font-size:13px;border-top:1px solid var(--line);padding-top:14px}details{font-size:12px;margin-top:14px;overflow-wrap:anywhere}summary{cursor:pointer}details li{margin:4px 0}button{border:1px solid #316b24;background:#316b24;color:#fff;padding:10px 16px;border-radius:6px;font:inherit;cursor:pointer}input{width:100%;padding:9px;border:1px solid #b7c7cf;border-radius:6px;font:inherit}#estado{font-size:12px;color:#526578}#limites,#cobertura{background:#fff;padding:28px;margin:25px 0;border:1px solid var(--line);border-radius:14px}#limites>ul>li{margin-bottom:18px}table{border-collapse:collapse;width:100%;font-size:14px}th,td{text-align:left;padding:9px;border-bottom:1px solid var(--line)}code{overflow-wrap:anywhere}#leyenda span{display:inline-block;margin:3px 12px 3px 0}.skip{position:absolute;left:-9999px}.skip:focus{left:10px;top:10px;background:white;padding:10px}.hidden{display:none!important}
@media(max-width:900px){.layout{grid-template-columns:1fr}aside{position:static;height:auto;max-height:400px;border-bottom:1px solid var(--line)}main{padding:24px 16px}h1{font-size:32px}.roles{grid-template-columns:1fr}article{padding:16px}.diagram{overflow-x:auto}.diagram svg{min-width:700px}}
@media print{@page{size:A4 portrait;margin:12mm}body{background:white;font-size:10pt}.layout{display:block}aside,.toolbar,.skip{display:none}main{padding:0;max-width:none}.intro{break-after:page}h1{font-size:27pt}article{border:0;padding:0;margin:0;break-before:page;break-inside:avoid;border-radius:0}article h2{font-size:17pt;margin:5px 0}article>p{font-size:9pt;margin:4px 0}.diagram{margin:6px auto}.diagram svg{height:190mm;width:100%;min-width:0}article details,article footer{display:none}.note{font-size:8pt!important;padding:5px 9px}.related{font-size:8pt;margin:8px 0}#limites,#cobertura{break-before:page;border:0;padding:0}#limites li{break-inside:avoid}.roles a{padding:7px}.hidden{display:none!important}a{color:inherit;text-decoration:none}}
</style></head><body><a class="skip" href="#inicio">Saltar al contenido</a><div class="layout"><aside><h2>UniFundme · Web</h2><label for="buscar">Buscar funcionalidad</label><input id="buscar" type="search" placeholder="Ej.: donar, KYC, campaña"><p id="estado" role="status"></p><nav aria-label="Índice por rol">__NAV__<h3>Ayuda</h3><a href="#disponibilidad">Funciones no disponibles</a></nav></aside><main>
<section id="inicio" class="intro"><p class="eyebrow">Guía de navegación / versión web</p><h1>Una funcionalidad.<br>Un recorrido claro.</h1><p>Conoce cómo usar UniFundme con diagramas organizados por rol y funcionalidad. Elige lo que quieres hacer y sigue las flechas de arriba hacia abajo. Cada decisión indica cómo continuar.</p><p><strong>__COUNT__ diagramas y avisos de disponibilidad</strong> para ayudarte a navegar la versión web.</p>
<div class="roles"><a href="#V01"><strong>Visitante</strong><span>Explorar, consultar y compartir campañas.</span></a><a href="#C01"><strong>Acceso y funciones compartidas</strong><span>Cuenta, sesión, mensajes, comentarios y notificaciones.</span></a><a href="#D01"><strong>Donador</strong><span>Perfil, capital, aportes, comprobantes y seguimiento.</span></a><a href="#E01"><strong>Emprendedor</strong><span>Perfil, identidad, creación y gestión de campañas.</span></a><a href="#A01"><strong>Administrador</strong><span>Usuarios, aprobación, identidad, documentos y auditoría.</span></a><a href="#S01"><strong>Superadministrador</strong><span>Funciones administrativas y gestión de administradores.</span></a></div>
<div id="leyenda"><strong>Cómo leer los diagramas</strong><p><span>▢ Acción o pantalla</span><span>◇ Decisión</span><span>▭ redondeado: inicio, fin o salida alternativa</span><span>↗ Paso enlazado: abrir otro flujo</span></p></div>
<ul><li>Las cajas verdes enlazadas y los enlaces al pie permiten pasar a otra funcionalidad. Después de completar un requisito, vuelve al flujo de origen.</li><li>Las ramas sin flecha de retorno terminan ese recorrido. Una alternativa puede cerrar la acción o indicar otra pantalla a la que acudir.</li><li>Para comenzar desde cero: C01 → D01 → D02 → D03 (donador), o C01 → E01 → E02 → E03 → E04 → E05 (emprendedor).</li><li>El superadministrador también puede utilizar las funciones del administrador. Para comentar necesitas una cuenta de donador o emprendedor.</li><li>Si una carga falla, reintenta desde el control disponible o vuelve a cargar la página. Si la sesión venció, inicia sesión de nuevo.</li><li>Los aportes utilizan saldo simulado. El acceso con Google todavía no está disponible; utiliza tu correo y contraseña para iniciar sesión.</li></ul>
<p class="toolbar"><button id="imprimir" type="button">Imprimir / guardar en PDF</button> <small>Se imprimen los diagramas que coinciden con la búsqueda; cada uno comienza en una página.</small></p></section>
__SECTIONS__
<section id="disponibilidad"><h2>Funciones no disponibles</h2><p><a href="#V07">Asistente IA</a>: todavía no está disponible. Consulta el índice de esta guía para encontrar la funcionalidad que necesitas.</p><p><a href="#C08">Acceso con Google</a>: todavía no está disponible. Puedes <a href="#C02">iniciar sesión con correo y contraseña</a> o <a href="#C01">crear una cuenta con tu correo</a>.</p><p><a href="#E12">Eliminar el perfil de emprendedor</a>: no está disponible en la versión web. Puedes <a href="#E01">consultar o editar los datos de tu perfil</a>.</p></section>
</main></div><script>
const input=document.getElementById('buscar');const articles=[...document.querySelectorAll('article')];
function filter(){const q=input.value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();let count=0;for(const a of articles){const match=a.textContent.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(q);a.classList.toggle('hidden',!match);if(match)count++;}document.getElementById('estado').textContent=count+' diagramas visibles';}
input.addEventListener('input',filter);document.getElementById('imprimir').addEventListener('click',()=>window.print());
function reveal(){const id=decodeURIComponent(location.hash.slice(1));const target=document.getElementById(id);if(target&&target.matches('article')&&target.classList.contains('hidden')){input.value='';filter();target.scrollIntoView();}}
window.addEventListener('hashchange',reveal);filter();reveal();
</script></body></html>'''
    document=document.replace('__NAV__','\n'.join(nav)).replace('__COUNT__',str(len(FLOWS))).replace('__SECTIONS__','\n'.join(sections))
    document=document.replace('#limites,#cobertura', '#disponibilidad')
    (ROOT/'index.html').write_text(document,encoding='utf-8',newline='\n')
    print(f'Generados {len(FLOWS)} diagramas SVG + Mermaid y guía HTML en {ROOT}')


if __name__=='__main__':
    main()
