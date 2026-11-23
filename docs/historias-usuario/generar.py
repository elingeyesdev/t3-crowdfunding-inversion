"""Historias de usuario web: datos, trazabilidad y documento HTML autónomo.
Ejecutar: python docs/historias-usuario/generar.py
No consulta ni modifica cuentas, campañas o la base de datos.
"""
from pathlib import Path
import html
import json

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.parent
FLOWS = {f['id']: f for f in json.loads((ROOT.parent/'diagramas-web/flujos.json').read_text(encoding='utf-8'))}
STORIES = []


def hu(id, rol, titulo, quiero, para, acceso, diagramas, criterios, *, estado='Actual', limites='', dependencias=(), fuentes=()):
    actor={
        'HU-P01':'usuario con cuenta', 'HU-P02':'visitante', 'HU-P03':'donador o emprendedor',
        'HU-P04':'administrador', 'HU-P05':'emprendedor', 'HU-P06':'emprendedor',
        'HU-P07':'emprendedor', 'HU-P08':'visitante', 'HU-P09':'emprendedor',
        'HU-P10':'emprendedor o administrador autorizado', 'HU-P11':'administrador',
        'HU-P12':'emprendedor', 'HU-P13':'usuario con cuenta', 'HU-P14':'usuario con cuenta',
        'HU-P15':'emprendedor', 'HU-P16':'donador o emprendedor',
        'HU-P17':'usuario con cuenta',
        'HU-T01':'usuario de la plataforma',
    }.get(id,rol.lower())
    STORIES.append(dict(id=id, rol=rol, actor=actor, titulo=titulo, historia=f'Como {actor}, quiero {quiero} para {para}.',
                        acceso=acceso, diagramas=diagramas.split(), estado=estado, limites=limites,
                        dependencias=list(dependencias), fuentes=list(fuentes),
                        criterios=[dict(id=f'{id}-CA{i:02}', dado=d, cuando=c, entonces=e) for i,(d,c,e) in enumerate(criterios,1)]))


V='Visitante'
C='Usuario con cuenta'
D='Donador'
E='Emprendedor'
A='Administrador'
S='Superadministrador'
P='Funciones pendientes'

hu('HU-V01',V,'Conocer la plataforma y acceder al catálogo','conocer la propuesta de UniFundme y entrar en Explorar','identificar proyectos que puedo apoyar',
   'Inicio; sin sesión.','V01',[
       ('que estoy en Inicio','selecciono Explorar','se abre el catálogo de campañas.'),
       ('que no he iniciado sesión','abro Explorar o una campaña pública','puedo consultar su contenido sin registrarme.'),
       ('que estoy en una página pública','selecciono Iniciar Sesión','se abre la pantalla de acceso con correo y contraseña.'),
   ],fuentes=('web/frontend/src/pages/LandingPage.tsx','web/frontend/src/components/Navbar.tsx'))

hu('HU-V02',V,'Buscar y filtrar campañas','buscar proyectos y seleccionar su sector','encontrar campañas de mi interés',
   'Explorar → Sector y búsqueda.','V01',[
       ('que el catálogo está abierto','escribo un término y pulso Enter o Ver todos los resultados','se muestra la lista correspondiente a la búsqueda.'),
       ('que hay categorías activas','selecciono una opción en Sector','se aplica esa categoría; Todos los sectores retira la selección de categoría.'),
       ('que aparecen sugerencias de búsqueda','selecciono una de ellas','se abre directamente la campaña elegida.'),
       ('que la búsqueda no coincide con campañas','consulto la lista','se muestra Sin Resultados y Limpiar filtros permite volver al catálogo sin la búsqueda ni el sector seleccionados.'),
       ('que los resultados ocupan varias páginas','selecciono otra página','se muestran sus campañas y se impide retroceder antes de la primera o avanzar después de la última.'),
   ],limites='Explorar no ofrece un selector de orden, aunque existan opciones de ordenamiento en otras partes del sistema.')

hu('HU-V03',V,'Navegar por el detalle de una campaña','consultar la información de un proyecto desde sus pestañas','decidir si deseo apoyarlo',
   'Explorar → campaña.','V02',[
       ('que abro una campaña pública','carga su ficha','veo título, resumen, creador, Recaudado, Meta, Donantes y Días Restantes cuando hay fecha de cierre.'),
       ('que estoy en la ficha','consulto la barra principal','encuentro Historia y Proyecto, Transparencia y Fondos, Hitos y Avances y Comentarios.'),
       ('que Comentarios queda fuera del ancho visible','desplazo horizontalmente la barra hacia la derecha','puedo seleccionar Comentarios, a continuación de Hitos y Avances.'),
       ('que la campaña no está disponible o falla su carga','intento abrirla','se muestra el estado de error y los accesos para volver o Reintentar; no se presenta el error como una campaña vacía.'),
   ])

hu('HU-V04',V,'Consultar Historia y Proyecto','leer la propuesta y conocer al emprendedor','evaluar el propósito y al responsable de la campaña',
   'Ficha → Historia y Proyecto.','V02',[
       ('que la ficha está disponible','selecciono Historia y Proyecto','se presenta Historia del Proyecto con su descripción y Sobre el Emprendedor con los datos disponibles.'),
       ('que la campaña tiene niveles de recompensa','consulto esta pestaña','aparece Niveles de Recompensa con sus condiciones.'),
       ('que quiero consultar la transparencia desde esta sección','pulso Ver Transparencia','se selecciona Transparencia y Fondos.'),
       ('que el creador es otra persona','consulto Sobre el Emprendedor','encuentro Contactar Emprendedor; la conversación requiere iniciar sesión.'),
   ])

hu('HU-V05',V,'Descubrir campañas en DonaTok','ver videos de presentación de campañas','conocer proyectos de forma audiovisual',
   'Barra superior → DonaTok.','V03',[
       ('que existen campañas con video','abro DonaTok','puedo ver sus videos y resúmenes.'),
       ('que hay más videos','me desplazo verticalmente','cambia la campaña presentada.'),
       ('que un proyecto me interesa','pulso Ver Campaña y Donar','se abre su ficha; no se registra ninguna donación solo por abrirla.'),
       ('que falla la carga o no hay campañas con video','abro DonaTok','se presenta el estado de error o de ausencia de contenido correspondiente, sin inventar videos.'),
   ])

hu('HU-V06',V,'Consultar historias recientes','ver las novedades recientes en la barra de historias','enterarme de la actividad de las campañas',
   'Explorar → avatares de historias.','V04',[
       ('que existen novedades públicas de las últimas 24 horas','consulto la barra de historias','veo los avatares de las campañas que tienen esas publicaciones.'),
       ('que selecciono un avatar','se abre el visor','puedo leer sus historias y usar la navegación anterior y siguiente disponible.'),
       ('que quiero salir del visor','uso el cierre o Escape','vuelvo al catálogo.'),
       ('que no existen novedades recientes','abro Explorar','puedo seguir consultando las campañas sin depender de la barra de historias.'),
   ],limites='El visor no incluye un acceso directo a la ficha de campaña; se busca el proyecto después de cerrarlo.')

hu('HU-V07',V,'Compartir campañas','copiar o compartir el enlace de una campaña','difundir el proyecto entre otras personas',
   'Ficha → Compartir Campaña; Explorar → icono de compartir.','V05',[
       ('que una campaña es pública','abro el diálogo de compartir','se ofrece su enlace y las opciones WhatsApp, Facebook, X y LinkedIn.'),
       ('que está abierto el diálogo','pulso Copiar enlace','el enlace de esa campaña se copia y aparece la confirmación de copia.'),
       ('que selecciono una red social','se abre su enlace de compartir','el destino recibe la URL de la campaña; la publicación final se realiza en el servicio externo.'),
       ('que cierro el diálogo sin compartir','regreso a la ficha o al catálogo','la campaña y mis aportes no se modifican.'),
   ])

hu('HU-V08',V,'Consultar Plan de Fondos e hitos','revisar la distribución prevista y las etapas del proyecto','entender cómo se plantea utilizar lo recaudado',
   'Transparencia y Fondos → Plan de Fondos / Hitos del Proyecto; también Hitos y Avances.','V06 V02',[
       ('que estoy en la ficha','selecciono Transparencia y Fondos','encuentro Plan de Fondos, Auditoría y Movimientos, Hitos del Proyecto, Evidencias y Bitácora; puedo desplazar la barra si una opción queda oculta.'),
       ('que selecciono Plan de Fondos','carga la sección','puedo consultar las categorías y la distribución que presenta la pantalla.'),
       ('que selecciono Hitos del Proyecto','carga la sección','puedo consultar las etapas y sus estados mostrados.'),
       ('que selecciono Hitos y Avances en la barra principal','carga su contenido','veo la sección de hitos y la de novedades del proyecto.'),
   ],estado='Parcial',limites='Los componentes pueden mostrar datos de ejemplo si falta información del proyecto. Estos criterios cubren la navegación, no acreditan que esos ejemplos sean compromisos reales. La información respaldada por registros de cada campaña se especifica en HU-P08.',dependencias=('HU-P08',))

hu('HU-V09',V,'Consultar la recaudación pública','revisar gráficos y aportes recientes','conocer la evolución del financiamiento',
   'Transparencia y Fondos → Auditoría y Movimientos.','V06',[
       ('que existe información financiera pública','selecciono Auditoría y Movimientos','se muestran los indicadores y gráficos de recaudación disponibles para la campaña.'),
       ('que la sección presenta aportes recientes','selecciono Todos, Directos o Recompensas','la tabla se limita al tipo de aporte elegido.'),
       ('que el filtro no tiene registros','lo selecciono','se muestra la ausencia de transacciones para ese filtro.'),
       ('que falla la consulta de información financiera','se presenta el error','puedo usar Reintentar en esa sección sin interpretar el fallo como recaudación cero.'),
   ],limites='La tabla pública muestra aportes recientes. No equivale al módulo privado de auditoría de egresos ni a un extracto completo de gastos.')

hu('HU-V10',V,'Consultar evidencias públicas','abrir los documentos publicados de una campaña','revisar su respaldo documental',
   'Transparencia y Fondos → Evidencias.','V06',[
       ('que hay documentos aprobados y autorizados para publicación','abro Evidencias','se listan con su nombre y justificación disponible.'),
       ('que selecciono Abrir documento','el documento sigue autorizado','se abre su archivo en otra pestaña.'),
       ('que un documento es privado o no está autorizado','consulto Evidencias','no aparece como evidencia pública ni puedo obtenerlo mediante su acceso público.'),
       ('que no hay documentos públicos','abro la sección','se muestra No hay evidencias públicas disponibles; si falla la carga se muestra el error y Reintentar.'),
   ])

hu('HU-V11',V,'Consultar novedades de una campaña','leer las publicaciones del emprendedor','seguir los avances comunicados por el proyecto',
   'Hitos y Avances, o Transparencia y Fondos → Bitácora.','V02 V06',[
       ('que hay actualizaciones públicas','abro Hitos y Avances o Bitácora','se muestran las publicaciones de la campaña con su contenido y adjuntos disponibles.'),
       ('que no hay publicaciones','consulto la sección','se presenta el estado sin novedades, sin generar avances ficticios.'),
       ('que falla la consulta de novedades','uso Reintentar','se vuelve a solicitar el contenido de la misma campaña.'),
   ])

