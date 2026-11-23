"""Secuencias actor/sistema y alternativas de los casos de uso web."""
CASOS = {}


def caso(codigo, disparador, precondicion, pasos, alternativas, resultado):
    CASOS[codigo] = dict(disparador=disparador, precondicion=precondicion,
                         pasos=[dict(numero=i, actor=a, sistema=s) for i, (a, s) in enumerate(pasos, 1)],
                         alternativas=[dict(id=f'A{i}', paso=p, condicion=c, respuesta=r, continuidad=v)
                                       for i, (p, c, r, v) in enumerate(alternativas, 1)],
                         postcondicion=resultado)


caso('V01', 'La persona desea conocer UniFundme.', 'No requiere sesión.', [
    ('Abre Inicio.', 'Presenta la propuesta de la plataforma y los accesos públicos.'),
    ('Selecciona Explorar.', 'Abre el catálogo de campañas públicas.'),
], [(2, 'Prefiere acceder a su cuenta.', 'Selecciona Iniciar Sesión y se abre el formulario de acceso.', 'Continuar en CU-C02.')],
     'El catálogo queda abierto para consultar proyectos; no se crea una cuenta ni un aporte.')

caso('V02', 'La persona desea localizar un proyecto.', 'Explorar está abierto.', [
    ('Escribe un término y lo envía con Enter o Ver todos los resultados.', 'Solicita y presenta las campañas coincidentes.'),
    ('Selecciona una categoría en Sector.', 'Limita el catálogo a la categoría seleccionada.'),
    ('Recorre las páginas de resultados disponibles.', 'Muestra la página elegida dentro de los límites de la lista.'),
    ('Selecciona una campaña.', 'Abre la ficha de ese proyecto.'),
], [(1, 'Selecciona una sugerencia de búsqueda.', 'Abre directamente la campaña sugerida.', 'Continuar en CU-V03.'),
    (2, 'No hay coincidencias.', 'Presenta Sin Resultados; Limpiar filtros elimina búsqueda y sector. Todos los sectores retira solo el sector.', 'Retomar el paso 1 o 2.')],
     'La persona llega a la campaña elegida o identifica que no hay resultados. No hay selector de orden en Explorar.')

caso('V03', 'La persona abre un enlace de campaña.', 'La campaña tiene acceso público.', [
    ('Abre la campaña desde Explorar o su enlace.', 'Carga la ficha con título, resumen, creador, Recaudado, Meta, Donantes y Días Restantes si corresponde.'),
    ('Localiza la barra principal de la ficha.', 'Ofrece Historia y Proyecto, Transparencia y Fondos, Hitos y Avances y Comentarios.'),
    ('Selecciona la pestaña que desea consultar.', 'Muestra el contenido de esa sección y mantiene la navegación de la campaña.'),
], [(1, 'La campaña no está disponible o falla la carga.', 'Presenta el error y permite volver; Reintentar solicita nuevamente la ficha si hubo un fallo de carga.', 'Reintentar el paso 1 o terminar.'),
    (2, 'Comentarios queda fuera del ancho visible.', 'La barra permite desplazar horizontalmente hacia la derecha hasta la cuarta pestaña.', 'Retomar el paso 3.')],
     'La sección elegida queda visible; consultar la ficha no registra una donación.')

caso('V04', 'La persona desea conocer la propuesta y a su responsable.', 'Ficha pública abierta.', [
    ('Selecciona Historia y Proyecto.', 'Presenta Historia del Proyecto y Sobre el Emprendedor.'),
    ('Lee la descripción y los datos disponibles del creador.', 'Muestra además Niveles de Recompensa cuando existen niveles.'),
    ('Selecciona Ver Transparencia.', 'Cambia a Transparencia y Fondos.'),
], [(3, 'Prefiere contactar al creador.', 'Usa Contactar Emprendedor en Sobre el Emprendedor; el contacto requiere sesión y no se ofrece para sí mismo.', 'Continuar en CU-C05.'),
    (2, 'La campaña no tiene recompensas.', 'La lectura del proyecto continúa sin niveles de recompensa.', 'Retomar el paso 3 o terminar.')],
     'Se consulta la propuesta y se puede continuar a su transparencia o al contacto disponible.')

caso('V05', 'La persona desea descubrir proyectos por video.', 'No requiere sesión.', [
    ('Abre DonaTok desde la barra superior.', 'Carga campañas con video y presenta video y resumen.'),
    ('Se desplaza verticalmente para cambiar de proyecto.', 'Presenta la campaña correspondiente al video seleccionado.'),
    ('Pulsa Ver Campaña y Donar.', 'Abre la ficha pública de esa campaña.'),
], [(1, 'No hay campañas con video o falla la carga.', 'Presenta el estado vacío o de error correspondiente; la persona puede volver a Explorar.', 'Terminar o continuar en CU-V02.')],
     'Se abre la campaña elegida; Ver Campaña y Donar no confirma un aporte.')

caso('V06', 'La persona desea leer historias recientes.', 'Explorar abierto; las historias corresponden a novedades públicas de las últimas 24 horas.', [
    ('Selecciona un avatar de la barra de historias.', 'Abre las novedades recientes de esa campaña en el visor.'),
    ('Utiliza la navegación anterior o siguiente disponible.', 'Presenta la historia correspondiente.'),
    ('Cierra el visor o pulsa Escape.', 'Vuelve al catálogo.'),
], [(1, 'No hay historias recientes.', 'La persona sigue consultando el catálogo; no se generan historias ficticias.', 'Terminar o continuar en CU-V02.')],
     'Las historias quedan consultadas. Para abrir la campaña se cierra el visor y se busca el proyecto en Explorar.')

caso('V07', 'La persona desea difundir una campaña.', 'Campaña pública disponible.', [
    ('Pulsa Compartir Campaña en la ficha o el icono de compartir en Explorar.', 'Abre el diálogo con enlace y opciones WhatsApp, Facebook, X y LinkedIn.'),
    ('Selecciona Copiar enlace.', 'Copia la URL de la campaña y confirma la copia.'),
    ('Cierra el diálogo.', 'Devuelve a la campaña o al catálogo.'),
], [(2, 'Prefiere una red social.', 'Abre el enlace de compartir del servicio elegido con la URL de la campaña; la publicación se completa allí.', 'Volver a la web y retomar el paso 3.'),
    (2, 'Decide salir sin compartir.', 'Cierra el diálogo sin modificar la campaña ni sus aportes.', 'Terminar.')],
     'La URL queda copiada o se abre el servicio externo; no se afirma que UniFundme haya publicado en la red social.')

caso('V08', 'La persona desea consultar la planificación mostrada.', 'Ficha pública abierta. Esta consulta es parcial: la pantalla puede usar datos de ejemplo.', [
    ('Selecciona Transparencia y Fondos.', 'Presenta Plan de Fondos, Auditoría y Movimientos, Hitos del Proyecto, Evidencias y Bitácora.'),
    ('Selecciona Plan de Fondos.', 'Muestra las categorías y la distribución que presenta la interfaz.'),
    ('Selecciona Hitos del Proyecto.', 'Muestra las etapas y sus estados visibles.'),
], [(1, 'Un submenú queda oculto por el ancho de la barra.', 'La persona desplaza horizontalmente la barra de submenús.', 'Retomar el paso 2 o 3.'),
    (3, 'Prefiere consultar hitos y novedades juntos.', 'Selecciona Hitos y Avances en la barra principal y consulta ambas secciones.', 'Terminar.')],
     'Se consulta la planificación visible. Los valores de respaldo no acreditan compromisos ni registros reales del proyecto.')

