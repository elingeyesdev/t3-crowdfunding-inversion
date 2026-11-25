"""Genera el plan completo, su copia editable y la matriz de aceptación.

Usar el Python del runtime documental, con reportlab y pypdf disponibles.
El catálogo original no se modifica. Los resultados se importan de Playwright.
"""
from pathlib import Path
from html import escape
from collections import Counter, defaultdict
import csv, json, re, subprocess
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/pdf'
OUT.mkdir(parents=True,exist_ok=True)
catalog=json.loads((ROOT/'docs/historias-usuario/historias.json').read_text(encoding='utf-8'))['historias']
report_path=ROOT/'web/playwright-report/results.json'
report=json.loads(report_path.read_text(encoding='utf-8')) if report_path.exists() else {}
results=[]
def collect(suites):
 for suite in suites:
  for spec in suite.get('specs',[]):
   for test in spec.get('tests',[]):
    last=test.get('results',[{}])[-1]
    results.append({'title':spec['title'],'file':spec['file'],'line':spec['line'],'status':last.get('status','notRun'),'duration':last.get('duration',0)})
  collect(suite.get('suites',[]))
collect(report.get('suites',[]))
by_criterion=defaultdict(list)
for result in results:
 for ca in re.findall(r'HU-[A-Z]\d{2}-CA\d{2}',result['title']): by_criterion[ca].append(result)
counts=Counter(r['status'] for r in results)
commit=subprocess.check_output(['git','rev-parse','--short','HEAD'],cwd=ROOT,text=True).strip()
previous_summary=OUT/'Resumen_Playwright_UniFundMe.json'
if previous_summary.exists():
 commit=json.loads(previous_summary.read_text(encoding='utf-8')).get('commitBase',commit)
sections=[]
def section(title):
 b=[];sections.append((title,b));return b
def p(b,t):b.append(('p',t))
def h(b,t):b.append(('h',t))
def rowtable(b,headers,rows,widths):b.append(('table',headers,rows,widths))

b=section('Plan SQA de UniFundMe')
p(b,'Plan de aseguramiento de la calidad y pruebas de aceptación del proyecto web y móvil')
p(b,'Proyecto UniFundMe')
p(b,'Asignatura Software Quality Assurance')
p(b,'Elaborado por el equipo de desarrollo de UniFundMe')
p(b,'Metodología XP y Kanban')
p(b,'Código SQA-UFM-01 | Versión 2.1')
p(b,'Gestión académica 2026')
p(b,'24 de noviembre de 2026')

b=section('Introducción')
p(b,'Este documento presenta el Plan de Aseguramiento de la Calidad del Software de UniFundMe, una plataforma web y móvil orientada al financiamiento de proyectos. La aplicación permite a los emprendedores presentar campañas y a los donadores realizar aportes mediante saldo simulado. El plan organiza las actividades de calidad necesarias para verificar el acceso por roles, la publicación de campañas, la gestión de aportes y recompensas, los reembolsos y la protección de la información privada.')
p(b,'El propósito del plan es definir el alcance de las pruebas, la estrategia de verificación, las responsabilidades del equipo, los criterios de entrada y salida, las métricas y el registro de evidencias. Las historias de usuario y sus criterios de aceptación constituyen la base para relacionar cada requisito con sus casos de prueba y resultados.')
h(b,'Metodología de trabajo')
p(b,'El desarrollo se organiza mediante XP combinado con Kanban. El equipo está conformado por dos integrantes: uno responsable de la aplicación web y la API, y otro de la aplicación móvil. Ambos coordinan los cambios sobre el mismo producto y revisan las modificaciones del otro integrante antes de integrarlas al repositorio compartido.')
p(b,'Las prácticas de XP se orientan a realizar avances pequeños, mantener comunicación frecuente, revisar los cambios y utilizar pruebas para apoyar la integración y la refactorización. Kanban permite visualizar el estado de las tareas, identificar bloqueos y controlar el trabajo en curso. La revisión periódica de resultados y dificultades facilita la mejora continua del proceso.')
h(b,'Integración de la calidad')
p(b,'La calidad se trabaja desde la revisión de los requisitos hasta la aceptación de cada avance. Antes de implementar se aclaran los criterios y los ejemplos de comportamiento esperado. Durante el desarrollo se preparan y ejecutan pruebas con Playwright, se corrigen defectos y se revisa el código mediante pull requests. Después de la integración se comprueba que los cambios mantengan el funcionamiento de las áreas relacionadas.')
p(b,'El seguimiento se realiza por tarea y entrega. Las funcionalidades y pruebas pendientes se registran con su estado y responsable, mientras que los resultados ejecutados se acompañan de evidencias que permiten revisar su alcance.')

b=section('Alcance')
p(b,'El Plan SQA comprende las 80 historias de usuario y sus 304 criterios de aceptación. Las pruebas abarcan la consulta pública de campañas, la gestión de cuentas, las funciones del donador y del emprendedor, las operaciones administrativas y el control de acceso. También se consideran las historias parciales y pendientes para planificar su verificación conforme se complete su desarrollo.')
groups=Counter(x['id'].split('-')[1][0] for x in catalog)
states=Counter(x['estado'] for x in catalog)
rowtable(b,['Grupo','Historias','Alcance'],[[g,str(groups[g]),name] for g,name in [('V','Consulta pública'),('C','Cuenta y comunicación'),('D','Donador'),('E','Emprendedor'),('A','Administración'),('S','Superadministración'),('T','Permisos transversales'),('P','Funcionalidades pendientes del catálogo')]],[.15,.15,.7])
p(b,f"El registro de historias clasifica {states['Actual']} como actuales, {states['Parcial']} como parciales y {states['Pendiente']} como pendientes. Esta clasificación sirve para organizar el trabajo; la aceptación de cada historia depende de la verificación de sus criterios y de los resultados registrados.")
p(b,'La aplicación web utiliza Laravel, React y TypeScript, con servicios disponibles mediante la API /api/v1. La aplicación móvil está desarrollada en Flutter. Las pruebas Playwright se centran en la interfaz web y en los servicios compartidos con el cliente móvil. La interfaz nativa de Android requiere una verificación complementaria en dispositivo o emulador.')
h(b,'Límites de las pruebas')
p(b,'Las operaciones financieras utilizan saldo simulado; los cobros y desembolsos bancarios reales quedan fuera del alcance. Las integraciones con Google, servicios de inteligencia artificial y correo externo requieren pruebas específicas con sus respectivos entornos y credenciales.')
p(b,'La ejecución se prioriza según el riesgo y el valor del producto: primero privacidad y autorización; después publicación, aportes, recompensas y reembolsos; y luego seguimiento, administración y presentación. El anexo reúne todas las historias y criterios, y la matriz de trazabilidad identifica los casos automatizados y las verificaciones pendientes.')