hu('HU-V12',V,'Reproducir la presentación de una campaña','ver el video del proyecto desde su ficha','conocer la propuesta antes de aportar',
   'Ficha de campaña → Ver Pitch.','V02',[
       ('que la campaña tiene un enlace de video','abro su ficha','aparece Ver Pitch sobre la portada.'),
       ('que pulso Ver Pitch','se despliega el contenido','puedo consultar el reproductor del video asociado a esa campaña.'),
       ('que el video está desplegado','pulso Ocultar Pitch','se oculta la sección del reproductor; si no hay enlace de video no se ofrece Ver Pitch.'),
   ])

hu('HU-V13',V,'Abrir proyectos relacionados','consultar otras campañas sugeridas','descubrir proyectos del mismo sector',
   'Ficha de campaña → También te puede interesar.','V02',[
       ('que hay otras campañas públicas de la categoría consultada','cargo la ficha','pueden aparecer hasta tres sugerencias en También te puede interesar, sin repetir la campaña actual.'),
       ('que selecciono una sugerencia','se abre su destino','consulto la ficha de la campaña elegida.'),
       ('que no hay sugerencias disponibles','consulto la ficha','la sección no se muestra y puedo continuar usando Explorar.'),
   ])

hu('HU-C01',C,'Crear una cuenta por correo','registrarme como Donador o Emprendedor','participar con el rol elegido',
   'Iniciar Sesión → Crea tu cuenta.','C01',[
       ('que no existe una cuenta con mi correo','elijo Donador o Emprendedor, ingreso correo y contraseña válidos y envío el formulario','se crea la cuenta con ese rol público y se inicia la sesión.'),
       ('que ingreso una contraseña sin al menos 8 caracteres, una mayúscula y un número','envío el registro','se rechaza el registro y no se crea la cuenta.'),
       ('que el correo ya está registrado','envío el formulario','no se crea otra cuenta con el mismo correo y se informa el problema.'),
       ('que el registro e inicio de sesión terminan correctamente','se abre mi destino','Donador llega a Mi Panel y Emprendedor a Mi Perfil para completar sus datos.'),
   ],limites='El registro público no ofrece los roles Administrador ni Superadministrador. Google no está disponible.')

hu('HU-C02',C,'Iniciar sesión por correo','acceder a mi cuenta con correo y contraseña','utilizar las funciones de mi rol',
   'Iniciar Sesión.','C02',[
       ('que mi cuenta está activa y las credenciales son correctas','envío el formulario','se abre una sesión con los roles y nivel administrativo de mi cuenta.'),
       ('que soy Donador o Emprendedor y llegué desde una página privada','inicio sesión correctamente','regreso a la ruta solicitada; sin una ruta previa se abre Mi Panel o Mi Perfil según el rol.'),
       ('que tengo nivel administrativo','inicio sesión','Administrador llega a /admin y Superadministrador a /superadmin.'),
       ('que las credenciales son incorrectas o la cuenta está inactiva','intento ingresar','no obtengo una sesión válida y se informa el error.'),
       ('que marco Recordarme','inicio sesión y vuelvo luego al formulario','se conserva el correo; desmarcarlo retira el correo recordado.'),
   ],limites='Recordarme no se documenta como una promesa de sesión indefinida.')

hu('HU-C03',C,'Cerrar sesión','finalizar mi acceso','impedir que se siga usando mi sesión desde el navegador',
   'Salir; Cerrar Sesión del panel administrativo; Configuración → Cerrar sesión.','C07',[
       ('que tengo una sesión abierta','pulso Salir o Cerrar Sesión en el menú correspondiente','se cierra el acceso local y vuelvo a Iniciar Sesión.'),
       ('que uso Cerrar sesión desde Configuración','cancelo la confirmación','la sesión continúa abierta.'),
       ('que uso Cerrar sesión desde Configuración','confirmo la operación','se ejecuta el cierre de sesión.'),
       ('que ya cerré sesión','intento volver a una ruta privada','se solicita iniciar sesión nuevamente.'),
   ])

hu('HU-C04',C,'Cambiar la contraseña local','actualizar mi contraseña','proteger el acceso a mi cuenta',
   'Configuración → Seguridad y Acceso.','C06',[
       ('que mi cuenta tiene contraseña local','ingreso la actual, una nueva válida y su confirmación y pulso Actualizar contraseña','la nueva contraseña sustituye a la anterior.'),
       ('que la actual es incorrecta, la confirmación no coincide o la nueva incumple los requisitos','intento guardar','la contraseña no cambia y se presenta el error correspondiente.'),
       ('que la nueva contraseña coincide con la actual','envío el cambio','el cambio se rechaza.'),
       ('que el cambio se completa','continúo utilizando la aplicación','mi sesión actual sigue abierta y las demás sesiones se revocan.'),
       ('que la cuenta no tiene contraseña local','consulto la sección','no se ofrece el formulario de cambio; Google no se considera una alternativa operativa mientras siga no disponible.'),
   ])

hu('HU-C05',C,'Contactar al emprendedor','iniciar una conversación vinculada a una campaña','consultar dudas al responsable del proyecto',
   'Historia y Proyecto → Sobre el Emprendedor → Contactar Emprendedor.','C03',[
       ('que el creador es otra persona y tengo sesión','pulso Contactar Emprendedor','se abre o recupera la conversación asociada al destinatario y campaña.'),
       ('que aún no inicié sesión','pulso Contactar Emprendedor','se abre Iniciar Sesión; después puedo regresar y volver a usar el contacto.'),
       ('que soy el creador de la campaña','consulto Sobre el Emprendedor','no se ofrece abrir una conversación conmigo mismo.'),
   ],limites='No hay buscador general de usuarios para iniciar chats. Enviar Mensaje desde la ficha de un donador solo anuncia una función futura.')

hu('HU-C06',C,'Continuar conversaciones','leer el historial y enviar mensajes','mantener comunicación con otros participantes',
   'Barra superior → Mensajes.','C03',[
       ('que tengo conversaciones','selecciono una en Mensajes','veo su historial y destinatario; no accedo a conversaciones ajenas.'),
       ('que hay mensajes anteriores','subo por la conversación o uso Ver mensajes anteriores cuando aparece','se carga el historial anterior sin duplicar mensajes ya mostrados.'),
       ('que escribí texto no vacío','uso el icono Enviar mensaje o Enter','el mensaje se envía y se incorpora a la conversación.'),
       ('que el envío falla','consulto el chat','se informa que no se pudo enviar y puedo intentar de nuevo; el fallo no se presenta como entrega confirmada.'),
   ],limites='No se incluyen adjuntos, eliminación ni edición de mensajes porque no forman parte de este recorrido web.')

hu('HU-C07',C,'Consultar notificaciones','revisar los avisos de mi cuenta','conocer eventos relevantes y abrir sus destinos',
   'Campana → centro de notificaciones.','C04',[
       ('que tengo avisos','abro la campana o el centro','solo veo notificaciones de mi cuenta y el indicador de no leídas.'),
       ('que uso búsqueda, categoría o estado','cambio los filtros y recorro las páginas','se muestran los avisos coincidentes.'),
       ('que abro una notificación no leída','se registra su lectura','queda leída; si tiene un destino asociado, se navega a ese destino.'),
       ('que no hay coincidencias','consulto los resultados','se informa la ausencia de notificaciones y Restablecer filtros permite quitar las selecciones.'),
   ])

hu('HU-C08',C,'Gestionar notificaciones','marcar o retirar avisos','mantener organizado mi centro de notificaciones',
   'Campana o centro de notificaciones.','C04',[
       ('que tengo notificaciones sin leer','uso la opción de marcar todas como leídas','las notificaciones existentes de mi cuenta quedan leídas y se actualiza el contador.'),
       ('que elimino una notificación','la operación termina correctamente','ese aviso desaparece sin modificar los de otras cuentas.'),
       ('que hay avisos leídos y no leídos','uso la opción de limpiar las leídas','se retiran solo los leídos; los no leídos permanecen.'),
       ('que gestiono avisos desde la campana','regreso al centro','ambas vistas reflejan los avisos y contadores actualizados tras una operación correcta.'),
   ])

hu('HU-C09',C,'Configurar preferencias de notificación','elegir los avisos que recibo','ajustar las alertas a mis intereses',
   'Centro de notificaciones → Preferencias.','C05',[
       ('que mis preferencias se cargan correctamente','abro Preferencias','veo sus valores actuales y puedo cambiar los interruptores disponibles.'),
       ('que modifiqué las preferencias','guardo correctamente','se conservan los nuevos valores, se muestra confirmación y el diálogo se cierra.'),
       ('que no se pudieron cargar las preferencias','abro el diálogo','no puedo guardar valores de reemplazo sin haber cargado la configuración.'),
       ('que desactivo avisos dentro de la aplicación o una categoría','ocurre un evento posterior cubierto por esa preferencia','la generación del aviso respeta la selección; los avisos previos no se borran por cambiar preferencias.'),
   ],estado='Parcial',limites='Guardar el interruptor Notificaciones por correo no acredita entrega real de emails. El envío por correo es una capacidad pendiente separada en HU-P14.',dependencias=('HU-P14',),fuentes=('web/app/Services/Notifier.php',))

hu('HU-C10',C,'Publicar comentarios','comentar una campaña','participar en la conversación sobre el proyecto',
   'Ficha → Comentarios, cuarta pestaña principal a la derecha de Hitos y Avances.','C09',[
       ('que no veo Comentarios en el ancho de la barra','la desplazo horizontalmente a la derecha','puedo seleccionar esa pestaña y leer sus comentarios sin iniciar sesión.'),
       ('que tengo sesión de Donador o Emprendedor y la campaña admite participación','escribo en Escribe un comentario... y uso el icono de enviar','se registra el comentario en esa campaña y aparece en la lista.'),
       ('que el texto está vacío o solo contiene espacios','consulto el control de envío','no puedo publicarlo; el cuadro web limita la entrada a 2000 caracteres.'),
       ('que no tengo sesión','intento escribir o uso Inicia sesión','se solicita autenticación antes de publicar.'),
       ('que la campaña está cerrada y se conserva públicamente','abro Comentarios','los comentarios se consultan, pero no se muestra el cuadro para publicar.'),
   ])

hu('HU-C11',C,'Marcar Me gusta en comentarios','expresar mi apoyo a un comentario','participar sin redactar una nueva intervención',
   'Ficha → Comentarios → icono de pulgar arriba.','C09',[
       ('que tengo sesión de Donador o Emprendedor y la campaña permite participar','pulso el pulgar arriba de un comentario','se registra mi Me gusta y se actualiza su contador.'),
       ('que ya marqué Me gusta','pulso de nuevo el mismo control','se retira mi marca y se ajusta el contador, sin acumular varias marcas mías.'),
       ('que no tengo sesión','intento marcar Me gusta','se solicita iniciar sesión.'),
       ('que la campaña está cerrada','consulto los comentarios','el control de Me gusta está deshabilitado.'),
   ])