caso('V09', 'La persona desea consultar la recaudación pública.', 'Ficha pública abierta.', [
    ('Selecciona Transparencia y Fondos → Auditoría y Movimientos.', 'Carga los indicadores y gráficos de recaudación disponibles.'),
    ('Selecciona Todos, Directos o Recompensas.', 'Filtra la tabla de aportes recientes por el tipo elegido.'),
    ('Lee los indicadores y aportes visibles.', 'Mantiene la consulta limitada a la campaña seleccionada.'),
], [(2, 'No existen aportes del tipo elegido.', 'Presenta la ausencia de transacciones para ese filtro.', 'Cambiar el filtro en el paso 2 o terminar.'),
    (1, 'Falla la carga de la sección.', 'Muestra el error y Reintentar; el error no equivale a recaudación cero.', 'Reintentar el paso 1.')],
     'Se consulta recaudación y aportes recientes; no se obtiene un extracto completo de egresos.')

caso('V10', 'La persona desea consultar respaldo público.', 'Ficha pública abierta; solo son accesibles evidencias autorizadas.', [
    ('Selecciona Transparencia y Fondos → Evidencias.', 'Lista las evidencias públicas con su nombre y justificación disponible.'),
    ('Pulsa Abrir documento en la evidencia elegida.', 'Comprueba su acceso público y abre el archivo en otra pestaña.'),
    ('Regresa a la pestaña de la campaña.', 'Conserva la ficha para seguir consultándola.'),
], [(1, 'No existen evidencias públicas.', 'Muestra No hay evidencias públicas disponibles.', 'Terminar.'),
    (1, 'Falla la carga.', 'Presenta el error y Reintentar.', 'Reintentar el paso 1.'),
    (2, 'El documento dejó de estar publicado.', 'No permite obtenerlo por su acceso público.', 'Volver al paso 1 o terminar.')],
     'Se consulta únicamente respaldo publicado; los archivos privados y KYC no se vuelven públicos.')

caso('V11', 'La persona desea leer avances publicados.', 'Ficha pública abierta.', [
    ('Selecciona Hitos y Avances o Transparencia y Fondos → Bitácora.', 'Solicita las novedades de esa campaña.'),
    ('Lee las publicaciones y sus adjuntos disponibles.', 'Presenta el contenido público asociado al proyecto.'),
], [(1, 'La campaña no tiene novedades.', 'Presenta el estado sin novedades.', 'Terminar.'),
    (1, 'Falla la consulta.', 'Presenta el error y permite Reintentar para la misma campaña.', 'Reintentar el paso 1.')],
     'Las novedades reales quedan consultadas; no se generan avances para completar la vista.')

caso('V12', 'La persona desea ver el video de presentación.', 'Campaña pública con enlace de video.', [
    ('Pulsa Ver Pitch sobre la portada.', 'Despliega el reproductor asociado a esa campaña.'),
    ('Consulta la presentación.', 'Ofrece el contenido del video mediante el reproductor disponible.'),
    ('Pulsa Ocultar Pitch.', 'Oculta la sección del reproductor.'),
], [(1, 'La campaña no tiene enlace de video.', 'No ofrece Ver Pitch.', 'Terminar.')],
     'La presentación se consulta y puede ocultarse sin modificar el proyecto.')

caso('V13', 'La persona desea descubrir proyectos relacionados.', 'Ficha pública abierta.', [
    ('Consulta También te puede interesar.', 'Puede mostrar hasta tres campañas de la misma categoría, excluyendo la actual.'),
    ('Selecciona una sugerencia.', 'Abre la ficha de la campaña elegida.'),
], [(1, 'No hay sugerencias disponibles.', 'No muestra esa sección; la persona puede seguir buscando en Explorar.', 'Continuar en CU-V02 o terminar.')],
     'Se abre otro proyecto relacionado cuando existen sugerencias.')

caso('C01', 'La persona desea registrarse.', 'Visitante sin sesión; registro público solo para Donador o Emprendedor.', [
    ('Abre Iniciar Sesión → Crea tu cuenta.', 'Presenta el formulario de registro.'),
    ('Elige Donador o Emprendedor e introduce correo y contraseña válidos.', 'Valida los datos y la disponibilidad del correo al enviar el formulario.'),
    ('Envía el registro.', 'Crea la cuenta, inicia sesión y abre Mi Panel para Donador o Mi Perfil para Emprendedor.'),
], [(2, 'Los datos son inválidos o el correo ya está registrado.', 'Rechaza el registro e informa el problema, sin crear otra cuenta.', 'Corregir y retomar el paso 2.')],
     'Existe una cuenta del rol público elegido con sesión iniciada. No se crean administradores desde este formulario.')

caso('C02', 'La persona desea acceder a su cuenta.', 'Cuenta existente y activa; acceso por correo y contraseña.', [
    ('Abre Iniciar Sesión e introduce correo y contraseña.', 'Presenta los campos y permite seleccionar Recordarme para conservar el correo.'),
    ('Envía el formulario.', 'Valida credenciales, estado de la cuenta, roles y nivel administrativo.'),
    ('Continúa tras una autenticación correcta.', 'Abre /superadmin o /admin para cuentas administrativas; para los otros roles vuelve a la ruta solicitada, o a Mi Panel o Mi Perfil si no había una ruta previa.'),
], [(2, 'Las credenciales son incorrectas o la cuenta está suspendida.', 'No concede una sesión válida y presenta el error.', 'Corregir datos en el paso 1 o terminar.')],
     'La sesión queda abierta con los permisos reales de la cuenta. Recordarme conserva el correo, sin promesa de sesión indefinida.')

caso('C03', 'La persona desea cerrar su sesión.', 'Sesión iniciada.', [
    ('Usa Salir, Cerrar Sesión del panel administrativo o Configuración → Cerrar sesión.', 'Inicia el cierre; en Configuración solicita confirmación.'),
    ('Confirma cuando la pantalla lo solicita.', 'Cierra el acceso local y vuelve a Iniciar Sesión.'),
    ('Intenta abrir una ruta privada tras salir.', 'Solicita iniciar sesión de nuevo.'),
], [(2, 'Cancela la confirmación de Configuración.', 'Mantiene la sesión abierta.', 'Terminar sin cerrar sesión.')],
     'La sesión local queda cerrada; el acceso privado vuelve a requerir autenticación.')

caso('C04', 'La persona desea cambiar su contraseña.', 'Sesión iniciada en una cuenta que admite contraseña local.', [
    ('Abre Configuración → Seguridad y Acceso.', 'Presenta el formulario de cambio de contraseña local.'),
    ('Introduce contraseña actual, nueva válida y confirmación; pulsa Actualizar contraseña.', 'Valida contraseña actual, coincidencia, requisitos y que la nueva sea distinta.'),
    ('Continúa después de la confirmación correcta.', 'Guarda la nueva contraseña, conserva la sesión actual y revoca las demás.'),
], [(2, 'La actual es incorrecta, la nueva es inválida, no coincide o es igual a la anterior.', 'Rechaza el cambio y muestra el error; no sustituye la contraseña.', 'Corregir y retomar el paso 2.'),
    (1, 'La cuenta no tiene contraseña local.', 'No ofrece este formulario; Google continúa no disponible.', 'Terminar.')],
     'La nueva contraseña sustituye a la anterior y las otras sesiones se revocan.')