b=section('Estrategia de pruebas')
p(b,'La estrategia utiliza Playwright para automatizar pruebas de integración por HTTP y recorridos de aceptación en el navegador. Los casos se diseñan a partir de los criterios de aceptación e incluyen escenarios válidos, errores de validación, restricciones por rol y estados que puedan afectar el comportamiento del sistema.')
rowtable(b,['Tipo','Aplicación','Evidencia'],[
 ['Integración por HTTP','Playwright APIRequestContext sobre Laravel real: autenticación, perfiles, saldo, campañas, recompensas y permisos.','Respuesta, efectos observables y reporte por caso.'],
 ['Aceptación web','Playwright Chromium con interfaz real: portada, catálogo, ficha pública, login, retorno y destinos por rol.','Aserciones de URL y contenido visible.'],
 ['Regresión','Repetir suite ante cada cambio relevante y antes de aceptar un PR. Casos negativos de montos, estados y privacidad.','Resultado por commit y rama de trabajo.'],
 ['Exploratorias','Usar los escenarios Dado, Cuando, Entonces del catálogo para observar errores, accesibilidad y comportamiento no automatizado.','Registro separado de observaciones y casos por ampliar.'],
 ['Contrato móvil','Playwright HTTP verifica servicios consumidos por Flutter.','Resultado del servicio; aceptación nativa pendiente de evidencia Android.']],[.22,.51,.27])
p(b,'Las pruebas Playwright verifican los servicios y los recorridos web seleccionados. Las pruebas PHP y Flutter existentes complementan el control técnico del proyecto y mantienen sus propios registros de ejecución.')
h(b,'ATDD y BDD')
p(b,'Se aplica un enfoque de diseño orientado a la aceptación: antes de implementar se acuerdan ejemplos mediante Dado, Cuando y Entonces. Esta estructura permite precisar las condiciones iniciales, la acción del usuario y el resultado esperado. Cada caso se relaciona con su historia y criterio para facilitar la revisión del comportamiento y la identificación de defectos.')
h(b,'Desarrollo guiado por pruebas')
p(b,'Para las reglas nuevas y las correcciones se propone el ciclo TDD: preparar una prueba del comportamiento esperado, comprobar su fallo inicial, implementar el cambio mínimo y refactorizar con la regresión aprobada. La aplicación de este ciclo se documentará mediante las pruebas y los cambios asociados a cada tarea.')

b=section('Herramientas y entorno de pruebas')
p(b,'Playwright se incorpora como dependencia de desarrollo en web/package.json y su archivo de bloqueo. La configuración está en web/playwright.config.ts. Los casos de negocio están en web/e2e/tests/acceptance.spec.ts y los de navegador en web/e2e/tests/browser.spec.ts.')
p(b,'El comando npm run test:e2e ejecuta web/e2e/run.mjs. El runner crea una carpeta marcada en tmp/playwright/run-*, genera una clave temporal y una base SQLite propia, prepara fixtures, inicia PHP en un puerto libre y ejecuta Playwright. Cada caso restaura la instantánea inicial y utiliza un solo worker. El servidor se detiene al finalizar.')
p(b,'El entorno de pruebas mantiene su propia configuración, caché, vistas y almacenamiento. La base temporal utiliza usuarios @example.test y campañas sintéticas con estados controlados. Esta separación permite restaurar los datos de cada escenario y preservar la base de trabajo del proyecto.')
h(b,'Comandos desde web')
for line in ['npm ci','npx playwright install chromium','npm run build','npm run test:e2e']:p(b,line)
p(b,'La ejecución requiere PHP con SQLite y BCMath, las dependencias de Composer instaladas y el frontend compilado. Antes de iniciar las pruebas se comprueba la disponibilidad del servidor y la correcta preparación de los datos temporales.')
h(b,'Reportes y datos sensibles')
p(b,'Playwright guarda HTML y JSON en web/playwright-report y las trazas/capturas de fallos en web/test-results. Los reportes generados se excluyen de Git; el resumen de la entrega conserva conteos y títulos sin copiar tokens. Antes de compartir una traza o un runtime se revisan credenciales sintéticas y enlaces privados.')
p(b,'Referencias técnicas de implementación: documentación oficial de Playwright, API testing y Test configuration, consultada el 24/11/2026. https://playwright.dev/docs/api-testing y https://playwright.dev/docs/test-configuration.')

b=section('Roles y responsabilidades')
rowtable(b,['Responsabilidad','Colaborador web','Colaborador móvil'],[
 ['Implementación','Desarrolla frontend web, API y sus pruebas.','Desarrolla Flutter y coordina contratos API.'],
 ['Revisión cruzada','Revisa y aprueba PR del colaborador móvil.','Revisa y aprueba PR del colaborador web.'],
 ['Calidad','Mantiene casos Playwright web y de API; reproduce defectos.','Revisa criterios y efectos sobre móvil; aporta verificación Android.'],
 ['Coordinación','Comunica cambios de contrato, rutas y reglas.','Comunica dependencias y diferencias del cliente móvil.'],
 ['Aceptación y documentación','Ambos revisan plan, riesgos, evidencias y tablero.','Ambos acuerdan alcance y registran pendientes.']],[.27,.365,.365])