hu('HU-C12',C,'Consultar la configuración de mi cuenta','ver mi información de acceso y sus opciones','conocer el estado de mi cuenta',
   'Barra superior → Configuración → Configuración de Cuenta.','C06 C07',[
       ('que tengo una sesión válida','abro Configuración de Cuenta','veo mi correo, su indicador Verificado o Sin verificar y Último acceso según los datos disponibles.'),
       ('que soy Donador o Emprendedor','selecciono Perfil de Donador o Perfil de Emprendedor en Mi Perfil','se abre el perfil correspondiente a ese rol.'),
       ('que consulto Seguridad y Acceso y Zona de Peligro','elijo una acción disponible','puedo ir al cambio de contraseña local o al cierre de sesión descritos en sus historias, sin confundir el indicador de correo con una verificación ejecutada.'),
   ],limites='No hay una acción web para verificar el correo; el indicador es informativo. El futuro proceso se especifica en HU-P17.',dependencias=('HU-P17',))

hu('HU-D01',D,'Crear y editar mi perfil','completar mis datos personales y preferencias','identificarme y preparar mi participación como donador',
   'Mi Perfil → edición por secciones.','D01',[
       ('que aún no tengo perfil','abro Mi Perfil','se propone completar los datos básicos.'),
       ('que introduzco datos válidos en una sección y guardo','vuelvo a consultar el perfil','veo los datos guardados en la sección correspondiente.'),
       ('que consulto las pestañas del perfil','selecciono Donaciones, Información o Capital / Fondos','se muestra el contenido correspondiente.'),
       ('que tengo aportes registrados','intento establecer un capital máximo inferior al total invertido','el cambio se rechaza y no reduce el capital por debajo de lo ya aportado.'),
   ],limites='Las secciones se editan con los accesos disponibles del perfil; no hay eliminación de perfil desde la web.')

hu('HU-D02',D,'Personalizar mis imágenes','cambiar mi foto y portada','reconocer y personalizar mi perfil',
   'Mi Perfil → controles de foto y portada.','D01',[
       ('que tengo perfil y sesión','selecciono una imagen permitida para la foto','la carga correcta actualiza mi avatar.'),
       ('que selecciono una imagen permitida para la portada','la carga termina correctamente','se actualiza la portada del perfil.'),
       ('que cancelo la selección de archivo','regreso al perfil','la imagen anterior permanece.'),
       ('que selecciono un archivo para foto o portada','se valida la carga','se admiten JPG/JPEG, PNG, WEBP o AVIF de hasta 10 MB; los formatos o tamaños no admitidos no sustituyen la imagen guardada.'),
   ])

hu('HU-D03',D,'Consultar y aumentar mi capital simulado','ver y aumentar mi saldo disponible','disponer de capital para nuevos aportes de prueba',
   'Mi Panel → Capital Disponible → Aumentar Capital.','D02',[
       ('que tengo un perfil con capital configurado','abro Mi Panel','veo Capital Disponible, Total Donado y el número de donaciones, junto a Aumentar Capital.'),
       ('que quiero agregar capital','abro el diálogo','puedo elegir un monto sugerido o ingresar uno y añadir notas opcionales.'),
       ('que el monto es menor a Bs. 100','consulto el control de confirmación','no puedo enviar el aumento desde el formulario web.'),
       ('que envío un monto válido y se confirma la operación','vuelvo al panel','aumentan el capital configurado y el disponible por ese monto, sin crear una donación a una campaña.'),
   ],limites='Son movimientos de saldo simulado: no hay cobro a tarjetas ni transferencia bancaria real.')

hu('HU-D04',D,'Donar a una campaña','confirmar un aporte a un proyecto','contribuir a su meta de financiamiento',
   'Ficha → monto → Donar Bs. [monto] → Confirmar Aporte.','D03',[
       ('que tengo rol Donador, perfil y saldo suficiente y la campaña acepta aportes','ingreso un monto permitido y abro la confirmación','veo la campaña, el monto y la recompensa seleccionada, si la hay.'),
       ('que confirmo un aporte válido','la operación termina correctamente','se registra el aporte y se actualizan la recaudación y mi saldo simulado por el mismo importe.'),
       ('que cancelo Confirmar Aporte','vuelvo al formulario','no se registra el aporte ni se descuenta saldo.'),
       ('que falta saldo, el monto incumple límites o supera lo que falta para la meta','confirmo','el aporte se rechaza sin un descuento parcial de saldo.'),
       ('que la campaña venció, alcanzó la meta o ya no admite aportes','consulto su ficha','el aporte no está habilitado; tampoco puedo aportar a mi propia campaña.'),
       ('que no inicié sesión','pulso Iniciar Sesión para Donar','se abre el login en vez de registrar un aporte.'),
   ])

hu('HU-D05',D,'Elegir una recompensa al aportar','seleccionar un nivel de recompensa compatible con mi monto','conocer el beneficio asociado a mi aporte',
   'Historia y Proyecto → Niveles de Recompensa; formulario de aporte.','D03 D07',[
       ('que la campaña tiene niveles disponibles','selecciono uno','la selección y el monto sugerido se reflejan en el formulario.'),
       ('que el monto cumple el rango y la recompensa sigue vigente y con cupo','confirmo el aporte','queda asociada exactamente la recompensa seleccionada, sin sustituirla por otra.'),
       ('que la recompensa vence, se agota o deja de cumplir condiciones antes de confirmar','intento aportar','se rechaza la operación y puedo ajustar el monto o cambiar la selección.'),
       ('que prefiero contribuir sin beneficio','uso Aportar sin recompensa','se retira la selección y el aporte puede confirmarse sin generar una recompensa.'),
   ])

hu('HU-D06',D,'Consultar Mis Aportes','buscar y organizar mis donaciones','conocer el destino y estado de mis contribuciones',
   'Mi Panel → Mis Aportes.','D04',[
       ('que tengo aportes','abro Mis Aportes','veo sus campañas, fechas, montos y estados.'),
       ('que uso la búsqueda por campaña y Todos, Completados o Pendientes','se aplican los controles','se muestran únicamente los aportes coincidentes.'),
       ('que elijo Más recientes, Más antiguas, Mayor monto aportado, Menor monto aportado o Alfabético','consulto la lista','se respeta el orden elegido.'),
       ('que selecciono Ver Proyecto','la campaña conserva acceso público','se abre su ficha; Recibo solo se ofrece en aportes completados.'),
   ])

hu('HU-D07',D,'Descargar mis comprobantes','obtener un PDF de mis aportes completados','conservar una constancia de la contribución',
   'Mi Panel → Comprobantes; también Recibo de Mis Aportes o confirmación del aporte.','D05',[
       ('que tengo aportes completados','abro Comprobantes','se listan solo esos aportes y puedo buscarlos por proyecto o código de recibo.'),
       ('que selecciono Descargar PDF de un aporte propio','se genera el archivo','el navegador recibe el comprobante de ese aporte.'),
       ('que falla la generación','intento descargar','se muestra un error y puedo intentar la descarga nuevamente.'),
       ('que intento obtener un comprobante ajeno','solicito el archivo','no se permite la descarga.'),
   ],limites='Una descarga técnica no se presenta como certificación de validez tributaria. Los reembolsados no se listan en la pestaña Comprobantes.')

hu('HU-D08',D,'Consultar novedades de proyectos apoyados','ver publicaciones de las campañas que respaldé','seguir el uso y avance de mis contribuciones',
   'Mi Panel → Novedades.','D06',[
       ('que apoyé campañas con publicaciones públicas','abro Novedades','veo las actualizaciones de mis proyectos apoyados, sin mezclar publicaciones de campañas no respaldadas.'),
       ('que selecciono una campaña en el filtro','consulto la lista','veo solo sus novedades.'),
       ('que existen varias páginas','uso Anterior o Siguiente','navego dentro de las páginas válidas.'),
       ('que pulso Ver Campaña','se abre el proyecto','puedo continuar en Hitos y Avances; la ausencia de novedades y los errores de carga tienen estados distintos.'),
   ])

hu('HU-D09',D,'Seguir mis recompensas','consultar la preparación y entrega de mis beneficios','conocer el estado de cada recompensa',
   'Mi Panel → Recompensas.','D07',[
       ('que tengo aportes con recompensa','abro Recompensas','veo las recompensas asociadas a mis contribuciones, no las de otras personas.'),
       ('que busco por recompensa o proyecto o elijo un estado','consulto los resultados','se muestran solo las coincidencias.'),
       ('que el emprendedor actualizó el seguimiento','consulto la recompensa','se refleja el estado registrado; una cancelada o sin seguimiento no se presenta como entregada.'),
       ('que hay un enlace de seguimiento válido','lo selecciono','se abre su destino; no se inventa un enlace cuando falta.'),
   ],limites='El donador consulta el estado. No hay un formulario web para reportar incidencias o confirmar recepción.')

hu('HU-D10',D,'Consultar rendimiento y reembolsos','ver estadísticas e identificar devoluciones','entender mi actividad como donador',
   'Mi Panel → Rendimiento; Mis Aportes y Capital Disponible.','D08',[
       ('que tengo alguna donación completada','abro Rendimiento','veo aporte promedio, monto reembolsado y evolución acumulada según mis registros.'),
       ('que no tengo donaciones completadas','abro Rendimiento','se muestra el estado inicial en lugar de un gráfico de actividad inexistente.'),
       ('que una campaña finalizó sin alcanzar la meta y mis aportes fueron reembolsados','consulto Mis Aportes y Mi Panel','puedo identificar el estado reembolsado y el saldo simulado devuelto.'),
       ('que todos mis aportes fueron reembolsados','Rendimiento muestra el estado inicial','sigo pudiendo comprobar las devoluciones en Mis Aportes y el capital disponible.'),
   ],limites='No hay solicitud manual de reembolso. La devolución por falta de meta ocurre al ejecutar la finalización, no solo al vencer la fecha.')

hu('HU-E01',E,'Completar mi perfil de emprendedor','guardar mis datos y los del proyecto','presentarme ante los donadores y preparar una campaña',
   'Mi Perfil → edición por secciones; Información y Datos Bancarios.','E01',[
       ('que no tengo perfil','abro Mi Perfil y completo los datos válidos','puedo guardar el perfil de emprendedor.'),
       ('que edito biografía, LinkedIn, empresa, sitio web, ubicación o datos bancarios','guardo una sección correctamente','se conservan sus datos sin sustituir los de las demás secciones.'),
       ('que consulto Información o Datos Bancarios','selecciono la pestaña','veo los datos disponibles; Datos Bancarios ofrece su acceso Editar.'),
       ('que faltan campos del perfil','consulto el indicador de avance','puedo continuar completándolos; ese indicador no sustituye la aprobación de identidad.'),
   ])