caso('C05', 'La persona desea contactar al responsable de una campaña.', 'Sesión iniciada de un participante permitido; el creador es otra persona.', [
    ('Abre Historia y Proyecto y baja hasta Sobre el Emprendedor.', 'Presenta Contactar Emprendedor cuando el creador no es la propia persona.'),
    ('Pulsa Contactar Emprendedor.', 'Abre o recupera la conversación asociada al destinatario y campaña.'),
    ('Consulta la conversación abierta.', 'Presenta el chat para continuar con el intercambio de mensajes.'),
], [(2, 'No ha iniciado sesión.', 'Abre Iniciar Sesión; tras acceder la persona puede regresar y volver a usar el contacto.', 'Continuar en CU-C02 y retomar el paso 2.'),
    (1, 'La campaña pertenece a la propia persona.', 'No ofrece una conversación consigo misma.', 'Terminar.')],
     'La conversación correcta queda abierta. El envío de mensajes se desarrolla en CU-C06.')

caso('C06', 'La persona desea continuar una conversación.', 'Sesión iniciada; participa en la conversación.', [
    ('Abre Mensajes y selecciona una conversación.', 'Muestra el destinatario y el historial autorizado.'),
    ('Consulta mensajes anteriores con el desplazamiento o Ver mensajes anteriores cuando aparece.', 'Carga el historial previo sin duplicar lo ya mostrado.'),
    ('Escribe un texto y usa el icono Enviar mensaje o Enter.', 'Envía el mensaje y lo incorpora a la conversación si la operación se completa.'),
], [(3, 'Falla el envío.', 'Informa que no se pudo enviar y permite intentar de nuevo; no lo confirma como entregado.', 'Reintentar el paso 3.')],
     'El mensaje enviado correctamente queda en el historial. No se incluyen adjuntos, edición ni eliminación de mensajes.')

caso('C07', 'La persona desea consultar sus avisos.', 'Sesión iniciada.', [
    ('Abre la campana o el centro de notificaciones.', 'Carga sus avisos y el indicador de no leídas.'),
    ('Aplica los filtros disponibles y recorre las páginas.', 'Muestra los avisos coincidentes de su cuenta.'),
    ('Abre una notificación.', 'Registra la lectura y navega al destino si el aviso tiene uno asociado.'),
], [(2, 'No hay avisos coincidentes.', 'Presenta el estado vacío y Restablecer filtros permite quitar las selecciones.', 'Retomar el paso 2 o terminar.')],
     'Los avisos se consultan y los abiertos quedan leídos; no se muestran notificaciones de otras cuentas.')

caso('C08', 'La persona desea organizar sus avisos.', 'Sesión iniciada; notificaciones propias cargadas.', [
    ('Usa la opción de marcar todas como leídas.', 'Marca sus notificaciones existentes y actualiza el contador.'),
    ('Elimina un aviso con su control disponible.', 'Retira ese aviso de su cuenta si la operación se completa.'),
    ('Consulta la campana o el centro de notificaciones.', 'Refleja los avisos y contadores actualizados.'),
], [(2, 'Prefiere limpiar todas las leídas.', 'Usa la opción de limpiar las leídas; retira solo esas y conserva las no leídas.', 'Retomar el paso 3.'),
    (1, 'Solo desea retirar un aviso concreto.', 'Omite marcar todas y usa directamente el control de eliminación del aviso.', 'Continuar en el paso 2.')],
     'Las notificaciones propias reflejan las operaciones correctas; no se modifican avisos ajenos.')

caso('C09', 'La persona desea ajustar sus preferencias de avisos.', 'Sesión iniciada; centro de notificaciones abierto.', [
    ('Abre Preferencias.', 'Carga los valores actuales de configuración.'),
    ('Cambia los interruptores disponibles y guarda.', 'Persiste los valores, confirma y cierra el diálogo si la operación termina correctamente.'),
    ('Vuelve a consultar las preferencias o recibe eventos cubiertos posteriormente.', 'Conserva los valores y aplica las preferencias a la generación de avisos correspondiente.'),
], [(1, 'No se pudieron cargar los valores actuales.', 'No permite guardar valores de reemplazo sin haber cargado la configuración.', 'Volver a abrir Preferencias o terminar.')],
     'Se guardan preferencias sin borrar avisos previos. Guardar Notificaciones por correo no acredita entrega real de emails.')

caso('C10', 'La persona desea participar con un comentario.', 'Donador o Emprendedor con sesión; campaña que admite participación.', [
    ('Selecciona Comentarios, cuarta pestaña principal después de Hitos y Avances.', 'Presenta los comentarios y, si la campaña admite participación, el cuadro Escribe un comentario...'),
    ('Escribe un comentario no vacío de hasta 2000 caracteres y usa el icono de enviar.', 'Valida la participación y registra el comentario en esa campaña.'),
    ('Consulta la lista actualizada.', 'Presenta el comentario publicado.'),
], [(1, 'Comentarios queda fuera del ancho visible.', 'La persona desplaza la barra principal horizontalmente a la derecha.', 'Retomar el paso 1.'),
    (2, 'No hay sesión o el texto está vacío.', 'Solicita Inicia sesión o impide el envío vacío, según corresponda.', 'Iniciar sesión en CU-C02 o corregir en el paso 2.'),
    (1, 'La campaña está cerrada.', 'Permite leer comentarios pero no muestra el cuadro para publicar.', 'Terminar con consulta de solo lectura.')],
     'El comentario válido queda publicado; una campaña cerrada mantiene solo la consulta.')

caso('C11', 'La persona desea marcar un comentario que le gusta.', 'Donador o Emprendedor con sesión; campaña que admite participación.', [
    ('Abre Comentarios y localiza un comentario.', 'Muestra el icono de pulgar arriba y su contador.'),
    ('Pulsa el pulgar arriba.', 'Registra su Me gusta y actualiza el contador.'),
], [(2, 'Ya había marcado ese comentario.', 'Retira su marca y ajusta el contador; no acumula marcas de la misma cuenta.', 'Terminar.'),
    (2, 'No ha iniciado sesión.', 'Solicita iniciar sesión antes de marcar.', 'Continuar en CU-C02 y volver al paso 2.'),
    (1, 'La campaña está cerrada.', 'Mantiene deshabilitado el control de Me gusta.', 'Terminar sin cambiar marcas.')],
     'La marca propia queda añadida o retirada una sola vez según su estado anterior.')

caso('C12', 'La persona desea consultar los datos de su cuenta.', 'Sesión iniciada.', [
    ('Abre Configuración → Configuración de Cuenta.', 'Muestra correo, indicador Verificado o Sin verificar y Último acceso según los datos disponibles.'),
    ('Consulta Mi Perfil y selecciona Perfil de Donador o Perfil de Emprendedor cuando corresponde.', 'Abre el perfil asociado a su rol.'),
], [(2, 'Prefiere gestionar su acceso.', 'Usa Seguridad y Acceso para cambiar la contraseña local o cerrar sesión mediante sus acciones disponibles.', 'Continuar en CU-C04 o CU-C03.')],
     'La información de cuenta se consulta. El indicador de correo es informativo y no ejecuta una verificación.')