p(b,'Ambos integrantes comparten la función QA Champion: mantienen el plan, la trazabilidad y las métricas. Cada desarrollador prepara las pruebas de su área y atiende defectos; el otro revisa sus cambios. La priorización, la validación de criterios y la coordinación del flujo Kanban se acuerdan conjuntamente.')
h(b,'Control de versiones y revisión de cambios')
p(b,'El proyecto utiliza un repositorio GitHub compartido con las ramas main y Develop. Develop concentra la integración de los avances de ambos colaboradores. Cada modificación se desarrolla en una rama independiente y se somete a revisión mediante un pull request.')
p(b,'1. Seleccionar una tarea y crear una rama de trabajo a partir de Develop actualizada. La tarea debe identificar las historias y los criterios de aceptación relacionados.')
p(b,'2. Realizar cambios y pruebas en esa rama; hacer commits pequeños y push. Abrir un pull request cuyo destino sea Develop, con descripción del cambio, HU/criterios, resultado de Playwright y dependencias.')
p(b,'3. El otro colaborador verifica el código y el comportamiento, solicita correcciones o aprueba. El autor atiende observaciones y repite las pruebas afectadas. Solo después de la aprobación se integra a Develop.')
p(b,'4. Después del merge a Develop, ejecutar la regresión del incremento integrado y actualizar el tablero con los resultados y las evidencias correspondientes.')
p(b,'La aprobación cruzada permite comprobar el trabajo de ambos componentes y detectar cambios que puedan afectar el contrato entre la aplicación web, la API y el cliente móvil. Las observaciones del revisor deben resolverse antes de integrar el avance.')

b=section('Ciclo de vida de las pruebas')
rowtable(b,['Estado del flujo','Actividad de calidad','Condición para avanzar'],[
 ['Pendiente','Revisar historia, criterios, estado y riesgo.','Valor y dependencia comprendidos.'],
 ['Listo','Acordar ejemplos ATDD y datos; identificar casos de aceptación.','Responsable y entorno disponibles.'],
 ['En desarrollo','Implementar avance y pruebas Playwright; revisar contratos.','Pruebas pertinentes ejecutadas.'],
 ['En revisión','Abrir PR a Develop; el otro colaborador inspecciona y verifica.','Observaciones resueltas y aprobación cruzada.'],
 ['En pruebas','Repetir regresión del candidato y del incremento integrado.','Criterios comprometidos satisfechos y evidencia.'],
 ['Terminado','Registrar aceptación, matriz, defectos residuales y cierre.','Definition of Done cumplida.']],[.21,.48,.31])
p(b,'Una tarea bloqueada conserva su posición y registra motivo, responsable de desbloqueo y dependencia. Un defecto vuelve al flujo con reproducción y prioridad. Al fallar la repetición de una corrección se reabre el defecto; el merge por sí solo no representa su cierre.')
h(b,'Automatización e integración continua')
p(b,'GitHub centraliza el repositorio, los pull requests y la revisión cruzada. Las pruebas Playwright se ejecutan actualmente en el entorno local. Como mejora del proceso se propone incorporarlas a GitHub Actions para instalar dependencias, compilar la aplicación y ejecutar la regresión cuando se abra o actualice un pull request dirigido a Develop.')
p(b,'Para una futura automatización, publicar reportes aun cuando falle la ejecución y exigir la aprobación del otro colaborador. Las comprobaciones de CI complementan esa revisión; no sustituyen la evaluación del comportamiento ni el acuerdo sobre el alcance.')
h(b,'Mejora continua')
p(b,'Revisar periódicamente bloqueos y fallos, seleccionar una mejora y comprobar su efecto en la siguiente entrega. Primera prioridad: ampliar recorridos Playwright por riesgo; después incorporar Actions y mejorar la sincronización de documentación web/móvil. Registrar responsable, fecha y evidencia de cierre para cada acción.')

b=section('Criterios de entrada y salida')
h(b,'Definition of Ready')
p(b,'La tarea tiene HU y criterios identificados, prioridad, responsable y dependencias; QA y desarrollo pueden decidir objetivamente qué es aprobado o fallido. Se conocen datos, permisos, regla de negocio y contrato API. El alcance de la entrega cabe en la capacidad acordada y el entorno se prepara sin tocar datos de trabajo.')
h(b,'Entrada a la ejecución')
p(b,'Antes de ejecutar se registran la rama y la versión del código, se comprueban las dependencias y la compilación y se prepara la base temporal. Deben estar disponibles las cuentas, los permisos y los estados del escenario. Si falta una dependencia, el caso se registra como bloqueado junto con su causa y responsable de seguimiento.')
h(b,'Definition of Done')
p(b,'Todos los criterios comprometidos para la tarea tienen resultado y evidencia. Las pruebas Playwright pertinentes y la compilación pasan. No hay defectos críticos o altos abiertos que afecten el alcance aceptado. El otro colaborador revisó y aprobó el PR hacia Develop; la regresión del incremento integrado está registrada.')
p(b,'La historia y su documentación reflejan el comportamiento final, el tablero está actualizado y los cambios de contrato se comunicaron. Un criterio incumplido mantiene la historia parcial o pendiente; una excepción de deuda no convierte un comportamiento fallido en aprobado.')
h(b,'Suspensión y reanudación')
p(b,'Suspender el caso si se detecta uso de la base equivocada, exposición de información privada, resultados monetarios incoherentes o una dependencia imprescindible ausente. Conservar reproducción y evidencia, corregir la causa y reanudar con fixtures restaurados. La ejecución debe identificar el nuevo candidato.')
h(b,'Salida de la entrega')
p(b,'El cierre consolida las historias aceptadas y pendientes, las métricas, los resultados Playwright, la auditoría y las acciones de mejora. Se conserva la relación entre la prueba de la rama de trabajo y la regresión posterior a la integración en Develop. La aceptación se limita a los criterios efectivamente verificados.')

b=section('Métricas y control de calidad')
rowtable(b,['Indicador','Cálculo y uso'],[
 ['Trazabilidad documental','Historias y criterios incluidos respecto del registro de requisitos: 80/80 y 304/304.'],
 ['Criterios con comprobación','Criterios mencionados en tests / 304. Separar servicio de aceptación completa de interfaz.'],
 ['Ejecución de casos','(Aprobados + fallidos) / casos implementados. Reportar bloqueados y omitidos aparte.'],
 ['Pass y fail rate','Aprobados o fallidos / casos efectivamente ejecutados, con mismo entorno y candidato.'],
 ['Defectos por severidad','Número abierto por impacto; cero críticos o altos para aceptar el alcance comprometido.'],
 ['Tiempo de ciclo Kanban','Tiempo transcurrido desde En desarrollo hasta Terminado.'],
 ['Tiempo de revisión','Desde apertura del PR hasta aprobación; vigilar esperas de revisión cruzada.'],
 ['Densidad de defectos','Defectos confirmados del incremento / HU aceptadas; línea base por establecer.']],[.32,.68])