hu('HU-E02',E,'Actualizar mis imágenes','cambiar foto y portada del perfil','dar una identidad visual al proyecto',
   'Mi Perfil → controles de foto y portada.','E01',[
       ('que tengo perfil','cargo una foto permitida correctamente','se actualiza mi avatar.'),
       ('que cargo una portada permitida correctamente','vuelvo a consultar el perfil','se presenta la nueva portada.'),
       ('que cancelo la selección','regreso al perfil','se mantiene la imagen anterior.'),
       ('que selecciono un archivo para foto o portada','se valida la carga','se admiten JPG/JPEG, PNG, WEBP o AVIF de hasta 10 MB; una carga rechazada no sustituye la imagen guardada.'),
   ])

hu('HU-E03',E,'Solicitar verificación de identidad','enviar documento y validación facial','acreditar mi identidad antes de crear campañas',
   'Mi Perfil → Iniciar Verificación; Mis Campañas → Verificar Identidad o Reintentar KYC.','E02',[
       ('que tengo perfil y no hay solicitud pendiente','abro la verificación','puedo adjuntar el documento y avanzar con Siguiente a la validación facial.'),
       ('que adjunto el documento','se comprueba el archivo','se admiten PDF, JPG/JPEG, PNG o WEBP de hasta 10 MB; otros tipos o tamaños se rechazan.'),
       ('que completo la validación facial','tomo una foto con la cámara o adjunto archivo','se admiten JPG/JPEG, PNG, WEBP, MP4, WEBM o MOV de hasta 50 MB; si falla la cámara puedo seleccionar un archivo.'),
       ('que ambos archivos son válidos','pulso Enviar a Revisión y se confirma el envío','la identidad queda pendiente y no se considera aprobada hasta la decisión administrativa.'),
       ('que la solicitud fue rechazada','consulto el motivo y uso Reintentar KYC o Iniciar Verificación','puedo reenviar documentos; una solicitud todavía pendiente no se reenvía como nueva.'),
   ],limites='KYC significa verificación de identidad. Los documentos de identidad no son evidencias públicas de la campaña.')

hu('HU-E04',E,'Conocer los requisitos para crear una campaña','completar los requisitos de perfil e identidad','poder iniciar la recaudación con mis datos preparados',
   'Mi Perfil; Mis Campañas → Lanzar Campaña.','E01 E02 E03',[
       ('que intento crear una campaña','se comprueba mi elegibilidad','se exige perfil, biografía de al menos 30 caracteres, empresa o proyecto de al menos 2, sitio web y LinkedIn válidos, país e identidad verificada.'),
       ('que mi identidad no está verificada','uso el acceso de creación que solicita KYC','se me dirige a verificarla antes de completar el proceso.'),
       ('que cumplo los requisitos','abro la creación','puedo completar el formulario de campaña; el registro por sí solo no implica elegibilidad.'),
   ])

hu('HU-E05',E,'Crear un borrador de campaña','guardar la propuesta antes de enviarla','preparar la información y revisar su contenido',
   'Mis Campañas → Lanzar Campaña → Guardar Borrador.','E03',[
       ('que cumplo los requisitos de creación','completo los datos válidos y confirmo Guardar Borrador','se crea una campaña propia en estado Borrador.'),
       ('que completo el formulario','se validan sus datos','el título admite 5–50 caracteres, el eslogan 10–50, la descripción 50–800, la meta es al menos Bs. 100 y hay al menos una categoría.'),
       ('que indico fecha y video','se validan los campos','la fecha debe ser futura y el video opcional debe corresponder a YouTube o TikTok; la fecha puede omitirse para guardar borrador.'),
       ('que no añadí respaldo a la lista de documentos','intento guardar','el formulario bloquea la continuación y solicita al menos un documento.'),
       ('que el borrador quedó creado','abro Vista Previa','puedo comprobar sus datos, portada y documentos antes de enviarlo.'),
   ],estado='Parcial',limites='La creación y las cargas de archivos son operaciones separadas. Puede existir borrador aunque falle una carga posterior; no se acepta como garantía actual que todo se haya cargado. El manejo integral de fallos se define en HU-P12.',dependencias=('HU-P12',))

hu('HU-E06',E,'Definir niveles de recompensa','agregar beneficios y rangos de aporte','ofrecer incentivos comprensibles a los donadores',
   'Formulario de campaña → Estructura de Recompensas → Agregar Nivel.','E03 E06 E08',[
       ('que estoy en el formulario de una campaña editable','uso Agregar Nivel y completo título, descripción y porcentajes válidos','el nivel se incorpora a la lista del formulario.'),
       ('que ya agregué un nivel','uso Editar Nivel o Eliminar Nivel','puedo modificar o quitar esa definición antes de guardar la campaña.'),
       ('que guardo correctamente la campaña','vuelvo a consultar sus niveles','se conservan las definiciones guardadas.'),
       ('que consulto Recompensas desde Vista Previa','se muestran niveles existentes','su definición es de solo lectura en esa pestaña; el selector de entregas es una operación diferente.'),
       ('que ingreso un mínimo menor que 0, un máximo mayor que 100 o un mínimo mayor o igual al máximo','intento añadir o actualizar el nivel en el formulario','se rechaza el rango y el nivel no se incorpora con esos porcentajes.'),
   ],limites='Los primeros niveles se crean desde el formulario: la pestaña Recompensas de Vista Previa aparece cuando ya existen niveles. No se promete un botón para desactivar niveles desde esa vista.')

hu('HU-E07',E,'Adjuntar y consultar respaldo de campaña','añadir archivos con justificación','presentar evidencias para la revisión del proyecto',
   'Formulario → Añadir Documento; Vista Previa → Documentación.','E03 E06',[
       ('que seleccioné un archivo y escribí su justificación','pulso Añadir Documento','el respaldo aparece en la lista pendiente de guardar.'),
       ('que falta el archivo o la justificación','pulso Añadir Documento','se solicita completar ambos datos.'),
       ('que un archivo solo está en la lista del formulario','lo retiro antes de guardar','deja de incluirse en ese envío, sin borrar un documento previamente guardado en la campaña.'),
       ('que el respaldo se cargó correctamente','abro Documentación en Vista Previa','veo su estado, observaciones disponibles y Ver Documento.'),
       ('que envío un respaldo para cargar','se valida el archivo','se admiten PDF, JPG/JPEG, PNG, WEBP, DOC o DOCX de hasta 20 MB; otros archivos no quedan guardados como respaldos válidos.'),
   ],estado='Parcial',limites='No hay un control web conectado para eliminar documentos ya guardados. Las cargas pueden fallar después de crear el borrador; comprobar la lista guardada.',dependencias=('HU-P12',))

hu('HU-E08',E,'Buscar y editar mis campañas','localizar mis proyectos y ajustar borradores o rechazos','mantener la propuesta antes de su publicación',
   'Mis Campañas → búsqueda, pestañas de estado, Vista Previa → Editar.','E06',[
       ('que tengo campañas cargadas en Mis Campañas','busco por título o elijo una pestaña de estado','se filtran las campañas de la lista cargada.'),
       ('que alterno los iconos de tarjetas y lista','consulto mis proyectos','cambia la presentación sin cambiar su estado.'),
       ('que una campaña propia está en Borrador o Rechazada','abro Vista Previa y Editar','puedo modificar sus datos y guardar con el respaldo requerido.'),
       ('que una campaña está aprobada, publicada o en otro estado no editable','consulto Vista Previa','no puedo editarla mediante el formulario de borrador.'),
       ('que prefiero abandonar el formulario','uso Descartar y confirmo','salgo sin guardar las modificaciones de ese formulario.'),
   ],estado='Parcial',limites='Mis Campañas no muestra controles de orden ni paginación y filtra solo lo cargado. La navegación completa de todas las campañas se reserva a HU-P06.',dependencias=('HU-P06',))

hu('HU-E09',E,'Enviar una campaña a revisión','presentar mi borrador o propuesta corregida','obtener una decisión administrativa antes de publicarla',
   'Mis Campañas → Vista Previa → Enviar Revisión; en Mi Perfil, formulario → Enviar a Revisión.','E04',[
       ('que la campaña propia está en Borrador o Rechazada','pulso Enviar Revisión en Vista Previa y se acepta','queda pendiente de revisión y se incorpora al historial de estados.'),
       ('que creo o edito desde Mi Perfil → Campañas','uso el botón Enviar a Revisión del formulario y termina correctamente','se guardan los datos y se envía la campaña a revisión.'),
       ('que utilizo el formulario abierto desde Mis Campañas','consulto sus acciones','guardo primero con Guardar Borrador y envío después desde la tarjeta o Vista Previa.'),
       ('que la campaña sigue pendiente o fue rechazada','consulto el resultado','espero la decisión si está pendiente; si fue rechazada, puedo leer el motivo, editar y reenviar.'),
   ],limites='La tarjeta ofrece envío directo en Borrador; Vista Previa también permite reenviar Rechazada. Aprobar y publicar son pasos diferentes.')

hu('HU-E10',E,'Publicar una campaña aprobada','lanzar mi campaña autorizada','hacerla visible y permitir aportes mientras esté vigente',
   'Campaña Aprobada → Publicar Campaña en tarjeta, o Vista Previa → Lanzar.','E05',[
       ('que mi campaña está Aprobada, tengo KYC aprobado y fecha de cierre futura','pulso Publicar Campaña o Lanzar y se acepta','la campaña pasa a Publicada y puede aparecer en Explorar.'),
       ('que la campaña solo está aprobada pero no la lancé','consulto su estado','no se considera publicada automáticamente por la aprobación.'),
       ('que el KYC ya no cumple la aprobación o la fecha no es futura','intento publicar','se rechaza el lanzamiento.'),
   ],estado='Parcial',limites='La edición está bloqueada en Aprobada. Si la fecha venció, no existe un recorrido web completo para corregirla en ese estado; se registra en HU-P07.',dependencias=('HU-P07',))

hu('HU-E11',E,'Consultar resultados y donadores','revisar el progreso económico y quiénes apoyan mi campaña','dar seguimiento a la recaudación',
   'Vista Previa → Progreso Económico / Donadores Activos; Mi Perfil → Finanzas.','E07',[
       ('que la campaña está Publicada o Financiada','abro Progreso Económico','consulto recaudación, evolución y desglose; cualquier proyección se interpreta como estimación.'),
       ('que existen donadores con aportes completados','abro Donadores Activos','veo la lista y puedo recorrer sus páginas y abrir una ficha.'),
       ('que abro la ficha de un donador','consulto su contenido','veo los datos que ofrece el sistema; Enviar Mensaje no se considera una conversación disponible.'),
       ('que estoy en Mi Perfil → Finanzas','selecciono una de mis campañas','se consultan sus métricas en esa sección.'),
   ],limites='La disponibilidad de pestañas de Vista Previa depende del estado. La mensajería desde la ficha de un donador se define como pendiente en HU-P05.')