caso('D01', 'El donador desea completar o actualizar su perfil.', 'Cuenta Donador con sesión.', [
    ('Abre Mi Perfil.', 'Presenta su perfil o propone completar los datos básicos si todavía no existe.'),
    ('Usa la edición de la sección deseada y guarda datos válidos.', 'Valida y conserva los cambios de esa sección.'),
    ('Consulta Donaciones, Información o Capital / Fondos.', 'Muestra el contenido correspondiente con los datos guardados.'),
], [(2, 'Intenta reducir el capital máximo por debajo del total ya invertido.', 'Rechaza el cambio sin reducir el capital bajo ese límite.', 'Corregir y retomar el paso 2.')],
     'El perfil propio queda actualizado. No hay eliminación de perfil disponible desde la web.')

caso('D02', 'El donador desea cambiar su foto o portada.', 'Cuenta Donador con sesión y perfil propio.', [
    ('Abre el control de foto o portada en Mi Perfil.', 'Permite seleccionar una imagen.'),
    ('Selecciona JPG/JPEG, PNG, WEBP o AVIF de hasta 10 MB y completa la carga.', 'Valida el archivo y actualiza la imagen correspondiente si la carga es correcta.'),
    ('Vuelve a consultar el perfil.', 'Presenta la imagen guardada.'),
], [(2, 'Cancela o el formato/tamaño no está permitido.', 'No sustituye la imagen anterior por la selección cancelada o rechazada.', 'Elegir otro archivo en el paso 2 o terminar.')],
     'La foto o portada válida queda actualizada sin cambiar la otra imagen.')

caso('D03', 'El donador desea aumentar su saldo de prueba.', 'Cuenta Donador con sesión y perfil configurado.', [
    ('Abre Mi Panel.', 'Presenta Capital Disponible, Total Donado, número de donaciones y Aumentar Capital.'),
    ('Selecciona Aumentar Capital y elige un monto sugerido o escribe uno; añade notas opcionales.', 'Presenta la confirmación y exige un monto mínimo de Bs. 100 en el formulario.'),
    ('Confirma un monto permitido.', 'Aumenta capital configurado y disponible por ese importe si la operación es correcta.'),
], [(2, 'El monto es menor a Bs. 100.', 'El formulario no permite enviar el aumento.', 'Corregir el monto en el paso 2.')],
     'El saldo simulado aumenta. No hay cobro a tarjeta ni transferencia bancaria real y no se crea una donación.')

caso('D04', 'El donador desea apoyar una campaña.', 'Cuenta Donador activa con sesión, perfil y saldo simulado suficiente; campaña ajena Publicada, sin vencimiento y con margen para recibir el monto.', [
    ('Abre la ficha e introduce un monto permitido.', 'Actualiza el formulario y el botón Donar Bs. [monto].'),
    ('Pulsa Donar Bs. [monto].', 'Abre Confirmar Aporte con campaña, monto y recompensa seleccionada si existe.'),
    ('Confirma el aporte.', 'Valida saldo, estado, fecha, límites y recompensa; registra el aporte y actualiza saldo y recaudación en una sola operación correcta.'),
    ('Consulta la confirmación y su panel.', 'Presenta el aporte registrado y permite continuar a sus comprobantes cuando corresponde.'),
], [(3, 'Cancela la confirmación.', 'No registra el aporte ni descuenta saldo.', 'Terminar o volver al paso 1.'),
    (3, 'Cambió el saldo, estado, límite, cupo o validez de la recompensa.', 'Rechaza el aporte sin descuento parcial de saldo.', 'Revisar condiciones y volver al paso 1 o terminar.'),
    (1, 'No hay sesión o la campaña no admite aportes.', 'Iniciar Sesión para Donar abre el acceso; una campaña propia, cerrada o vencida no habilita el aporte.', 'Continuar en CU-C02 si falta sesión; en los demás casos terminar.')],
     'El aporte confirmado queda registrado y saldo y recaudación cambian por el mismo monto. No se procesa dinero bancario real.')

caso('D05', 'El donador desea asociar una recompensa a su aporte.', 'Condiciones de CU-D04; campaña con niveles activos disponibles.', [
    ('Consulta Historia y Proyecto → Niveles de Recompensa y selecciona un nivel.', 'Refleja el nivel elegido y su monto sugerido en el formulario de aporte.'),
    ('Ajusta el monto dentro del rango del nivel y abre Confirmar Aporte.', 'Presenta la recompensa exacta seleccionada.'),
    ('Confirma el aporte.', 'Comprueba rango, moneda, vigencia y cupos y asocia exactamente ese nivel al aporte correcto.'),
], [(3, 'El nivel venció, no tiene cupos o el monto no satisface sus condiciones.', 'Rechaza la operación sin sustituir silenciosamente la recompensa por otra.', 'Ajustar monto o selección en el paso 1 o 2.'),
    (2, 'Prefiere aportar sin recompensa.', 'Usa Aportar sin recompensa y retira la selección.', 'Continuar en CU-D04 sin recompensa.')],
     'El aporte correcto queda asociado al nivel elegido; CU-D04 rige la confirmación y el saldo.')

caso('D06', 'El donador desea consultar sus aportes.', 'Cuenta Donador con sesión.', [
    ('Abre Mi Panel → Mis Aportes.', 'Presenta sus campañas, fechas, montos y estados.'),
    ('Busca por proyecto y aplica estado, fecha u orden disponibles.', 'Muestra las coincidencias con el orden elegido.'),
    ('Selecciona Ver proyecto.', 'Abre la ficha si la campaña conserva acceso público.'),
], [(3, 'Prefiere obtener un recibo.', 'Recibo se ofrece solo en aportes completados.', 'Continuar en CU-D07.'),
    (2, 'No tiene aportes coincidentes.', 'La consulta no agrega registros; la persona puede cambiar los filtros.', 'Retomar el paso 2 o terminar.')],
     'Los aportes propios quedan consultados sin alterar sus estados.')

caso('D07', 'El donador desea descargar un comprobante.', 'Cuenta Donador con sesión; aporte propio completado.', [
    ('Abre Mi Panel → Comprobantes y busca por proyecto o código de recibo.', 'Lista sus aportes completados disponibles para comprobante.'),
    ('Selecciona Descargar PDF en el aporte elegido.', 'Verifica propiedad y estado y genera el comprobante individual.'),
    ('Recibe la descarga del navegador.', 'Entrega el archivo correspondiente a ese aporte.'),
], [(1, 'Accede desde Recibo en Mis Aportes o desde la confirmación del aporte.', 'Solicita el comprobante de ese mismo aporte completado.', 'Continuar en el paso 2.'),
    (2, 'El aporte no es propio, no está completado o falla la generación.', 'No permite una descarga no autorizada; si falla la generación informa el error y permite intentar nuevamente.', 'Terminar si no está autorizado; reintentar el paso 2 si falló la generación.')],
     'Se descarga un PDF individual autorizado. Los reembolsados no se listan aquí ni se certifica validez tributaria.')