p(b,'Se establece una meta de trazabilidad documental del 100 % de las historias y criterios. Para aceptar una tarea se requiere el cumplimiento de sus criterios comprometidos y el registro de sus evidencias. El 100 % de los pull requests integrados a Develop debe contar con la aprobación del otro colaborador. Los objetivos de tiempo de ciclo y revisión se definirán a partir de las primeras mediciones del equipo.')
p(b,'No se midió cobertura de líneas de código ni rendimiento de producción. Los tests Playwright comprueban resultados observables, y sus porcentajes no se presentan como cobertura de código. Los 304 criterios pueden requerir varias variantes por criterio; su número no equivale al total de ejecuciones de la suite.')
h(b,'Seguimiento')
p(b,'Ambos integrantes revisan los resultados y defectos antes del merge y al cerrar cada entrega. La matriz se actualiza cuando cambia un criterio o una prueba. Las revisiones de calidad comprueban la correspondencia entre los criterios, las aserciones implementadas y los resultados registrados.')

b=section('Riesgos y mitigación')
rowtable(b,['Riesgo','Mitigación','Responsable'],[
 ['Datos privados o ajenos accesibles','Pruebas Playwright de autenticación, rol, propiedad y rutas KYC; revisión de almacenamiento y despliegue.','Web; revisión móvil.'],
 ['Saldo o reembolso inconsistente','Verificar diferencias de saldo, historial, recompensa y repetición del cierre. Ampliar concurrencia con motor real.','Web y revisor.'],
 ['Desfase del contrato compartido','Comunicar cambios de API antes del merge y contrastar cliente Flutter.','Ambos.'],
 ['Revisión detenida por dos personas','Limitar trabajo simultáneo y priorizar revisión del otro antes de abrir más tareas.','Ambos.'],
 ['Cobertura insuficiente de interfaz','Distinguir verificaciones de servicio y controles visuales; ampliar recorridos Playwright.','Autor y revisor.'],
 ['Catálogo desactualizado','Conservar estado de origen y contrastarlo con código y resultados actuales.','Ambos.'],
 ['Daño a base importada','Runtime marcado, DB temporal, caché y almacenamiento aislados; no reutilizar servidor.','Autor de suite.'],
 ['Verificación incompleta de requisitos','Mantener la trazabilidad de los 304 criterios y priorizar la ejecución por riesgo y entrega.','Ambos.']],[.3,.5,.2])
p(b,'Severidad: crítica si expone datos privados o rompe integridad; alta si impide un flujo esencial; media si afecta comportamiento secundario; baja si afecta presentación. La prioridad de atención considera daño y valor del producto. La aceptación no se basa solo en el número de defectos.')
h(b,'Pruebas de riesgo alto')
p(b,'Se priorizan el rechazo de operaciones sin cambios parciales, la asignación exacta de recompensas, el reembolso único y el bloqueo de recursos ajenos. Los datos de prueba utilizan cantidades decimales y se restauran antes de cada caso.')
p(b,'La suite actual utiliza SQLite y Chromium. Se ampliarán las pruebas de concurrencia sobre el motor de producción, el último cupo disponible, la accesibilidad y la compatibilidad con Firefox y WebKit. La interfaz nativa Android y las integraciones externas requieren sus propias verificaciones.')

b=section('Resultados de las pruebas y auditoría interna')
p(b,f'Las pruebas se ejecutaron el 24 de noviembre de 2026 con SQLite y Chromium, sobre el commit base {commit} y los cambios locales de la suite. Los resultados proceden del reporte de Playwright.')
rowtable(b,['Estado','Cantidad'],[['Pruebas del reporte',str(len(results))],['Aprobadas',str(counts['passed'])],['Fallidas',str(counts['failed']+counts['timedOut'])],['Omitidas',str(counts['skipped'])],['Criterios con al menos una comprobación identificada',str(len(by_criterion))]],[.78,.22])
p(b,'Las pruebas de API verificaron reglas de negocio y las de navegador comprobaron los recorridos seleccionados. Las 62 ejecuciones resultaron satisfactorias y aportan comprobaciones asociadas a 36 criterios. La cobertura automatizada de los 304 criterios continúa en ampliación.')
h(b,'Auditoría interna de calidad')
p(b,'La auditoría revisa la correspondencia entre requisitos, pruebas y resultados para identificar brechas de cobertura y establecer acciones correctivas sobre el proceso y la documentación.')
h(b,'Observaciones y acciones')
p(b,'AI-01. Trazabilidad de requisitos. El plan incluye las 80 historias y los 304 criterios de aceptación, conservando sus identificadores. Acción de seguimiento: actualizar la matriz cuando cambie un requisito o se incorpore una nueva prueba. Responsables: ambos integrantes.')
p(b,'AI-02: automatización incompleta respecto del catálogo total. Acción: ampliar Playwright por grupos y riesgo; conservar los criterios sin código como pendientes de automatización. Responsable: colaborador web, con revisión cruzada. Cierre: aserciones y reporte por criterio comprometido.')
p(b,'AI-03. Actualización de la documentación. La recuperación de contraseña dispone de rutas en la API, mientras que el registro de historias y parte de la documentación móvil mantienen estados anteriores. Acción correctiva: revisar el recorrido completo y actualizar su estado con la evidencia correspondiente. Responsables: ambos integrantes.')
p(b,'AI-04. Integración continua. Configurar Playwright en GitHub Actions y comprobar las protecciones de rama. Cierre: ejecución satisfactoria y evidencia de aprobación cruzada del pull request.')