hu('HU-E12',E,'Actualizar el seguimiento de recompensas','registrar el avance de una entrega','informar al donador del estado de su beneficio',
   'Vista Previa → Recompensas → Donadores con Recompensas.','E08',[
       ('que la campaña propia tiene niveles y reclamos','despliego Donadores con Recompensas','veo donador, recompensa, monto y estado de cada registro.'),
       ('que una entrega permite cambios','abro su selector','solo se ofrecen sus transiciones permitidas: pendiente a preparación, preparación a enviada, enviada a entregada, o cancelación cuando esté habilitada.'),
       ('que elijo una transición válida','se guarda','el donador puede consultar el estado actualizado desde Recompensas de Mi Panel.'),
       ('que la entrega está entregada o cancelada, o el aporte fue reembolsado','consulto el registro','no puedo cambiar su estado ni reactivarla.'),
       ('que falla una actualización','se muestra el error','no se confirma falsamente el cambio y la lista intenta recuperar el estado vigente.'),
   ],limites='La pantalla actual cambia el estado; no ofrece campos para introducir un número o una URL de seguimiento.')

hu('HU-E13',E,'Publicar novedades','compartir texto, imágenes o videos sobre mi campaña','mantener informados a quienes la siguen o apoyan',
   'Mis Campañas → campaña Publicada → Publicar Novedad.','E09',[
       ('que mi campaña está Publicada','pulso Publicar Novedad','se abre el formulario de publicación.'),
       ('que completo título de al menos 3 caracteres y contenido de al menos 10','selecciono texto y pulso Publicar','una operación correcta crea una novedad pública de esa campaña.'),
       ('que selecciono imagen o video','intento publicar','debo adjuntar el archivo del tipo elegido; sin archivo el formulario solicita completarlo.'),
       ('que se confirmó la publicación','consulto Hitos y Avances o Bitácora','puedo ver la novedad; los donadores vinculados pueden verla en Mi Panel → Novedades.'),
   ],limites='La acción de la tarjeta aparece en Publicada. Las novedades públicas recientes pueden aparecer en historias; no se promete edición o borrado de publicaciones desde la web.')

hu('HU-E14',E,'Finalizar una campaña publicada','cerrar una campaña publicada','gestionar su resultado y las devoluciones que correspondan',
   'Mis Campañas → tarjeta Publicada → Finalizar Campaña.','E10',[
       ('que mi tarjeta está Publicada','pulso Finalizar Campaña y confirmo','se procesa la finalización y se actualizan estado e historial.'),
       ('que finalizo sin alcanzar la meta','se completa la operación','la campaña queda Fallida, los aportes completados se reembolsan al saldo simulado y sus recompensas quedan canceladas.'),
       ('que cancelo la confirmación de finalización','vuelvo a la tarjeta','no se realiza la operación.'),
   ],estado='Parcial',limites='Finalizar Campaña solo aparece en Publicada. Financiada y Parcialmente financiada no tienen esa acción en la tarjeta, aunque el servidor admita su finalización. Vencer la fecha no finaliza ni reembolsa automáticamente.',dependencias=('HU-P07',))

hu('HU-E15',E,'Eliminar borradores o campañas rechazadas','retirar propuestas que no voy a continuar','mantener organizados mis proyectos sin borrar registros con actividad financiera',
   'Mis Campañas → Borrador/Rechazada → Eliminar Campaña o menú Eliminar.','E11',[
       ('que mi campaña es Borrador o Rechazada y no tiene aportes ni movimientos con trazabilidad','confirmo su eliminación','deja de aparecer en la lista.'),
       ('que existen aportes o movimientos con trazabilidad','intento eliminar','la eliminación se bloquea y se conserva la campaña.'),
       ('que cancelo la confirmación','vuelvo a la tarjeta','no se realiza la eliminación.'),
       ('que la campaña no está en Borrador o Rechazada','consulto sus acciones como propietario','no se ofrece esta eliminación de propuesta desde la tarjeta.'),
   ])

hu('HU-A01',A,'Consultar el panel de estadísticas','ver los indicadores y las tareas administrativas','priorizar las gestiones del sistema',
   'Panel administrativo → Estadísticas.','A01',[
       ('que tengo rol Administrador o Superadministrador','abro Estadísticas','consulto los indicadores disponibles de usuarios, campañas y pendientes.'),
       ('que selecciono un acceso de gestión','se abre su destino','puedo ir a Usuarios, Campañas, Verificación KYC, Revisión o Auditoría según el acceso elegido.'),
       ('que no tengo un rol administrativo','intento consultar los datos administrativos','el servicio rechaza el acceso aunque conozca la dirección de la pantalla.'),
   ])

hu('HU-A02',A,'Consultar y suspender usuarios','buscar cuentas y desactivar accesos','administrar los participantes de la plataforma',
   'Gestión de Usuarios.','A02',[
       ('que tengo permisos administrativos','busco por correo','la lista muestra usuarios coincidentes con su correo, identificador abreviado, Fecha de Registro y estado Activo o Suspendido.'),
       ('que selecciono la suspensión de una cuenta permitida y confirmo','la operación termina correctamente','la cuenta queda inactiva y no puede iniciar sesión.'),
       ('que cancelo la confirmación','regreso al listado','la cuenta conserva su estado.'),
       ('que intento suspender mi propia cuenta o un superadministrador','solicito la operación','se bloquea la suspensión.'),
   ],limites='No hay opción de reactivación desde esta pantalla; se trata como pendiente en HU-P04.')

hu('HU-A03',A,'Consultar y eliminar campañas sin actividad financiera','buscar proyectos y consultar su detalle','supervisar el catálogo y retirar registros que pueden eliminarse',
   'Gestión de Campañas.','A06',[
       ('que tengo permisos administrativos','busco por título, creador o correo y selecciono un estado','se filtra el listado y Actualizar permite recargarlo.'),
       ('que abro Vista Previa','carga el detalle','puedo consultar datos, historial, documentos y las pestañas habilitadas.'),
       ('que confirmo eliminar una campaña sin aportes ni movimientos con trazabilidad','la operación termina correctamente','se elimina del listado.'),
       ('que hay aportes o movimientos con trazabilidad','intento eliminar','se bloquea la operación.'),
   ],estado='Parcial',limites='Los botones de aprobación que puedan aparecer aquí no tienen sus acciones conectadas. Para decidir se usa Revisión de Campañas; la unificación de esos controles se especifica en HU-P11.',dependencias=('HU-P11',))

hu('HU-A04',A,'Aprobar o rechazar solicitudes de campaña','evaluar propuestas pendientes','autorizar o devolver proyectos antes de su publicación',
   'Revisión de Campañas.','A03',[
       ('que hay campañas pendientes','busco por título o emprendedor y recorro las páginas','se muestran las solicitudes pendientes coincidentes.'),
       ('que abro una solicitud','consulto su detalle','puedo revisar propuesta, propietario, documentos e historial antes de decidir.'),
       ('que apruebo desde el detalle o confirmo la aprobación rápida','se registra la decisión','la campaña queda Aprobada; todavía requiere que el emprendedor la publique.'),
       ('que rechazo una campaña','escribo un motivo y confirmo la decisión','queda Rechazada y el emprendedor puede consultar el motivo, corregir y reenviar.'),
       ('que no introduje motivo para rechazar','intento la acción','la interfaz no permite completar el rechazo.'),
   ],limites='El listado solicita pendientes; no ofrece filtro para incluir En revisión ni otros estados.')

hu('HU-A05',A,'Revisar solicitudes KYC','comprobar identidad y validación facial','decidir qué emprendedores quedan verificados',
   'Verificaciones KYC → Revisar.','A04',[
       ('que hay una solicitud pendiente','pulso Revisar','puedo consultar los datos, el documento de identidad y la validación facial autorizados para revisión.'),
       ('que un enlace venció o el navegador no muestra el formato','uso renovación o descarga permitida','puedo intentar recuperar el archivo desde la pantalla sin hacerlo público.'),
       ('que apruebo la identidad y acepto la confirmación','se guarda la revisión','el perfil queda verificado y la solicitud deja de estar pendiente.'),
       ('que rechazo con un motivo','se guarda la revisión','el perfil queda rechazado y puede volver a enviar documentos.'),
       ('que la solicitud ya no está pendiente','intento revisarla otra vez','se impide decidir sobre una solicitud desactualizada y debo actualizar la lista.'),
   ])

hu('HU-A06',A,'Revisar documentos de campaña','aprobar o rechazar respaldos pendientes','evaluar la documentación de cada proyecto',
   'Detalle administrativo → Documentación → Ver Documento.','A05',[
       ('que abro Documentación','selecciono Ver Documento','se abre el archivo autorizado y puedo consultar su justificación.'),
       ('que el documento está pendiente','consulto sus acciones','aparecen Aprobar y Rechazar.'),
       ('que apruebo un documento','se registra la decisión','su estado cambia a Aprobado sin publicarlo automáticamente.'),
       ('que rechazo un documento','escribo el motivo solicitado y confirmo','queda Rechazado con las observaciones disponibles para el emprendedor.'),
   ],limites='Aprobar o rechazar un documento es independiente de aprobar o rechazar la campaña.')

hu('HU-A07',A,'Autorizar la publicación de evidencias','elegir qué documentos aprobados se hacen públicos','publicar respaldo apto sin exponer archivos privados',
   'Documentación → Publicar evidencia / Retirar publicación.','A05',[
       ('que un documento está aprobado y su archivo existe','pulso Publicar evidencia y se guarda','queda autorizado para su consulta en Evidencias de la campaña pública.'),
       ('que un documento está publicado','pulso Retirar publicación y se guarda','deja de estar accesible por su publicación pública.'),
       ('que el documento está pendiente, rechazado o su archivo falta','intento autorizar la publicación','no se publica como evidencia válida.'),
   ])

hu('HU-A08',A,'Auditar movimientos financieros','revisar egresos e ingresos registrados','controlar la documentación y las observaciones financieras',
   'Auditoría de Gastos → Revisar.','A07',[
       ('que consulto Auditoría de Gastos','busco por concepto, factura, notas o campaña y filtro tipo, estado o comprobante','se muestran los movimientos coincidentes y puedo recorrer sus páginas.'),
       ('que pulso Revisar','carga el movimiento','veo importe, categoría, comprobante disponible e Historial de cambios y revisiones.'),
       ('que el movimiento permite revisión','elijo Aprobar / Verificado, Marcar Observado o Rechazar y pulso Confirmar Dictamen','se guarda la decisión y se actualizan lista, resumen e historial.'),
       ('que elegí Marcar Observado o Rechazar sin notas','intento confirmar','se exige una explicación y no se completa la revisión.'),
       ('que el registro cambió de versión o no admite revisión manual','intento decidir','no sobrescribo otra revisión; debo recargar o limitarme a consultar según corresponda.'),
   ],limites='No hay filtros visibles de origen o fechas. Los aportes/reembolsos automáticos y registros de origen no confirmado pueden ser solo consultables.')