caso('D08', 'El donador desea conocer avances de los proyectos que apoyó.', 'Cuenta Donador con sesión.', [
    ('Abre Mi Panel → Novedades.', 'Carga publicaciones de proyectos respaldados por su cuenta.'),
    ('Selecciona un proyecto y usa Anterior o Siguiente si hay varias páginas.', 'Muestra las novedades y páginas correspondientes.'),
    ('Selecciona Ver proyecto.', 'Abre la campaña para continuar en Hitos y Avances.'),
], [(1, 'No hay novedades o falla la carga.', 'Distingue el estado sin novedades del error de consulta.', 'Terminar o volver a consultar el paso 1.')],
     'Las novedades de proyectos apoyados quedan consultadas, sin incluir campañas no respaldadas.')

caso('D09', 'El donador desea seguir sus recompensas.', 'Cuenta Donador con sesión.', [
    ('Abre Mi Panel → Recompensas.', 'Carga las recompensas vinculadas a sus contribuciones.'),
    ('Busca por proyecto o recompensa y aplica estado y orden disponibles.', 'Presenta las coincidencias con su estado registrado.'),
    ('Selecciona el enlace de seguimiento cuando existe.', 'Abre el destino de seguimiento guardado.'),
], [(3, 'No hay enlace de seguimiento.', 'No inventa un destino ni presenta una recompensa cancelada como entregada.', 'Terminar.')],
     'Se consulta el seguimiento existente. No hay formulario de incidencias ni confirmación de recepción por el donador.')

caso('D10', 'El donador desea consultar estadísticas y devoluciones.', 'Cuenta Donador con sesión.', [
    ('Abre Mi Panel → Rendimiento.', 'Presenta aporte promedio, monto reembolsado y evolución acumulada según sus registros.'),
    ('Consulta Mis Aportes y Capital Disponible cuando hay devoluciones.', 'Refleja los aportes reembolsados y el saldo simulado devuelto.'),
], [(1, 'No hay aportes completados, incluso si todos fueron reembolsados.', 'Rendimiento puede mostrar el estado inicial; Mis Aportes y el capital permiten comprobar devoluciones.', 'Continuar en el paso 2.')],
     'Se consultan métricas y devoluciones registradas. No se solicita un reembolso manual ni se genera por vencer la fecha solamente.')

caso('E01', 'El emprendedor desea completar su perfil.', 'Cuenta Emprendedor con sesión.', [
    ('Abre Mi Perfil y la edición de la sección deseada.', 'Presenta los datos actuales o permite completar el perfil inicial.'),
    ('Introduce datos válidos y guarda.', 'Valida y conserva los cambios de esa sección.'),
    ('Consulta Información, Datos Bancarios y el indicador de avance.', 'Presenta sus datos; Datos Bancarios ofrece Editar y el indicador muestra el avance del perfil.'),
], [(2, 'Faltan requisitos para crear campañas.', 'El perfil puede seguir completándose; el indicador no sustituye la aprobación de identidad.', 'Continuar en CU-E04.')],
     'El perfil queda actualizado por sección sin considerar aprobada la identidad por completar los datos.')

caso('E02', 'El emprendedor desea cambiar su foto o portada.', 'Cuenta Emprendedor con sesión y perfil propio.', [
    ('Abre el control de foto o portada en Mi Perfil.', 'Permite seleccionar la imagen correspondiente.'),
    ('Selecciona JPG/JPEG, PNG, WEBP o AVIF de hasta 10 MB y completa la carga.', 'Valida y guarda la imagen si la carga es correcta.'),
    ('Consulta nuevamente el perfil.', 'Presenta la foto o portada guardada.'),
], [(2, 'Cancela la selección o el archivo es rechazado por tipo o tamaño.', 'Mantiene la imagen anterior.', 'Elegir otro archivo en el paso 2 o terminar.')],
     'La imagen válida sustituye a la anterior; una cancelación o rechazo no la modifica.')

caso('E03', 'El emprendedor desea solicitar verificación de identidad.', 'Cuenta Emprendedor con sesión y perfil; sin solicitud pendiente de decisión.', [
    ('Usa Iniciar Verificación, Verificar Identidad o Reintentar KYC según el acceso disponible.', 'Abre el proceso de verificación de identidad.'),
    ('Adjunta documento de identidad y pulsa Siguiente.', 'Valida PDF, JPG/JPEG, PNG o WEBP de hasta 10 MB y abre validación facial.'),
    ('Toma una foto con la cámara o adjunta un archivo facial permitido.', 'Admite JPG/JPEG, PNG, WEBP, MP4, WEBM o MOV de hasta 50 MB.'),
    ('Pulsa Enviar a Revisión.', 'Registra la solicitud pendiente si el envío es correcto; espera una decisión administrativa.'),
], [(3, 'La cámara no funciona o no tiene permiso.', 'Permite seleccionar un archivo en lugar de capturar con cámara.', 'Retomar el paso 3.'),
    (2, 'El archivo no cumple formato o tamaño.', 'Rechaza la carga no válida.', 'Sustituir el archivo en el paso correspondiente.'),
    (1, 'Ya tiene una solicitud pendiente o una rechazada.', 'La pendiente no se reenvía como nueva; la rechazada permite consultar motivo y reintentar.', 'Esperar decisión o retomar el paso 2 tras el rechazo.')],
     'La solicitud queda pendiente; los documentos son privados y no equivalen a evidencias públicas.')

caso('E04', 'El emprendedor intenta comenzar una campaña.', 'Cuenta Emprendedor con sesión.', [
    ('Abre Mi Perfil o Mis Campañas → Lanzar Campaña.', 'Comprueba el perfil y los requisitos de elegibilidad.'),
    ('Completa los requisitos pendientes y vuelve al acceso de creación.', 'Exige biografía de al menos 30 caracteres, empresa o proyecto de al menos 2, sitio web y LinkedIn válidos HTTP/S, país e identidad aprobada.'),
    ('Abre la creación con los requisitos satisfechos.', 'Permite completar el formulario de campaña.'),
], [(2, 'La identidad no está aprobada.', 'Dirige al proceso de verificación cuando el acceso lo solicita; registrarse no concede elegibilidad.', 'Continuar en CU-E03 y volver tras la aprobación.')],
     'El emprendedor conoce lo que falta o accede al formulario; todavía no se crea una campaña.')

caso('E05', 'El emprendedor desea guardar una propuesta.', 'Cuenta Emprendedor con sesión y elegibilidad de CU-E04 satisfecha.', [
    ('Abre Mis Campañas → Lanzar Campaña.', 'Presenta el formulario de campaña.'),
    ('Completa título, eslogan, descripción, meta, categorías y al menos un documento con justificación.', 'Valida título 5–50, eslogan 10–50, descripción 50–800 caracteres, meta mínima Bs. 100 y al menos una categoría y un respaldo.'),
    ('Pulsa Guardar Borrador.', 'Crea el borrador propio y realiza las cargas posteriores de archivos como operaciones separadas.'),
    ('Abre Vista Previa.', 'Permite comprobar datos, portada y documentos que realmente quedaron guardados.'),
], [(2, 'Hay campos inválidos, fecha no futura si se ingresó, video distinto de YouTube/TikTok o falta respaldo.', 'El formulario bloquea la continuación y solicita corregir lo necesario; la fecha es opcional para guardar el borrador.', 'Corregir y retomar el paso 2.'),
    (3, 'Se crea el borrador pero falla una carga posterior.', 'Puede existir campaña sin todos los archivos esperados; no hay garantía de una confirmación integral en la interfaz actual.', 'Comprobar el borrador en el paso 4 antes de repetir la creación; consultar pendiente HU-P12.')],
     'La propuesta creada queda en Borrador. La existencia de la campaña no garantiza que portada y respaldos se cargaron íntegramente.')