b=section('Seguimiento y evidencias')
p(b,'Cada tarjeta conserva HU, criterios, responsable web o móvil, prioridad, rama, PR hacia Develop, revisor, estado y dependencias. Al enviar a revisión se adjuntan comando, entorno, resultado y evidencia. Al terminar se registra aprobación cruzada, merge y regresión de integración.')
p(b,'El defecto incluye: caso y criterio, pasos, datos sintéticos, esperado, observado, entorno, candidato, severidad y captura o traza si existe. Flujo sugerido: Nuevo, Confirmado, En corrección, Listo para repetir y Cerrado; se reabre si falla la repetición.')
h(b,'Archivos de la entrega')
p(b,'Plan PDF y copia HTML editable. Anexo completo de las 80 historias. Matriz_SQA_UniFundMe.csv con 304 registros, un caso diseñado por criterio. Resultados_Playwright_UniFundMe.html con las pruebas ejecutadas. Código fuente en web/e2e y configuración en web/playwright.config.ts.')
p(b,'Las historias de usuario se presentan con sus criterios en formato Dado, Cuando y Entonces. Cada caso de aceptación utiliza el prefijo PW seguido del identificador del criterio correspondiente. Los casos se complementan con variantes de límites, roles, estados y errores según la regla evaluada.')
p(b,'Los criterios sin prueba ejecutable se indican como Diseñado; automatización pendiente. Los criterios asociados a tests se indican como Comprobación parcial implementada con tipo API o navegador y su resultado. La aceptación completa del criterio exige revisar sus variantes y los elementos visuales descritos, incluso si una comprobación pasa.')
h(b,'Documentación de referencia')
p(b,'El plan se fundamenta en los lineamientos de la actividad Test Plan SQA final, el registro de historias de usuario del proyecto, la documentación técnica de las aplicaciones web y móvil y los reportes de Playwright. Las historias y sus criterios se mantienen en docs/historias-usuario/historias.json; las pruebas y sus instrucciones de ejecución se encuentran en web/e2e.')
p(b,'La documentación y las evidencias se actualizan con cada avance aceptado. Los enlaces a tareas, pull requests y reportes permiten relacionar los cambios del código con la revisión del otro integrante y con el resultado de las pruebas.')

# Organize the content according to the eight sections of the assignment.
original=dict(sections)
scope=original['Alcance']
scope[:0]=[('h','2.1 Funcionalidades y límites del alcance')]
scope.append(('catalog',))
strategy=original['Estrategia de pruebas']
strategy[1:1]=[('p','Las pruebas unitarias se consideran para la lógica que pueda aislarse. En Playwright Test se podrán evaluar funciones TypeScript o JavaScript sin navegador cuando corresponda. La suite actual se concentra en integración HTTP y aceptación web; las reglas PHP verificadas a través de la API se clasifican como integración. La incorporación de casos unitarios aislados queda planificada.')]
strategy += [('h','3.1 Herramientas y entorno de pruebas')]+original['Herramientas y entorno de pruebas']
strategy += [('h','3.2 Ejemplos de aceptación')]
strategy += [('p','Publicación de campaña: dada una campaña aprobada, un emprendedor con KYC aprobado y una fecha de cierre futura, cuando el propietario solicita publicar, entonces la campaña pasa a publicada y puede consultarse desde el catálogo. Si la campaña está en borrador, la solicitud se rechaza y se mantiene su estado.')]
strategy += [('p','Aporte con recompensa: dado un donador con saldo suficiente y una recompensa vigente con cupo, cuando confirma un monto compatible, entonces el aporte se registra con la recompensa elegida y se actualizan el saldo y la recaudación por el mismo importe. Si la recompensa está vencida o agotada, la operación se rechaza sin descontar saldo.')]
strategy += [('p','Reembolso: dada una campaña que finaliza sin alcanzar su meta y tiene aportes completados, cuando el propietario confirma el cierre, entonces los importes se devuelven al saldo simulado y las recompensas se cancelan. Repetir la solicitud no debe generar una segunda devolución.')]
strategy += [('h','3.3 Casos de prueba basados en las historias de usuario'),('p','Los casos automatizados se presentan por historia con su objetivo de verificación, el escenario y el resultado esperado. La preparación utiliza cuentas, campañas y saldos sintéticos restaurados antes de cada ejecución. Los identificadores E2E enumeran las ejecuciones del reporte; los identificadores HU y CA mantienen la relación con los requisitos.'),('cases',)]
strategy += [('h','3.4 Verificaciones complementarias'),('p','Se planifican sesiones exploratorias para revisar errores de conexión, reintentos, carga, estados vacíos, navegación por teclado y tamaños de pantalla. Los hallazgos se registrarán con pasos, datos y evidencia. Las pruebas de concurrencia sobre el motor de producción y la compatibilidad con Firefox y WebKit se incorporarán según su riesgo y entorno disponible.')]
roles=original['Roles y responsabilidades']
lifecycle=original['Ciclo de vida de las pruebas']
lifecycle += [('h','5.1 Pruebas manuales y automatizadas'),('p','La revisión de criterios, código y recorridos complementa las ejecuciones Playwright de desarrollo e integración. Para la aceptación manual se registran pasos, resultado observado, responsable y evidencia. Las pruebas pendientes o bloqueadas conservan ese estado hasta contar con una ejecución verificable.')]
metrics=original['Métricas y control de calidad']
metrics += [('h','7.1 Línea base metas y seguimiento')]
metrics.append(('table',['Indicador','Línea base','Meta y seguimiento'],[
 ['Trazabilidad','80 historias y 304 criterios incluidos.','100 %; revisar al cambiar requisitos. Responsables: ambos.'],
 ['Criterios con comprobación automatizada',f'{len(by_criterion)}/304 ({len(by_criterion)/304*100:.2f} %). Cobertura parcial.','Ampliar por riesgo hasta cubrir los criterios comprometidos. Revisión por PR.'],
 ['Aprobación de pruebas',f"{counts['passed']}/{len(results)} pruebas aprobadas en la ejecución del 24/11/2026.",'100 % de los casos comprometidos y regresión pertinente; revisar cada integración.'],
 ['Defectos abiertos','Sin inventario consolidado en esta medición.','Cero defectos críticos o altos para aceptar el alcance; revisar antes del merge.'],
 ['Ritmo de entrega del equipo','Pendiente de medición.','Registrar historias aceptadas por período y tiempo de ciclo; revisar periódicamente.'],
 ['Densidad de defectos','Pendiente de medición.','Medir defectos confirmados por HU aceptada; comparar entregas.'],
 ['Evidencias','Reporte Playwright disponible; evidencia de tablero y PR por vincular.','Resultado y soporte para cada caso ejecutado; revisar al cerrar la tarea.']],[.25,.34,.41]))