hu('HU-A09',A,'Comparar presupuesto y ejecución','consultar diferencias entre plan y gastos','identificar sobregiros y gastos sin planificación',
   'Auditoría de Gastos → icono Auditar Plan de Fondos de la Campaña.','A08',[
       ('que localizo un movimiento de una campaña','pulso su icono de gráfico','se abre Auditoría Presupuestaria de la Campaña correspondiente.'),
       ('que hay plan y gastos registrados','consulto la tabla','veo categoría, Presupuestado, Ejecutado, Varianza, Comprobantes Faltantes y Estado.'),
       ('que existen gastos en categorías no planificadas','consulto el detalle','se listan en su sección separada.'),
       ('que termino la consulta','pulso Cerrar Auditoría','regreso al listado sin cambiar movimientos ni presupuesto.'),
   ],limites='Esta consulta no incluye indicadores de hitos ni crea registros financieros que no existan.')

hu('HU-S01',S,'Consultar administradores','ver las cuentas con privilegios administrativos','supervisar quién gestiona la plataforma',
   'Gestión de Admins.','S01',[
       ('que tengo nivel Superadministrador','abro Gestión de Admins','veo correo, nivel y estado de las cuentas administrativas.'),
       ('que soy solo Administrador','intento consultar la gestión de administradores','no obtengo autorización para esas operaciones.'),
       ('que soy Superadministrador','selecciono los módulos administrativos de la barra lateral','también puedo utilizar las funciones del Administrador.'),
   ])

hu('HU-S02',S,'Crear un administrador','registrar otra cuenta administrativa','delegar la gestión del sistema',
   'Gestión de Admins → Crear Administrador.','S02',[
       ('que soy Superadministrador y el correo no está registrado','ingreso correo y contraseña válida y pulso Crear Administrador','se crea una cuenta de Administrador común y aparece en el listado.'),
       ('que el correo ya existe o la contraseña incumple 8 caracteres, mayúscula y número','envío el formulario','la creación se rechaza sin duplicar cuentas.'),
       ('que consulto el formulario web','reviso sus campos','no existe un selector para crear otro Superadministrador.'),
   ],limites='Crear una cuenta no equivale a promover una cuenta existente. La creación inicial de Superadministrador es una operación local fuera del recorrido web.')

hu('HU-S03',S,'Revocar permisos administrativos','retirar los privilegios de otro administrador','mantener control sobre los accesos de gestión',
   'Gestión de Admins → Revocar.','S03',[
       ('que selecciono a un Administrador común','pulso Revocar y confirmo','se retiran sus permisos administrativos y se actualiza el listado; su cuenta de usuario se conserva.'),
       ('que cancelo la confirmación','regreso al listado','sus privilegios no cambian.'),
       ('que el destinatario soy yo o es otro Superadministrador','intento revocar','se bloquea la operación.'),
   ],limites='Revocar permisos no suspende la cuenta. La suspensión se administra desde Gestión de Usuarios.')

hu('HU-T01','Todos los roles','Respetar acceso y propiedad de los datos','utilizar solo los recursos permitidos a mi cuenta','evitar que otras personas gestionen mi información privada',
   'Funciones privadas de la web.','C02 C03 C04 D05 E06 A01 S01',[
       ('que no tengo sesión','abro una ruta privada','se solicita iniciar sesión y no se entregan sus datos privados.'),
       ('que tengo sesión sin el rol requerido','solicito una operación administrativa o de otro rol','el servicio rechaza la operación, aunque intente usar una URL conocida.'),
       ('que un recurso pertenece a otra persona','intento editar su campaña, descargar su comprobante o leer su conversación','el servicio impide la operación no autorizada.'),
       ('que tengo acceso público a una campaña','consulto sus documentos','solo accedo a evidencias publicadas, no a documentos KYC ni a archivos privados.'),
   ],fuentes=('web/routes/api.php','web/app/Http/Middleware/RequireRole.php'))

# Pendientes: sus criterios son objetivos de implementación, no afirmaciones
# de que las operaciones ya existen o hayan sido aceptadas.
hu('HU-P01',P,'Habilitar acceso con Google','acceder mediante mi cuenta de Google','tener una alternativa de autenticación',
   'Sin recorrido operativo; C08 es un aviso de indisponibilidad.','C08',[
       ('que el acceso con Google sigue no disponible','consulto la documentación o su entrada','se informa su estado sin presentar pasos de autenticación como operativos.'),
       ('que se habilite la integración','se defina el recorrido definitivo y se verifique con Google','se publican las pantallas, permisos y destinos reales de cada rol antes de aceptar esta historia.'),
       ('que la integración ya esté habilitada y el proveedor rechace o cancele el acceso','se procese la respuesta','no se crea una sesión indebida y se ofrece volver al acceso por correo.'),
   ],estado='Pendiente',limites='No disponible actualmente. El recorrido definitivo, los permisos solicitados y los destinos por rol se especificarán cuando el servicio esté habilitado.')

hu('HU-P02',P,'Habilitar el asistente IA de soporte','consultar dudas al asistente','recibir orientación sobre el uso de UniFundme',
   'Sin recorrido operativo; V07 es un aviso de indisponibilidad.','V07',[
       ('que el asistente sigue no disponible','consulto la guía','se informa que no está habilitado y no se me pide enviar consultas para recibir respuestas.'),
       ('que se habilite el servicio','se compruebe el recorrido real de envío y respuesta','se documentan sus controles y comportamiento efectivamente disponibles antes de aceptar la historia.'),
       ('que el servicio habilitado no pueda responder','se produzca el fallo','se muestra un estado comprensible sin simular una respuesta válida.'),
   ],estado='Pendiente',limites='La presencia del botón de chat no acredita funcionamiento. No incluye atención humana ni creación de tickets.')

hu('HU-P03',P,'Eliminar perfiles desde la web','retirar mi perfil cuando no tenga dependencias','dejar de mantener esos datos de participación',
   'Sin botón web disponible; E12 es un aviso de indisponibilidad.','E12',[
       ('que se implemente la opción para el perfil correspondiente','selecciono eliminar','se solicita confirmación y se diferencia eliminar perfil de eliminar la cuenta.'),
       ('que el perfil tiene campañas o aportes registrados','intento eliminarlo','se bloquea la operación con una explicación de la dependencia.'),
       ('que el perfil no tiene dependencias y confirmo','la eliminación termina correctamente','se retiran los datos del perfil y su rol asociado según la política definida, conservando la cuenta de acceso.'),
   ],estado='Pendiente',limites='Ni el perfil de donador ni el de emprendedor tienen actualmente un botón de eliminación conectado.')

hu('HU-P04',P,'Reactivar cuentas suspendidas','restablecer el acceso de una cuenta suspendida','resolver suspensiones que ya no deban mantenerse',
   'Propuesta para Gestión de Usuarios; sin acción actual.','A02',[
       ('que se defina y habilite el permiso de reactivación','un administrador autorizado abre una cuenta suspendida','puede identificar su estado y la acción correspondiente.'),
       ('que confirma una reactivación válida','se registra la operación','la cuenta vuelve a estar activa y queda trazabilidad del responsable.'),
       ('que el usuario no tiene permiso','intenta reactivar','se rechaza la operación.'),
   ],estado='Pendiente',limites='Objetivo propuesto. No hay un botón ni recorrido web actual para reactivar.')

hu('HU-P05',P,'Contactar donadores desde sus fichas','iniciar una conversación con un donador de mi campaña','coordinar dudas o entregas',
   'Propuesta para Donadores Activos → ficha; Enviar Mensaje actualmente anuncia Próximamente.','E07 C03',[
       ('que se conecte Enviar Mensaje y el destinatario participe en mi campaña','pulso la acción','se abre o recupera una conversación autorizada con ese donador.'),
       ('que el destinatario no corresponde a la campaña o no estoy autorizado','intento iniciar la conversación','se bloquea el acceso.'),
       ('que todavía no se habilita la función','consulto su acceso','se informa la indisponibilidad sin confirmar que se haya enviado un mensaje.'),
   ],estado='Pendiente')

hu('HU-P06',P,'Recorrer todas las campañas propias','navegar por la totalidad de mis proyectos','evitar que queden campañas fuera de los resultados visibles',
   'Propuesta para Mis Campañas.','E06',[
       ('que tenga más campañas que las cargadas inicialmente','se habilite la navegación de resultados','puedo llegar a todas mediante un control web identificable.'),
       ('que busque por título o filtre estado','se consulten resultados','la búsqueda cubre mis campañas completas, no solo una página ya cargada.'),
       ('que no haya coincidencias','se complete la consulta','se presenta un estado vacío distinto de un error de carga.'),
   ],estado='Pendiente',limites='Mis Campañas no muestra hoy paginación ni selector de orden; no se describen como disponibles.')

hu('HU-P07',P,'Completar la publicación y finalización según estado','disponer de acciones compatibles con el estado de mi campaña','resolver bloqueos de lanzamiento y cerrar proyectos financiados',
   'Recorridos incompletos en campaña Aprobada, Financiada y Parcialmente financiada.','E05 E10',[
       ('que la campaña aprobada tenga fecha de cierre vencida','se defina el mecanismo permitido de corrección','puedo resolver el bloqueo sin eludir la revisión ni modificar datos que requieran nueva aprobación.'),
       ('que la campaña sea Financiada o Parcialmente financiada y el cierre esté permitido','se habilite la acción web y confirmo','se finaliza con el resultado correspondiente y trazabilidad.'),
       ('que el estado actual no admita la transición','intento ejecutar la acción','se bloquea sin alterar aportes ni saldo.'),
   ],estado='Pendiente',limites='La política de corrección de una campaña Aprobada requiere definición. Que el servidor admita finalizar no basta para afirmar que existe el botón web.')

hu('HU-P08',P,'Mostrar planes e hitos respaldados por datos reales','distinguir los compromisos registrados de los ejemplos visuales','evaluar información fiable del proyecto',
   'Plan de Fondos, Hitos del Proyecto y Hitos y Avances.','V06 V02',[
       ('que una campaña no tiene un plan o hitos registrados','consulto esas secciones','se muestra ausencia de datos o un ejemplo identificado explícitamente, sin presentarlo como compromiso real.'),
       ('que existe información registrada de la campaña','la consulto','se presenta esa información y sus estados, sin sustituirla por valores de muestra.'),
       ('que falla la consulta de datos','abro la sección','se distingue el error de la ausencia de registros y no se oculta con un plan o hito inventado.'),
   ],estado='Pendiente',limites='Los componentes actuales pueden utilizar datos de respaldo visual. Se requiere completar la vinculación a los registros de cada proyecto.',fuentes=('web/frontend/src/components/campaign-detail/transparency/FundAllocationPlan.tsx','web/frontend/src/components/campaign-detail/transparency/ProjectMilestones.tsx'))