caso('E06', 'El emprendedor desea definir las recompensas de su campaña.', 'Formulario editable de campaña propia; Borrador o Rechazada.', [
    ('Abre Estructura de Recompensas y usa Agregar Nivel.', 'Presenta los campos del nivel.'),
    ('Completa título, descripción y porcentajes válidos.', 'Añade el nivel a la lista del formulario si 0 ≤ mínimo < máximo ≤ 100.'),
    ('Guarda la campaña.', 'Conserva las definiciones guardadas y permite consultarlas en Recompensas de Vista Previa cuando existen niveles.'),
], [(2, 'Desea cambiar o quitar una definición antes de guardar.', 'Editar Nivel o Eliminar Nivel modifica la lista del formulario.', 'Retomar el paso 2 o 3.'),
    (2, 'El rango de porcentajes es inválido.', 'No incorpora el nivel con esos porcentajes.', 'Corregir y retomar el paso 2.')],
     'Los niveles quedan definidos al guardar correctamente; Vista Previa los consulta en solo lectura, sin promesa de desactivación desde esa pestaña.')

caso('E07', 'El emprendedor desea adjuntar respaldo.', 'Formulario de campaña propia editable; para consultar guardados, Vista Previa disponible.', [
    ('Selecciona un archivo y escribe su justificación; pulsa Añadir Documento.', 'Añade el respaldo a la lista pendiente del formulario.'),
    ('Guarda la campaña.', 'Intenta cargar los respaldos; admite PDF, JPG/JPEG, PNG, WEBP, DOC o DOCX de hasta 20 MB.'),
    ('Abre Vista Previa → Documentación y usa Ver Documento.', 'Muestra los documentos realmente guardados, estado y observaciones disponibles.'),
], [(1, 'Falta archivo o justificación.', 'Solicita ambos datos antes de añadir.', 'Completar y retomar el paso 1.'),
    (1, 'Retira un archivo pendiente antes de guardar.', 'No lo incluye en ese envío; no borra documentos previamente guardados.', 'Retomar el paso 1 o 2.'),
    (2, 'La carga falla o el formato/tamaño no se admite.', 'El archivo no queda como respaldo válido; puede existir borrador por guardado parcial.', 'Comprobar la lista del paso 3; consultar pendiente HU-P12.')],
     'Los respaldos cargados correctamente pueden consultarse. No existe un control conectado para eliminar documentos ya guardados.')

caso('E08', 'El emprendedor desea localizar y editar una campaña.', 'Cuenta Emprendedor con sesión; campañas propias.', [
    ('Abre Mis Campañas y busca por título o selecciona una pestaña de estado.', 'Filtra la lista cargada; alternar tarjetas/lista solo cambia la presentación.'),
    ('Abre Vista Previa de un Borrador o una Rechazada y selecciona Editar.', 'Presenta el formulario editable de esa campaña.'),
    ('Modifica datos válidos y guarda con el respaldo requerido.', 'Conserva los cambios correctos y permite comprobarlos en Vista Previa.'),
], [(2, 'La campaña está en otro estado.', 'No ofrece la edición mediante el formulario de borrador.', 'Terminar o consultar la campaña sin editar.'),
    (3, 'Prefiere abandonar cambios.', 'Usa Descartar y confirma la salida sin guardar las modificaciones del formulario.', 'Terminar sin guardar.')],
     'Los cambios guardados quedan en la campaña propia. La búsqueda solo filtra lo cargado: no hay paginación ni selector de orden en Mis Campañas.')

caso('E09', 'El emprendedor desea solicitar revisión de una propuesta.', 'Campaña propia Borrador o Rechazada; requisitos y respaldos válidos.', [
    ('Abre Vista Previa y revisa la propuesta guardada.', 'Presenta datos y acciones disponibles de la campaña.'),
    ('Pulsa Enviar Revisión.', 'Valida el envío y registra la campaña como pendiente de revisión con su historial.'),
    ('Consulta el estado tras el envío.', 'Mantiene la espera de una decisión administrativa; no publica la campaña.'),
], [(1, 'Usa el formulario desde Mi Perfil.', 'Enviar a Revisión permite guardar y enviar si la operación completa es correcta.', 'Continuar en el paso 3.'),
    (1, 'Usa el formulario de Mis Campañas sin botón de envío directo.', 'Guarda primero con Guardar Borrador y envía desde la tarjeta o Vista Previa.', 'Retomar el paso 2.'),
    (2, 'Faltan requisitos o la campaña ya está pendiente.', 'El envío no equivale a una nueva aprobación; se deben corregir requisitos o esperar la decisión según el estado.', 'Corregir en CU-E08 o esperar; tras rechazo puede leer motivo, editar y reenviar.')],
     'La solicitud aceptada queda pendiente de revisión. Aprobación y publicación siguen siendo pasos diferentes.')

caso('E10', 'El emprendedor desea lanzar una campaña aprobada.', 'Campaña propia Aprobada con fecha válida para publicar.', [
    ('Localiza la campaña Aprobada.', 'Presenta Publicar Campaña en la tarjeta o Lanzar en Vista Previa.'),
    ('Pulsa Publicar Campaña o Lanzar.', 'Comprueba estado y fecha y procesa el lanzamiento.'),
    ('Consulta el resultado.', 'La campaña pasa a Publicada y puede aparecer en Explorar si la operación es correcta.'),
], [(2, 'La fecha ya venció o el estado no permite publicar.', 'Rechaza el lanzamiento. En Aprobada la edición está bloqueada y no hay recorrido web completo para corregir la fecha.', 'Terminar; la solución del recorrido está pendiente en HU-P07.')],
     'La campaña lanzada correctamente queda Publicada. Estar Aprobada por sí solo no la publica.')

caso('E11', 'El emprendedor desea conocer resultados y donadores.', 'Cuenta Emprendedor con sesión; campaña propia con pestañas habilitadas según su estado.', [
    ('Abre Vista Previa → Progreso Económico.', 'Presenta recaudación, evolución y desglose; las proyecciones son estimaciones.'),
    ('Abre Donadores Activos y recorre sus páginas.', 'Lista los donadores vinculados a su campaña.'),
    ('Selecciona una ficha de donador.', 'Muestra la información que ofrece el sistema para esa ficha.'),
], [(1, 'Prefiere la consulta desde Mi Perfil.', 'En Finanzas selecciona una de sus campañas y consulta sus métricas.', 'Terminar tras la consulta.'),
    (3, 'Intenta contactar desde Enviar Mensaje.', 'El control anuncia Próximamente; no inicia una conversación operativa.', 'Terminar; función pendiente HU-P05.')],
     'Las métricas y donadores autorizados quedan consultados sin iniciar un chat desde la ficha de donador.')