metrics += [('h','7.2 Herramientas y resultados registrados')]+original['Resultados de las pruebas y auditoría interna']
metrics += [('h','7.3 Seguimiento en el tablero y evidencias')]+original['Seguimiento y evidencias']
metrics += [('h','7.4 Mejoras priorizadas'),('table',['Prioridad','Mejora','Criterio de cierre'],[
 ['Alta','Ampliar los casos Playwright de los flujos críticos y sus controles visuales.','Criterios de la entrega vinculados a aserciones y reporte satisfactorio.'],
 ['Alta','Actualizar estados de historias y documentación web/móvil.','Contrato y recorrido revisados por ambos integrantes con evidencia.'],
 ['Alta','Incorporar Playwright a GitHub Actions y revisar protecciones de Develop.','PR con ejecución automatizada y aprobación del otro colaborador.'],
 ['Media','Evaluar concurrencia con el motor de datos de producción.','Sin sobrepasar metas, duplicar devoluciones ni asignar cupos de más.'],
 ['Media','Ampliar compatibilidad y accesibilidad de los recorridos web.','Entornos documentados y defectos que impidan el uso corregidos.']],[.15,.43,.42])]
risks=original['Riesgos y mitigación']
# The risk-based test design belongs to the strategy section.
marker=next((i for i,x in enumerate(risks) if x[0]=='h' and x[1]=='Pruebas de riesgo alto'),len(risks))
del risks[marker:]
for i,block in enumerate(risks):
 if block[0]=='table':
  impacts=['Exposición de identidad, documentos o información de terceros.','Pérdida de coherencia entre aportes, saldos y devoluciones.','Fallo de operaciones o datos incompatibles entre clientes.','Acumulación de tareas y demora en la integración.','Defectos visibles que no detectan las pruebas de servicio.','Aceptación basada en requisitos o estados desactualizados.','Alteración de datos ajenos al entorno de pruebas.','Funcionalidades con criterios sin verificación.']
  risks[i]=('table',['Riesgo','Impacto','Mitigación','Responsable'],[[r[0],impacts[n],r[1],r[2]] for n,r in enumerate(block[2])],[.22,.25,.37,.16])
  break
sections=[
 (original_title,original[original_title]) for original_title in ['Plan SQA de UniFundMe']
]+[
 ('1 Introducción',original['Introducción']),('2 Alcance',scope),('3 Estrategia de pruebas',strategy),
 ('4 Roles y responsabilidades',roles),('5 Ciclo de vida de las pruebas',lifecycle),
 ('6 Criterios de entrada y salida',original['Criterios de entrada y salida']),
 ('7 Métricas y control de calidad',metrics),('8 Riesgos y mitigación',risks),
]
for title,blocks in sections:
 for i,block in enumerate(blocks):
  if block[0]=='p':
   text=block[1].replace('Código SQA-UFM-01 | Versión 2.1','Código SQA-UFM-01 | Versión 3.0')
   if title=='Plan SQA de UniFundMe':text=text.replace('24 de noviembre de 2026','25 de noviembre de 2026')
   text=text.replace('El anexo reúne todas las historias y criterios','Esta sección reúne todas las historias y criterios').replace('Anexo completo de las 80 historias.','Las 80 historias se desarrollan en la sección Alcance.')
   blocks[i]=('p',text)

# Full criterion matrix and acceptance design, with real implementation evidence.
matrix=[]
for hu in catalog:
 for ca in hu['criterios']:
  linked=by_criterion.get(ca['id'],[])
  matrix.append({'historia':hu['id'],'titulo':hu['titulo'],'estado_catalogo':hu['estado'],'criterio':ca['id'],'caso':'PW-'+ca['id'],'dado':ca['dado'],'cuando':ca['cuando'],'entonces':ca['entonces'],'herramienta':'Playwright','automatizacion':'Comprobación parcial implementada' if linked else 'Diseñado; automatización pendiente','tipo':'; '.join(sorted({'Navegador' if 'browser.spec' in r['file'] else 'API' for r in linked})),'resultado':'; '.join(sorted({r['status'] for r in linked})) if linked else 'No ejecutado','pruebas':'; '.join(r['title'] for r in linked),'aceptacion_integral':'Pendiente de revisión de todas las variantes y controles descritos'})
with (OUT/'Matriz_SQA_UniFundMe.csv').open('w',encoding='utf-8-sig',newline='') as f:
 writer=csv.DictWriter(f,fieldnames=list(matrix[0]));writer.writeheader();writer.writerows(matrix)
(OUT/'Resumen_Playwright_UniFundMe.json').write_text(json.dumps({'commitBase':commit,'cambiosLocales':True,'fecha':'2026-11-24','counts':dict(counts),'tests':results},ensure_ascii=False,indent=2),encoding='utf-8')

pdfmetrics.registerFont(TTFont('Arial','C:/Windows/Fonts/arial.ttf'))
pdfmetrics.registerFont(TTFont('ArialBold','C:/Windows/Fonts/arialbd.ttf'))
pdfmetrics.registerFontFamily('Arial',normal='Arial',bold='ArialBold')
styles={
 'p':ParagraphStyle('body',fontName='Arial',fontSize=10.5,leading=14.4,spaceAfter=9,allowWidows=0,allowOrphans=0),
 'title':ParagraphStyle('title',fontName='ArialBold',fontSize=18,leading=23,spaceAfter=16,keepWithNext=True),
 'h':ParagraphStyle('heading',fontName='ArialBold',fontSize=11.5,leading=15,spaceBefore=10,spaceAfter=8,keepWithNext=True),
 'cell':ParagraphStyle('cell',fontName='Arial',fontSize=9,leading=12),
 'head':ParagraphStyle('head',fontName='ArialBold',fontSize=9,leading=12,textColor=colors.white),
 'coverTitle':ParagraphStyle('coverTitle',fontName='ArialBold',fontSize=25,leading=32,spaceAfter=26,alignment=1),
 'coverBody':ParagraphStyle('coverBody',fontName='Arial',fontSize=12,leading=18,spaceAfter=16,alignment=1),
}
def pp(text,kind='p'):return Paragraph(escape(str(text)),styles[kind])
def tbl(headers,rows,widths):
 t=Table([[pp(x,'head') for x in headers]]+[[pp(x,'cell') for x in row] for row in rows],colWidths=[468*w for w in widths],repeatRows=1)
 t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#25384a')),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#f3f5f7')]),('GRID',(0,0),(-1,-1),.4,colors.HexColor('#d9d9d9')),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6),('VALIGN',(0,0),(-1,-1),'MIDDLE')]))
 return t