hu('HU-P09',P,'Gestionar planes, hitos y movimientos desde la web','registrar presupuesto, ejecución e hitos de mis campañas','mantener su información de transparencia',
   'Sin formularios web conectados para estas operaciones.','V06 A07 A08',[
       ('que se definan y habiliten los formularios','un propietario autorizado abre la gestión de su campaña','puede distinguir plan de fondos, hitos y movimientos de ejecución.'),
       ('que crea o modifica un registro válido','se guarda','la consulta pública o la auditoría correspondiente puede recuperar la información autorizada.'),
       ('que el registro es financiero y ya tiene trazabilidad','se corrige o retira mediante una acción permitida','se preservan antecedentes, responsables y restricciones sobre movimientos automáticos.'),
   ],estado='Pendiente',limites='Existen rutas y funciones de acceso a datos, pero eso no constituye un recorrido web disponible. Los campos, permisos y estados de los formularios finales deben acordarse antes de implementar.',fuentes=('web/frontend/src/api/campaign.api.ts','web/routes/api.php'))

hu('HU-P10',P,'Descargar reportes de campañas desde un control visible','obtener reportes generales en PDF o CSV','analizar y conservar resultados de una campaña',
   'Sin botón de reportes generales conectado; no confundir con Comprobantes.','E07 A06',[
       ('que se habilite la descarga para un rol autorizado','selecciono campaña y formato permitido','se genera el reporte de esa campaña mediante un control visible.'),
       ('que el usuario no está autorizado','intenta descargar','se rechaza el acceso.'),
       ('que no hay registros o falla la generación','solicito el reporte','se informa el resultado sin confirmar una descarga inexistente.'),
   ],estado='Pendiente',limites='El servidor dispone de generación de reportes, pero no se encontró un acceso web conectado. D05 sí cubre comprobantes individuales actuales.',fuentes=('web/app/Http/Controllers/InvestmentController.php',))

hu('HU-P11',P,'Unificar controles administrativos de decisión','usar solo acciones de revisión realmente conectadas','evitar botones que aparenten decidir pero no ejecuten una operación',
   'Gestión de Campañas y Revisión de Campañas.','A03 A06',[
       ('que se presenta Aprobar o Rechazar','el usuario tiene permiso y el estado es revisable','el botón ejecuta su decisión o conduce claramente al recorrido habilitado de Revisión de Campañas.'),
       ('que una acción no está disponible en ese contexto','se muestra el detalle','el control se oculta, deshabilita o explica su indisponibilidad sin simular éxito.'),
       ('que se define habilitar otros estados de revisión','se añade el filtro correspondiente','solo se muestran y gestionan las transiciones autorizadas.'),
   ],estado='Pendiente',limites='Actualmente se decide desde Revisión de Campañas, cuyo listado solicita pendientes. No se afirma que exista una gestión web completa de todos los estados administrativos.')

hu('HU-P12',P,'Confirmar íntegramente guardados y cargas de campaña','conocer qué datos y archivos se guardaron','evitar interpretar una operación parcial como completada',
   'Creación/edición de campaña, portada y respaldos.','E03 E06',[
       ('que la campaña se guarda pero una carga posterior falla','termina el proceso','se identifica qué se creó y qué archivo falta, sin confirmar una carga completa.'),
       ('que repito una carga pendiente','se completa el reintento','se asocia a la campaña ya creada sin duplicar la campaña por un reintento de archivo.'),
       ('que la operación no pudo guardarse','el formulario recibe el fallo','veo un resultado verificable y puedo corregir o reintentar sin perder innecesariamente los datos.'),
   ],estado='Pendiente',limites='Se requiere completar el manejo de éxito parcial y la comunicación de fallos en los contextos de formulario que no muestran todos los errores.')

hu('HU-P13',P,'Recuperar contraseña por correo','restablecer el acceso si olvido mi contraseña','volver a ingresar sin intervención sobre la base de datos',
   'Sin recorrido web actual.','C02 C06',[
       ('que se implemente la recuperación y solicito ayuda con un correo','se procesa la solicitud','la respuesta no revela si el correo pertenece a una cuenta.'),
       ('que recibí un enlace válido de recuperación','establezco una contraseña que cumple requisitos','se actualiza la contraseña y el enlace deja de ser reutilizable.'),
       ('que el enlace venció o ya se utilizó','intento restablecer','la operación se rechaza y puedo solicitar otra recuperación.'),
   ],estado='Pendiente',limites='Cambiar la contraseña dentro de una sesión no equivale a recuperación por correo. No se documenta un botón Olvidé mi contraseña como disponible.')

hu('HU-P14',P,'Entregar notificaciones por correo','recibir emails según mis preferencias','conocer eventos sin mantener la web abierta',
   'Preferencias → Notificaciones por correo; entrega de email no acreditada.','C05',[
       ('que se habilite el canal de correo y lo tengo activado','ocurre un evento definido para ese canal','se envía el email a mi dirección según la política acordada.'),
       ('que desactivo el canal','ocurre un evento posterior','no se envía un email por ese canal.'),
       ('que el envío externo falla','se procesa la notificación','no se registra una entrega confirmada inexistente y se aplica la política de reintento definida.'),
   ],estado='Pendiente',limites='El interruptor y su guardado no prueban que haya un servicio de entrega de correo operativo. Tipos de eventos y reintentos requieren definición.',fuentes=('web/app/Services/Notifier.php',))

hu('HU-P15',P,'Habilitar el asistente para campañas','recibir orientación para preparar mi propuesta','estructurar el contenido de una campaña',
   'Sin componente montado en una pantalla web.','E03',[
       ('que se decida habilitar esta capacidad','se incorpore un acceso visible en el contexto acordado','el emprendedor puede identificar para qué sirve el asistente y abrirlo.'),
       ('que el servicio habilitado genera una sugerencia','la consulto','no se guarda ni publica una campaña sin una acción explícita del propietario.'),
       ('que el servicio no está disponible','intento consultarlo','se informa su estado sin presentar una sugerencia ficticia.'),
   ],estado='Pendiente',limites='Es una capacidad distinta del asistente público V07. El componente existente no demuestra disponibilidad del recorrido.',fuentes=('web/frontend/src/components/AICampaignAssistant.tsx',))

hu('HU-P16',P,'Gestionar incidencias y datos de envío de recompensas','registrar datos de seguimiento y comunicar problemas de entrega','coordinar el cumplimiento de los beneficios',
   'Sin formularios web actuales para estos datos o incidencias.','E08 D07',[
       ('que se definan y habiliten los permisos y campos','el emprendedor registra seguimiento válido','el donador puede consultar el enlace o número autorizado de su recompensa.'),
       ('que el donador reporta una incidencia mediante el futuro formulario','se registra correctamente','puede identificar su reporte y el responsable puede consultarlo según la política acordada.'),
       ('que la recompensa está cancelada o el aporte fue reembolsado','intento una operación incompatible','se rechaza conforme a la política de estados definida.'),
   ],estado='Pendiente',limites='Hoy se puede consultar seguimiento existente y cambiar estados permitidos como emprendedor. La visualización de Incidencia Reportada no implica que exista el formulario para reportarla.')

hu('HU-P17',P,'Verificar mi correo mediante un proceso web','confirmar que controlo mi dirección de correo','acreditar ese dato de mi cuenta',
   'Sin solicitud ni confirmación de verificación conectadas en la web.','C01 C06',[
       ('que se habilite el proceso y mi correo no esté verificado','solicito verificarlo desde el acceso definido','recibo las instrucciones para confirmar la dirección sin que la solicitud por sí sola cambie el estado a Verificado.'),
       ('que recibí un enlace o código válido','completo su confirmación','la cuenta correspondiente pasa a correo verificado.'),
       ('que el enlace o código sea inválido o haya vencido','intento confirmar','el correo no se marca como verificado y se aplica el proceso de reenvío definido.'),
   ],estado='Pendiente',limites='El indicador Verificado / Sin verificar ya puede mostrarse en Configuración. El canal de entrega, vigencia y reenvío del futuro proceso requieren definición.',fuentes=('web/frontend/src/pages/AccountSettingsPage.tsx','web/routes/api.php'))


def esc(value):
    return html.escape(str(value),quote=True)