caso('E12', 'El emprendedor desea actualizar una entrega de recompensa.', 'Campaña propia con niveles y registros de recompensa; sesión Emprendedor.', [
    ('Abre Vista Previa → Recompensas → Donadores con Recompensas.', 'Lista donador, recompensa, monto y estado de cada registro.'),
    ('Abre el selector de un registro y elige una transición permitida.', 'Ofrece pendiente a preparación, preparación a enviada, enviada a entregada, o cancelación cuando está habilitada.'),
    ('Completa el cambio.', 'Guarda el estado; el donador puede consultarlo desde Mi Panel → Recompensas.'),
], [(2, 'El registro ya está entregado, cancelado o reembolsado.', 'No ofrece reactivarlo ni cambiar su estado.', 'Terminar sin modificarlo.'),
    (3, 'Falla la actualización.', 'Muestra el error e intenta recuperar el estado vigente; no confirma un cambio fallido.', 'Revisar el estado y volver al paso 2 si todavía corresponde.')],
     'El estado permitido queda actualizado. No hay campos web para introducir número o URL de seguimiento.')

caso('E13', 'El emprendedor desea publicar una novedad.', 'Campaña propia Publicada; sesión Emprendedor.', [
    ('En Mis Campañas pulsa Publicar Novedad en la tarjeta.', 'Abre el formulario de publicación.'),
    ('Escribe título de al menos 3 caracteres y contenido de al menos 10; elige texto o el tipo de adjunto.', 'Valida campos y solicita archivo si el tipo elegido lo requiere.'),
    ('Pulsa Publicar.', 'Registra la novedad pública si la operación es correcta.'),
    ('Consulta Hitos y Avances o Transparencia y Fondos → Bitácora.', 'Presenta la novedad; los donadores vinculados pueden consultarla en Mi Panel → Novedades.'),
], [(2, 'Faltan caracteres requeridos o el archivo del tipo elegido.', 'Solicita completar los datos antes de publicar.', 'Corregir y retomar el paso 2.')],
     'La novedad correcta queda publicada; si es reciente puede aparecer en historias. No se documenta edición ni borrado web.')

caso('E14', 'El emprendedor desea cerrar una campaña publicada.', 'Campaña propia Publicada; acción Finalizar Campaña disponible en la tarjeta.', [
    ('Pulsa Finalizar Campaña en Mis Campañas.', 'Solicita confirmar la finalización.'),
    ('Confirma la operación.', 'Procesa la finalización y actualiza el estado y su historial.'),
    ('Consulta el resultado cuando la recaudación es insuficiente.', 'La campaña queda Fallida, reembolsa los aportes completados al saldo simulado y cancela sus recompensas.'),
], [(2, 'Cancela la confirmación.', 'No realiza la finalización.', 'Terminar.'),
    (1, 'La campaña está Financiada o Parcialmente financiada.', 'La tarjeta no ofrece esta acción aunque el servidor admita finalizar; no hay recorrido web completo aquí.', 'Terminar; recorrido pendiente HU-P07.')],
     'La finalización ejecutada queda registrada. El vencimiento de fecha por sí solo no finaliza ni reembolsa automáticamente.')

caso('E15', 'El emprendedor desea retirar una propuesta.', 'Campaña propia Borrador o Rechazada, sin actividad financiera que impida eliminar.', [
    ('En Mis Campañas usa Eliminar Campaña o el menú Eliminar.', 'Solicita confirmación de eliminación.'),
    ('Confirma la eliminación.', 'Comprueba permisos, estado y ausencia de actividad que la bloquee.'),
    ('Consulta nuevamente sus campañas.', 'La campaña eliminada correctamente deja de aparecer.'),
], [(2, 'Cancela la confirmación.', 'Conserva la campaña.', 'Terminar.'),
    (2, 'Existe actividad financiera que impide eliminar.', 'Bloquea la operación y conserva la campaña.', 'Terminar.'),
    (1, 'La campaña está en otro estado.', 'No ofrece esta eliminación de propuesta desde la tarjeta.', 'Terminar.')],
     'La propuesta autorizada queda eliminada; cancelar o una restricción conserva el registro.')

caso('A01', 'El administrador desea conocer el estado de la plataforma.', 'Sesión Administrador o Superadministrador.', [
    ('Abre el panel → Estadísticas.', 'Carga indicadores disponibles de usuarios, campañas y pendientes.'),
    ('Selecciona un acceso de Usuarios, Campañas, Verificación KYC, Revisión o Auditoría.', 'Abre el módulo administrativo correspondiente.'),
], [(1, 'La cuenta no tiene permisos administrativos.', 'Rechaza el acceso a datos administrativos aunque conozca la dirección.', 'Terminar sin acceso.')],
     'Los indicadores quedan consultados y puede abrirse el módulo seleccionado.')

caso('A02', 'El administrador desea consultar o suspender una cuenta.', 'Sesión Administrador o Superadministrador.', [
    ('Abre Gestión de Usuarios y busca por correo.', 'Lista coincidencias con correo, identificador abreviado, Fecha de Registro y estado Activo o Suspendido.'),
    ('Selecciona la suspensión de una cuenta activa y confirma.', 'Comprueba las restricciones y desactiva la cuenta si está permitido.'),
    ('Consulta la lista actualizada.', 'Presenta la cuenta Suspendida; no puede iniciar sesión.'),
], [(2, 'Cancela la confirmación.', 'Conserva el estado anterior.', 'Terminar.'),
    (2, 'Intenta suspender su propia cuenta o un Superadministrador.', 'Bloquea la operación.', 'Terminar sin suspender.'),
    (1, 'Solo desea consultar.', 'No realiza acciones de suspensión.', 'Terminar tras el paso 1.')],
     'La cuenta autorizada queda suspendida, conservando sus datos; no hay reactivación disponible desde esta pantalla.')

caso('A03', 'El administrador desea consultar o eliminar una campaña.', 'Sesión Administrador o Superadministrador.', [
    ('Abre Gestión de Campañas; busca por título, creador o correo y selecciona un estado.', 'Filtra las campañas y permite recargarlas con Actualizar.'),
    ('Abre una campaña.', 'Presenta sus datos, historial, documentos y pestañas habilitadas.'),
    ('Solicita y confirma eliminar una campaña sin actividad financiera.', 'Comprueba restricciones y la elimina si corresponde.'),
], [(3, 'Existen aportes, movimientos o recompensas que impiden eliminar.', 'Bloquea la operación y conserva la campaña.', 'Terminar.'),
    (2, 'Desea decidir una solicitud pendiente.', 'Los botones de aprobación de Gestión de Campañas no están conectados; debe usar Revisión de Campañas.', 'Continuar en CU-A04.'),
    (3, 'Solo desea consultar o cancela eliminar.', 'Conserva el registro.', 'Terminar sin eliminar.')],
     'Se consulta la campaña o se elimina cuando está permitido. No se aprueba desde controles sin conexión.')

caso('A04', 'El administrador desea decidir una solicitud de campaña.', 'Sesión Administrador o Superadministrador; solicitud pendiente.', [
    ('Abre Revisión de Campañas, busca por título o emprendedor y recorre sus páginas.', 'Lista las solicitudes pendientes coincidentes.'),
    ('Abre la propuesta y revisa propietario, documentos e historial.', 'Presenta los datos necesarios para su decisión.'),
    ('Selecciona Aprobar en el detalle; si usa la aprobación rápida del listado, confirma su diálogo.', 'Registra Aprobada; el emprendedor todavía debe publicarla.'),
], [(3, 'Decide rechazar.', 'Escribe un motivo y confirma; registra Rechazada y deja el motivo disponible para corregir y reenviar.', 'Terminar con rechazo.'),
    (3, 'Intenta rechazar sin motivo.', 'La interfaz impide completar el rechazo.', 'Completar motivo y retomar el paso 3.')],
     'La decisión queda registrada. El listado no incluye un filtro para todos los estados ni publica automáticamente.')