def render_catalog(story,html):
 story.append(pp('2.2 Historias de usuario y criterios de aceptación','h'))
 html.append('<h2>2.2 Historias de usuario y criterios de aceptación</h2>')
 intro='Las historias de usuario definen las funcionalidades comprendidas en el plan y sus condiciones de aceptación. Se presentan por rol con su identificador, estado de desarrollo y consideraciones de alcance. La matriz de trazabilidad relaciona cada criterio con los casos de prueba y la evidencia disponible.'
 story.append(pp(intro));html.append('<p>'+escape(intro)+'</p>')
 for hu in catalog:
  title=hu['id']+' '+hu['titulo']
  lead=[pp(title,'h'),pp(hu['historia']),pp('Rol: '+hu['rol']+'. Estado: '+hu['estado']+'. Acceso: '+hu['acceso'])]
  story.append(KeepTogether(lead));html.extend(['<h2>'+escape(title)+'</h2>','<p>'+escape(hu['historia'])+'</p>','<p>'+escape('Rol: '+hu['rol']+'. Estado: '+hu['estado']+'. Acceso: '+hu['acceso'])+'</p>'])
  if hu.get('limites'):
   txt='Consideraciones de alcance: '+hu['limites'];story.append(pp(txt));html.append('<p>'+escape(txt)+'</p>')
  for ca in hu['criterios']:
   txt=f"{ca['id']}"
   body=f"Dado {ca['dado']}. Cuando {ca['cuando']}. Entonces {ca['entonces']}"
   story.append(KeepTogether([pp(txt,'h'),pp(body)]));html.extend(['<h3>'+escape(txt)+'</h3>','<p>'+escape(body)+'</p>'])

def expected_assertion(result):
 title=result['title']
 if 'browser.spec' in result['file']:
  checks={
   'portada permite':'Se abre /explore y se muestra la campaña QA published.',
   'catálogo permite':'Se muestra QA published sin autenticación; QA draft queda fuera de la lista.',
   'abrir ficha':'Se abre la URL de la campaña y aparece su título como encabezado.',
   'acceso privado':'Después del login se regresa a /profile.',
   'destino de donor':'La sesión del donador abre /dashboard.',
   'destino de owner':'La sesión del emprendedor abre /entrepreneur-profile.',
   'destino de admin':'La sesión administrativa abre /admin.',
   'destino de superadmin':'La sesión de superadministrador abre /superadmin.',
   'credenciales inválidas':'Se muestra el mensaje de error y se conserva /login.',
   'recordar correo':'El correo reaparece al recordarlo; deja de conservarse después de desmarcar la opción e ingresar de nuevo.',
   'ruta privada':'Se redirige a /login y se muestra el encabezado Inicia sesión.',
  }
  for phrase,expected in checks.items():
   if phrase in title:return expected
  raise ValueError('Missing browser expectation: '+title)
 if 'saldo insuficiente' in title:return 'El segundo aporte se rechaza con 422 y el saldo disponible se mantiene en 200,00 después del primer aporte válido.'
 match=re.search(r'HU-[A-Z]\d{2}-CA\d{2}',title)
 if not match:return 'Se rechaza con 422 la publicación desde borrador, rechazo o revisión pendiente.'
 checks={
  'HU-C01-CA01':'La API responde 201 y asigna el rol entrepreneur a la cuenta creada.',
  'HU-C01-CA02':'La API rechaza la contraseña inválida con estado 422.',
  'HU-C01-CA03':'La API rechaza el correo duplicado con estado 422, incluyendo diferencias de mayúsculas.',
  'HU-C02-CA01':'Se obtiene token de acceso, rol investor y una respuesta sin campos de contraseña.',
  'HU-C02-CA04':'La API rechaza las credenciales incorrectas con estado 401.',
  'HU-C03-CA04':'Después del logout, el mismo token recibe 401 al consultar la cuenta.',
  'HU-C04-CA01':'La contraseña anterior recibe 401 y la nueva permite obtener un token de acceso.',
  'HU-D01-CA02':'El nombre editado se conserva en la consulta posterior del perfil.',
  'HU-D03-CA01':'La API devuelve capital disponible de 500,00 y total invertido de 0,00.',
  'HU-D03-CA04':'Al agregar 50,00, el capital disponible pasa de 500,00 a 550,00.',
  'HU-D04-CA02':'El aporte de 100,00 deja saldo de 400,00, recaudación de 100,00 y una inversión por 100,00.',
  'HU-D04-CA04':'La API responde 422, conserva saldo de 500,00 y el historial continúa sin inversiones.',
  'HU-D04-CA05':'El aporte a una campaña no habilitada se rechaza con estado 422.',
  'HU-D05-CA02':'La inversión conserva el ID exacto de la recompensa elegida y tiene una entrega asociada.',
  'HU-D05-CA03':'La recompensa vencida o agotada provoca 422, sin inversión ni descuento de saldo.',
  'HU-D05-CA04':'El aporte válido tiene recompensa y entrega nulas.',
  'HU-D07-CA02':'La descarga propia responde 200 con contenido application/pdf y cabecera de archivo %PDF-.',
  'HU-E09-CA01':'La solicitud termina correctamente y el historial registra pending_review.',
  'HU-E10-CA01':'La publicación devuelve published y la consulta pública posterior responde 200.',
  'HU-E10-CA02':'La decisión devuelve approved y la consulta pública continúa respondiendo 404.',
  'HU-E10-CA03':'Publicar con KYC pendiente se rechaza con estado 422.',
  'HU-E14-CA02':'La inversión queda refunded, la recompensa cancelled y el saldo vuelve a 500,00. Repetir el cierre responde 422.',
  'HU-E15-CA01':'La eliminación del borrador termina correctamente y su consulta posterior responde 404.',
  'HU-T01-CA01':'La consulta anónima del recurso privado responde 401.',
  'HU-T01-CA02':'El intento del donador de aprobar campañas responde 403.',
  'HU-T01-CA03':'La edición de la campaña ajena responde 403 y la descarga del comprobante ajeno responde 404.',
  'HU-T01-CA04':'La ruta de documentos sin autorización responde 403.',
  'HU-C05-CA01':'La conversación y el mensaje se crean; un tercero recibe 403 al consultar los mensajes.',
  'HU-C10-CA02':'La respuesta conserva el autor y la consulta de comentarios contiene el texto publicado.',
  'HU-C11-CA01':'Dos solicitudes sucesivas dejan el contador en 1 y después en 0.',
 }
 return checks[match.group()]