def main():
    ROOT.mkdir(parents=True,exist_ok=True)
    ids={s['id'] for s in STORIES}
    assert len(ids)==len(STORIES)
    covered={f for s in STORIES for f in s['diagramas']}
    assert covered==set(FLOWS), f'Diagramas sin cobertura: {set(FLOWS)-covered}; desconocidos: {covered-set(FLOWS)}'
    criteria_ids=[]
    for s in STORIES:
        assert len(s['criterios'])>=3
        assert set(s['dependencias'])<=ids
        for c in s['criterios']:
            criteria_ids.append(c['id'])
            assert c['dado'] and c['cuando'] and c['entonces']
        sources=set(s['fuentes']) | {source for f in s['diagramas'] for source in FLOWS[f]['sources']}
        assert all((REPO/source).is_file() for source in sources)
        s['fuentes']=sorted(sources)
    assert len(criteria_ids)==len(set(criteria_ids))
    data=dict(version='1.0',alcance='Aplicación web de UniFundme',historias=STORIES)
    (ROOT/'historias.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    groups=[V,C,D,E,A,S,'Todos los roles',P]
    nav=[]
    articles=[]
    for group in groups:
        members=[s for s in STORIES if s['rol']==group]
        nav.append(f'<h3>{esc(group)} <small>({len(members)})</small></h3>')
        for s in members:
            nav.append(f'<a href="#{s["id"]}">{s["id"]} · {esc(s["titulo"])}</a>')
            scenarios=''.join(f'<li id="{c["id"]}"><strong>{c["id"]}</strong><p><b>Dado</b> {esc(c["dado"])}<br><b>Cuando</b> {esc(c["cuando"])}<br><b>Entonces</b> {esc(c["entonces"])}</p></li>' for c in s['criterios'])
            links=' · '.join(f'<a href="../diagramas-web/index.html#{f}">{f} · {esc(FLOWS[f]["title"])}</a>' for f in s['diagramas'])
            deps=' · '.join(f'<a href="#{d}">{d}</a>' for d in s['dependencias'])
            refs=''.join(f'<li><a href="../../{esc(source)}">{esc(source)}</a></li>' for source in s['fuentes'])
            pending=s['estado']=='Pendiente'
            articles.append(f'''<article id="{s['id']}" data-role="{esc(group)}" data-status="{s['estado']}"><header><p class="eyebrow">{s['id']} · {esc(group)}</p><h2>{esc(s['titulo'])}</h2><span class="status {s['estado'].lower()}">{s['estado']}</span></header>
<p class="story">{esc(s['historia'])}</p><p><strong>{'Contexto previsto' if pending else 'Acceso y condiciones'}:</strong> {esc(s['acceso'])}</p>
{('<p class="notice">Función pendiente. Los criterios siguientes son objetivos de implementación y no describen un recorrido disponible.</p>') if pending else ''}
<h3>{'Criterios de aceptación propuestos' if pending else 'Criterios de aceptación del recorrido actual'}</h3><ol class="criteria">{scenarios}</ol>
{('<p class="notice"><strong>Alcance y condiciones:</strong> '+esc(s['limites'])+'</p>') if s['limites'] else ''}
{('<p><strong>Pendientes relacionados:</strong> '+deps+'</p>') if deps else ''}
<p class="related"><strong>Diagramas:</strong> {links}</p><details><summary>Referencias funcionales para validación</summary><ul>{refs}</ul></details><footer><a href="#inicio">Volver al índice</a></footer></article>''')
    rows=[]
    for fid,f in FLOWS.items():
        matches=[s for s in STORIES if fid in s['diagramas']]
        actual=[s for s in matches if s['estado']!='Pendiente']
        future=[s for s in matches if s['estado']=='Pendiente']
        anchor=lambda ss: ' · '.join(f'<a href="#{s["id"]}">{s["id"]}</a>' for s in ss) or 'No disponible'
        rows.append(f'<tr><td><a href="../diagramas-web/index.html#{fid}">{fid}</a></td><td>{esc(f["title"])}</td><td>{anchor(actual)}</td><td>{anchor(future)}</td></tr>')
    counts={state:sum(s['estado']==state for s in STORIES) for state in ['Actual','Parcial','Pendiente']}
    doc='''<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>UniFundme · Historias de usuario y criterios de aceptación</title><style>
:root{color-scheme:light;--ink:#20383f;--line:#d5e0df;--green:#326b2b}*{box-sizing:border-box}body{margin:0;color:var(--ink);background:#f4f7f6;font:16px/1.55 system-ui,Arial,sans-serif}a{color:#285e39;text-underline-offset:3px}a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #bd8d1f;outline-offset:3px}.layout{display:grid;grid-template-columns:310px minmax(0,1fr)}aside{position:sticky;top:0;height:100vh;overflow:auto;background:white;padding:24px 18px;border-right:1px solid var(--line)}aside h2{font-size:21px;margin-top:0}aside h3{font-size:14px;margin:24px 0 8px}aside a{display:block;padding:7px 0;text-decoration:none;border-bottom:1px solid #edf1ef;font-size:13px}main{min-width:0;padding:38px clamp(20px,4vw,70px);max-width:1320px}h1{font-size:36px;line-height:1.2;letter-spacing:-.6px}h2{font-size:24px;line-height:1.25}h3{font-size:17px}p{margin:12px 0}.eyebrow{font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:700;color:#526d59}.intro{margin-bottom:28px}.toolbar{display:flex;gap:12px;flex-wrap:wrap;margin:20px 0}input,select,button{font:inherit;padding:9px 12px;border:1px solid #b7c8bf;border-radius:6px}aside input,aside select{width:100%;margin:6px 0 12px}button{background:#326b2b;color:white;cursor:pointer}label{font-size:13px}.counts{display:flex;gap:14px;flex-wrap:wrap}.counts span{padding:8px 12px;background:white;border:1px solid var(--line);border-radius:6px}article,#cobertura{padding:28px;background:white;border:1px solid var(--line);border-radius:12px;margin:24px 0;scroll-margin-top:15px}article header{position:relative}article header h2{margin:8px 0 12px}.status{display:inline-block;font-size:13px;padding:3px 9px;border-radius:5px;background:#e9f1e7}.status.parcial{background:#fff2cf}.status.pendiente{background:#edf0f4}.story{padding:16px 18px;background:#edf5ee;border-left:3px solid #6e9646;font-size:17px}.notice{padding:13px 16px;background:#fff6e3;border-left:3px solid #bc973a}.criteria{list-style:none;padding:0;counter-reset:criteria}.criteria>li{padding:16px 0;border-bottom:1px solid #e5ebe7}.criteria>li>strong{font-size:12px;color:#5a6f60}.criteria p{margin:7px 0}.related,footer{font-size:13px}details{font-size:12px;overflow-wrap:anywhere;margin:15px 0}summary{cursor:pointer}footer{margin-top:18px;padding-top:12px;border-top:1px solid var(--line)}table{width:100%;border-collapse:collapse;font-size:13px}td,th{text-align:left;padding:10px 8px;border-bottom:1px solid var(--line);vertical-align:top}.hidden{display:none!important}#resultados{font-size:12px;color:#5a6f60}.skip{position:absolute;left:-9999px}.skip:focus{left:10px;top:10px;background:white;padding:10px}code{overflow-wrap:anywhere}
@media(max-width:900px){.layout{display:block}aside{position:static;height:auto;max-height:430px}main{padding:22px 15px}h1{font-size:29px}article{padding:19px}table{font-size:12px}}
@media print{@page{size:A4;margin:16mm}body{background:white;font-size:10pt}.layout{display:block}aside,.toolbar,.skip,details,footer{display:none}main{padding:0;max-width:none}h1{font-size:23pt}h2{font-size:16pt}h3{font-size:12pt}article,#cobertura{border:0;border-radius:0;padding:0;margin:18px 0;break-before:page}.story{font-size:11pt;padding:10px}.criteria>li{break-inside:avoid;padding:10px 0}.notice{break-inside:avoid;padding:9px}.intro{break-after:page}a{color:inherit;text-decoration:none}.hidden{display:none!important}}
</style></head><body><a class="skip" href="#inicio">Saltar al contenido</a><div class="layout"><aside><h2>UniFundme · Historias</h2><label for="q">Buscar historia o criterio</label><input id="q" type="search" placeholder="Ej.: Comentarios, KYC, reembolso"><label for="rol">Rol</label><select id="rol"><option value="">Todos los roles</option>__ROLES__</select><label for="estado">Disponibilidad</label><select id="estado"><option value="">Todos los estados</option><option>Actual</option><option>Parcial</option><option>Pendiente</option></select><p id="resultados" role="status"></p><nav aria-label="Historias por rol">__NAV__<h3>Referencia</h3><a href="#cobertura">Matriz de cobertura de diagramas</a></nav></aside><main>
<section id="inicio" class="intro"><p class="eyebrow">Especificación funcional / versión web</p><h1>Historias de usuario y criterios de aceptación</h1><p>Historias organizadas por rol para describir qué necesita cada persona, dónde realiza la acción y cómo comprobar el resultado. Cada criterio utiliza <strong>Dado / Cuando / Entonces</strong> y tiene un identificador propio.</p><div class="counts"><span><strong>__TOTAL__</strong> historias</span><span><strong>__ACTUAL__</strong> actuales</span><span><strong>__PARCIAL__</strong> parciales</span><span><strong>__PENDIENTE__</strong> pendientes</span><span><strong>__CRITERIA__</strong> criterios</span></div>
<h2>Cómo interpretar esta especificación</h2><ul><li><strong>Actual:</strong> el recorrido tiene controles web conectados. Los criterios describen el comportamiento que debe comprobarse; no equivalen a una certificación de pruebas realizadas.</li><li><strong>Parcial:</strong> existe un recorrido utilizable, con una limitación indicada expresamente. Sus criterios actuales no dan por cumplida la mejora pendiente.</li><li><strong>Pendiente:</strong> no hay un recorrido web operativo o completo. Sus criterios son objetivos propuestos; las decisiones abiertas se indican antes de su aceptación.</li><li>El alcance incluye la web de escritorio. Se usan los nombres visibles de sus menús. No se incluyen funcionalidades exclusivas de la aplicación móvil.</li><li>Los aportes y aumentos de capital utilizan <strong>saldo simulado</strong>. No se especifica una pasarela de pagos reales.</li><li><strong>Google y el asistente IA no están disponibles.</strong> Se documentan únicamente en el bloque de pendientes, sin presentarlos como alternativas de acceso o soporte actuales.</li><li>Las historias actuales se basan en los recorridos documentados y en sus condiciones de aplicación. Una capacidad interna sin pantalla conectada se considera pendiente.</li></ul>
<h2>Condiciones para verificar los criterios</h2><p>Utiliza una cuenta del rol indicado y datos preparados para el escenario: campañas con el estado requerido, solicitudes KYC pendientes, aportes, recompensas o movimientos de auditoría según corresponda. Una lista vacía no demuestra el recorrido de aprobación o revisión. Las operaciones de cierre, eliminación, suspensión y revocación cambian los datos: usa registros destinados a pruebas.</p><p>Las notificaciones de nuevos eventos se comprueban con las preferencias correspondientes habilitadas. Los escenarios que requieren un tercero usan otra cuenta autorizada. No se incluyen credenciales personales ni contraseñas en este documento.</p><div class="toolbar"><button id="print" type="button">Imprimir / guardar en PDF</button><a href="historias.json">Descargar contenido estructurado</a><a href="../diagramas-web/index.html">Abrir los diagramas de flujo</a></div></section>
__ARTICLES__
<section id="cobertura"><p class="eyebrow">Trazabilidad funcional</p><h2>Cobertura de los 47 diagramas</h2><p>Una funcionalidad puede necesitar más de una historia. Los avisos V07, C08 y E12 corresponden a funciones pendientes; no se presentan como recorridos operativos. Los pendientes relacionados con un flujo actual no implican que toda su funcionalidad esté bloqueada.</p><table><thead><tr><th>Diagrama</th><th>Funcionalidad</th><th>Historias actuales o parciales</th><th>Pendientes relacionados</th></tr></thead><tbody>__MATRIX__</tbody></table></section>
</main></div><script>
const q=document.getElementById('q'),rol=document.getElementById('rol'),estado=document.getElementById('estado'),cards=[...document.querySelectorAll('article')];
function norm(s){return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function filter(){let count=0;for(const card of cards){const visible=norm(card.textContent).includes(norm(q.value.trim()))&&(!rol.value||card.dataset.role===rol.value)&&(!estado.value||card.dataset.status===estado.value);card.classList.toggle('hidden',!visible);if(visible)count++;}document.getElementById('resultados').textContent=count+' historias visibles';}
function reveal(){const target=document.getElementById(decodeURIComponent(location.hash.slice(1)));const card=target?.closest('article');if(card?.classList.contains('hidden')){q.value='';rol.value='';estado.value='';filter();target.scrollIntoView();}}
q.addEventListener('input',filter);rol.addEventListener('change',filter);estado.addEventListener('change',filter);window.addEventListener('hashchange',reveal);document.getElementById('print').addEventListener('click',()=>window.print());filter();reveal();
</script></body></html>'''
    options=''.join(f'<option value="{esc(g)}">{esc("Reglas compartidas (todos los roles)" if g=="Todos los roles" else g)}</option>' for g in groups)
    replacements=dict(__TOTAL__=str(len(STORIES)),__ACTUAL__=str(counts['Actual']),__PARCIAL__=str(counts['Parcial']),__PENDIENTE__=str(counts['Pendiente']),__CRITERIA__=str(len(criteria_ids)),__ROLES__=options,__NAV__='\n'.join(nav),__ARTICLES__='\n'.join(articles),__MATRIX__='\n'.join(rows))
    for key,value in replacements.items():
        doc=doc.replace(key,value)
    (ROOT/'index.html').write_text(doc,encoding='utf-8',newline='\n')
    print(json.dumps(dict(historias=len(STORIES),criterios=len(criteria_ids),estados=counts,diagramas_cubiertos=len(covered)),ensure_ascii=False))


if __name__=='__main__':
    main()