caso('A05', 'El administrador desea decidir una verificación de identidad.', 'Sesión Administrador o Superadministrador; solicitud KYC pendiente.', [
    ('Abre Verificaciones KYC y pulsa Revisar.', 'Presenta datos, documento de identidad y validación facial autorizados.'),
    ('Consulta los archivos y la información presentada.', 'Permite su revisión privada.'),
    ('Aprueba la solicitud.', 'Guarda la revisión, verifica el perfil y retira la solicitud de pendientes.'),
], [(2, 'El enlace de un archivo caducó.', 'Usa la renovación o descarga permitida para intentar recuperar el archivo sin hacerlo público.', 'Retomar el paso 2.'),
    (3, 'Decide rechazar.', 'Registra rechazo con motivo; el emprendedor puede reenviar documentación.', 'Terminar con rechazo.'),
    (3, 'La solicitud ya fue resuelta o está desactualizada.', 'Impide decidir nuevamente sobre ese estado y requiere actualizar la lista.', 'Volver al paso 1.')],
     'La identidad queda aprobada o rechazada; los documentos KYC permanecen privados.')

caso('A06', 'El administrador desea revisar un respaldo de campaña.', 'Sesión Administrador o Superadministrador; documento de campaña pendiente.', [
    ('En el detalle administrativo abre Documentación y Ver Documento.', 'Presenta archivo autorizado y justificación.'),
    ('Revisa el respaldo y selecciona Aprobar.', 'Registra Aprobado y actualiza la lista, sin publicarlo automáticamente.'),
    ('Consulta el estado del documento en la lista actualizada.', 'Presenta el resultado de la revisión.'),
], [(2, 'Decide Rechazar.', 'Escribe el motivo solicitado y confirma; registra Rechazado con observaciones para el emprendedor.', 'Terminar con rechazo.')],
     'El documento queda revisado. Esta decisión es independiente de aprobar la campaña y de publicar la evidencia.')

caso('A07', 'El administrador desea autorizar una evidencia pública.', 'Sesión Administrador o Superadministrador; documento aprobado de campaña.', [
    ('Abre Documentación del detalle administrativo.', 'Presenta estado y control Publicar evidencia cuando corresponde.'),
    ('Pulsa Publicar evidencia.', 'Guarda la autorización pública si cumple las condiciones.'),
    ('Consulta Evidencias de la campaña pública.', 'El documento autorizado queda disponible para su consulta pública.'),
], [(2, 'La evidencia ya está publicada y decide retirarla.', 'Usa Retirar publicación; deja de estar accesible por su publicación pública.', 'Terminar con publicación retirada.'),
    (2, 'El documento no está aprobado.', 'No autoriza publicarlo como evidencia válida.', 'Revisar el documento en CU-A06 o terminar.')],
     'La autorización pública queda activada o retirada sin convertir documentos KYC en evidencias.')

caso('A08', 'El administrador desea revisar un movimiento financiero.', 'Sesión Administrador o Superadministrador; movimiento visible en Auditoría de Gastos.', [
    ('Busca por concepto, factura, notas o campaña y aplica tipo, estado o comprobante; recorre las páginas.', 'Presenta movimientos coincidentes.'),
    ('Pulsa Revisar en un movimiento.', 'Carga importe, categoría, comprobante disponible e Historial de cambios y revisiones.'),
    ('Elige Aprobar / Verificado y pulsa Confirmar Dictamen.', 'Comprueba permisos y versión y registra el dictamen si el movimiento admite revisión.'),
    ('Consulta el resultado.', 'Actualiza lista, resumen e historial.'),
], [(3, 'Prefiere Marcar Observado o Rechazar.', 'Exige explicación para completar ese dictamen.', 'Añadir explicación y retomar el paso 3.'),
    (3, 'Cambió la versión o el movimiento no admite revisión.', 'No sobrescribe otra revisión; requiere recargar o limitarse a consultar.', 'Volver al paso 2 o terminar con consulta.')],
     'El dictamen autorizado queda registrado con historial. No existen filtros visibles de origen ni fechas.')

caso('A09', 'El administrador desea comparar presupuesto y ejecución.', 'Sesión Administrador o Superadministrador; Auditoría de Gastos abierto.', [
    ('Pulsa el icono Auditar Plan de Fondos de la Campaña.', 'Abre Auditoría Presupuestaria de la Campaña correspondiente.'),
    ('Consulta categorías, Presupuestado, Ejecutado, Varianza, Comprobantes Faltantes y Estado.', 'Presenta la comparación basada en los registros disponibles.'),
    ('Consulta los movimientos sin categoría si existen y pulsa Cerrar Auditoría.', 'Los muestra en una sección separada y regresa al listado al cerrar.'),
], [(2, 'No hay registros suficientes para una comparación completa.', 'La consulta se limita a los registros disponibles; no genera datos financieros ni indicadores de hitos.', 'Terminar la consulta con Cerrar Auditoría.')],
     'Se consulta la comparación sin modificar presupuesto ni movimientos.')

caso('S01', 'El superadministrador desea consultar las cuentas administrativas.', 'Sesión Superadministrador.', [
    ('Abre Gestión de Admins.', 'Lista correo, nivel y estado de las cuentas administrativas.'),
    ('Consulta las cuentas o elige otro módulo administrativo en la barra lateral.', 'Permite continuar con las funciones del Administrador que también posee.'),
], [(1, 'Una cuenta sin nivel Superadministrador intenta acceder.', 'Rechaza la gestión de administradores.', 'Terminar sin acceso.')],
     'Las cuentas administrativas quedan consultadas sin cambiar sus permisos.')

caso('S02', 'El superadministrador desea crear un administrador.', 'Sesión Superadministrador; correo nuevo.', [
    ('Abre Gestión de Admins → Crear Administrador.', 'Presenta los campos de correo y contraseña.'),
    ('Introduce correo y contraseña válida y pulsa Crear Administrador.', 'Valida datos y que el correo no esté registrado.'),
    ('Consulta el listado tras la creación correcta.', 'Muestra la nueva cuenta de Administrador común.'),
], [(2, 'Los datos son inválidos o el correo ya existe.', 'Rechaza la creación sin duplicar cuentas.', 'Corregir y retomar el paso 2.')],
     'Existe un Administrador común nuevo. El formulario no promueve cuentas existentes ni permite crear Superadministradores.')

caso('S03', 'El superadministrador desea retirar permisos administrativos.', 'Sesión Superadministrador; cuenta Administrador común distinta de la propia.', [
    ('En Gestión de Admins pulsa Revocar sobre el administrador elegido.', 'Solicita confirmar la revocación.'),
    ('Confirma la operación.', 'Comprueba restricciones y retira sus permisos administrativos.'),
    ('Consulta el listado actualizado.', 'Refleja el retiro de permisos conservando la cuenta de usuario.'),
], [(2, 'Cancela la confirmación.', 'Mantiene los privilegios anteriores.', 'Terminar.'),
    (2, 'Intenta revocar su propia cuenta o un Superadministrador.', 'Bloquea la operación.', 'Terminar sin cambiar permisos.')],
     'La cuenta pierde los permisos administrativos autorizados; no queda suspendida por esta operación.')