def render_cases(story,html):
 criterion_index={c['id']:c for hu in catalog for c in hu['criterios']}
 hu_index={hu['id']:hu for hu in catalog}
 grouped=defaultdict(list)
 for n,result in enumerate(results,1):
  match=re.search(r'HU-[A-Z]\d{2}',result['title'])
  grouped[match.group() if match else 'Regresión'].append((n,result))
 for hu_id,entries in grouped.items():
  title=hu_id+' '+hu_index.get(hu_id,{}).get('titulo','Regresión de reglas de negocio')
  story.append(pp(title,'h'));html.append('<h3>'+escape(title)+'</h3>')
  rows=[]
  for n,result in entries:
   ca_match=re.search(r'HU-[A-Z]\d{2}-CA\d{2}',result['title'])
   ca=criterion_index.get(ca_match.group() if ca_match else '')
   expected=expected_assertion(result)
   layer='Navegador' if 'browser.spec' in result['file'] else 'API HTTP'
   scenario=result['title']+'. Herramienta: Playwright. Tipo: '+layer+'.'
   rows.append([f'E2E-{n:03d}',scenario,expected])
  story.extend([tbl(['Caso','Escenario y herramienta','Resultado esperado'],rows,[.14,.46,.4]),Spacer(1,10)])
  html.append('<table><thead><tr><th>Caso</th><th>Escenario y herramienta</th><th>Resultado esperado</th></tr></thead><tbody>')
  for row in rows:html.append('<tr>'+''.join('<td>'+escape(x)+'</td>' for x in row)+'</tr>')
  html.append('</tbody></table>')

story=[];html=[]
for i,(title,blocks) in enumerate(sections):
 if i:story.append(PageBreak())
 if not i:story.append(Spacer(1,105))
 story.append(pp(title,'title' if i else 'coverTitle'));html.append('<section'+(' class="cover"' if not i else '')+'><h1>'+escape(title)+'</h1>')
 for block in blocks:
  if block[0]=='catalog':
   render_catalog(story,html)
  elif block[0]=='cases':
   render_cases(story,html)
  elif block[0]=='table':
   story.extend([tbl(block[1],block[2],block[3]),Spacer(1,10)])
   html.append('<table><thead><tr>'+''.join('<th>'+escape(x)+'</th>' for x in block[1])+'</tr></thead><tbody>')
   for row in block[2]:html.append('<tr>'+''.join('<td>'+escape(x)+'</td>' for x in row)+'</tr>')
   html.append('</tbody></table>')
  else:
   story.append(pp(block[1],block[0] if i else 'coverBody'));tag='h2' if block[0]=='h' else 'p';html.append('<'+tag+'>'+escape(block[1])+'</'+tag+'>')
 html.append('</section>')

def footer(c,d):
 c.setFont('Arial',8);c.setFillColor(colors.HexColor('#555555'))
 if d.page>1:c.drawString(72,754,'UniFundMe | Plan SQA | XP y Kanban | Versión 3.0')
 c.drawString(72,35,'Software Quality Assurance | Gestión académica 2026')
 c.drawRightString(540,35,str(d.page))
SimpleDocTemplate(str(OUT/'Plan_SQA_Agil_UniFundMe.pdf'),pagesize=letter,leftMargin=72,rightMargin=72,topMargin=62,bottomMargin=55,title='Plan SQA de UniFundMe',author='Equipo UniFundMe').build(story,onFirstPage=footer,onLaterPages=footer)
css='body{font:11pt Arial;line-height:1.45;max-width:950px;margin:32px auto;padding:0 24px;color:#202020}h1{font-size:19pt;color:#000}h2{font-size:13pt;color:#000}h3{font-size:11pt}.cover{text-align:center;padding-top:110px;padding-bottom:80px}.cover h1{font-size:25pt}.cover p{margin-bottom:24px}table{border-collapse:collapse;width:100%;font-size:10pt}th,td{border:1px solid #d9d9d9;padding:8px;text-align:left}th{background:#25384a;color:#fff}section{margin-bottom:36px}@media print{section{break-before:page}section:first-child{break-before:auto}}'
(OUT/'Plan_SQA_Agil_UniFundMe_editable.html').write_text('<!doctype html><html lang="es"><meta charset="utf-8"><title>Plan SQA UniFundMe XP y Kanban</title><style>'+css+'</style><body contenteditable="true">'+''.join(html)+'</body></html>',encoding='utf-8')
testrows=''.join('<tr><td>'+escape(r['title'])+'</td><td>'+escape(r['file'])+'</td><td>'+escape(r['status'])+'</td><td>'+str(r['duration'])+'</td></tr>' for r in results)
(OUT/'Resultados_Playwright_UniFundMe.html').write_text('<!doctype html><html lang="es"><meta charset="utf-8"><title>Resultados Playwright UniFundMe</title><style>'+css+'</style><body><h1>Resultados Playwright de UniFundMe</h1><p>24/11/2026. Commit base '+commit+' con cambios locales. Entorno aislado, SQLite y Chromium. '+str(len(results))+' pruebas; '+str(counts['passed'])+' aprobadas. Estos resultados no validan íntegramente los 304 criterios.</p><table><tr><th>Prueba</th><th>Archivo</th><th>Estado</th><th>Duración ms</th></tr>'+testrows+'</table></body></html>',encoding='utf-8')
assert len(matrix)==304 and len(catalog)==80
print(json.dumps({'historias':len(catalog),'criterios':len(matrix),'pruebas':len(results),'resultados':dict(counts),'criterios_con_comprobacion':len(by_criterion)},ensure_ascii=False))
