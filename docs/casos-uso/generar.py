"""Genera casos de uso web, UML por rol y actividades verticales individuales.
Ejecutar: python docs/casos-uso/generar.py
Las historias y los diagramas previos se leen sin modificarlos.
"""
from pathlib import Path
from collections import Counter
import html
import json
import re
import zipfile
import xml.etree.ElementTree as ET
from functools import lru_cache
from PIL import Image, ImageDraw, ImageFont
from narrativas import CASOS

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.parent
HISTORIAS = json.loads((ROOT.parent/'historias-usuario/historias.json').read_text(encoding='utf-8'))['historias']
HU = {h['id']: h for h in HISTORIAS}
ROLES = dict(V='Visitante', C='Acceso y funciones compartidas', D='Donador', E='Emprendedor', A='Administrador', S='Superadministrador')
E = lambda s: html.escape(str(s), quote=True)
FONT = 'C:/Windows/Fonts/arial.ttf'
BOLD = 'C:/Windows/Fonts/arialbd.ttf'


@lru_cache(maxsize=16)
def font(size=18, bold=False):
    return ImageFont.truetype(BOLD if bold else FONT, size)


def wrap(text, pixels, size=18, bold=False):
    result = []
    for paragraph in text.split('\n'):
        line = ''
        for word in paragraph.split():
            if line and font(size, bold).getlength(line+' '+word) > pixels:
                result.append(line)
                line = word
            else:
                line = (line+' '+word).strip()
        result.append(line)
    return result


class Canvas:
    """Las mismas primitivas producen el SVG y el PNG de cada diagrama."""
    def __init__(self, title, desc, width=1050):
        self.title, self.desc, self.width = title, desc, width
        self.shapes = []

    def rect(self, x, y, w, h, fill='#f0f6fa', stroke='#9bafbe', radius=10):
        self.shapes.append(('rect', (x, y, w, h, fill, stroke, radius)))

    def ellipse(self, x, y, w, h):
        self.shapes.append(('ellipse', (x, y, w, h)))

    def polygon(self, points, fill='#fff3d8', stroke='#aa8533'):
        self.shapes.append(('polygon', (points, fill, stroke)))

    def line(self, points, arrow=False, dashed=False, color='#546b7b'):
        self.shapes.append(('line', (points, arrow, dashed, color)))

    def text(self, text, x, y, width, size=18, bold=False, center=True, color='#203a4a'):
        rows = wrap(text, width, size, bold)
        for i, row in enumerate(rows):
            self.shapes.append(('text', (row, x, y+i*(size+6), size, bold, center, color)))
        return len(rows)*(size+6)

    def save(self, name, height):
        svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.width} {height}" role="img" aria-labelledby="title desc">',
               f'<title id="title">{E(self.title)}</title><desc id="desc">{E(self.desc)}</desc>',
               '<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="#546b7b"/></marker></defs>',
               f'<rect width="{self.width}" height="{height}" fill="white"/>']
        im = Image.new('RGB', (self.width, height), 'white')
        draw = ImageDraw.Draw(im)
        for kind, data in self.shapes:
            if kind == 'rect':
                x,y,w,h,fill,stroke,r = data
                svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}"/>')
                draw.rounded_rectangle((x,y,x+w,y+h),radius=r,fill=fill,outline=stroke,width=2)
            elif kind == 'ellipse':
                x,y,w,h=data
                svg.append(f'<ellipse cx="{x+w/2}" cy="{y+h/2}" rx="{w/2}" ry="{h/2}" fill="#f0f6fa" stroke="#6c8a9e"/>')
                draw.ellipse((x,y,x+w,y+h),fill='#f0f6fa',outline='#6c8a9e',width=2)
            elif kind == 'polygon':
                points,fill,stroke=data
                pts=' '.join(f'{x},{y}' for x,y in points)
                svg.append(f'<polygon points="{pts}" fill="{fill}" stroke="{stroke}"/>')
                draw.polygon(points,fill=fill)
                draw.line(points+[points[0]],fill=stroke,width=2)
            elif kind == 'line':
                points,arrow,dashed,color=data
                pts=' '.join(f'{x},{y}' for x,y in points)
                attrs=(' marker-end="url(#arrow)"' if arrow else '')+(' stroke-dasharray="7 5"' if dashed else '')
                svg.append(f'<polyline points="{pts}" fill="none" stroke="{color}" stroke-width="2"{attrs}/>')
                if dashed:
                    import math
                    for (x1,y1),(x2,y2) in zip(points,points[1:]):
                        length=math.hypot(x2-x1,y2-y1)
                        for offset in range(0,int(length),12):
                            end=min(offset+7,length)
                            draw.line([(x1+(x2-x1)*offset/length,y1+(y2-y1)*offset/length),
                                       (x1+(x2-x1)*end/length,y1+(y2-y1)*end/length)],fill=color,width=2)
                else:
                    draw.line(points,fill=color,width=2)
                if arrow:
                    import math
                    (px,py),(x,y)=points[-2:]
                    angle=math.atan2(y-py,x-px)
                    draw.polygon([(x,y)]+[(x-12*math.cos(angle+s),y-12*math.sin(angle+s)) for s in [-.4,.4]],fill=color)
            elif kind == 'text':
                text,x,y,size,bold,center,color=data
                svg.append(f'<text x="{x}" y="{y}" text-anchor="{"middle" if center else "start"}" font-family="Arial,sans-serif" font-size="{size}" font-weight="{"700" if bold else "400"}" fill="{color}">{E(text)}</text>')
                draw.text((x,y),text,font=font(size,bold),fill=color,anchor='ms' if center else 'ls')
        svg.append('</svg>')
        (ROOT/'svg'/f'{name}.svg').write_text('\n'.join(svg),encoding='utf-8')
        im.save(ROOT/'png'/f'{name}.png')
        ET.parse(ROOT/'svg'/f'{name}.svg')


def actividad(c):
    title=f"{c['id']} · {c['titulo']}"
    cv=Canvas(title, 'Actividad vertical del caso de uso. El recorrido principal baja por No en cada alternativa. Sí conduce a su respuesta y a la continuidad indicada por número de paso o caso.')
    y=28+cv.text(title,525,32,970,23,True)
    y+=cv.text('Recorrido principal hacia abajo · Alternativas a la derecha',525,y,970,16)+20
    nodes=[dict(text='Inicio',kind='terminal')]
    for p in c['pasos']:
        nodes.append(dict(text=f"{p['numero']} · {c['actor']}: {p['actor']}",kind='actor'))
        for a in c['alternativas']:
            if a['paso']==p['numero']:
                nodes.append(dict(text=f"{a['id']} · ¿{a['condicion'].rstrip('.')}?",kind='decision',alt=a))
        nodes.append(dict(text=f"{p['numero']} · UniFundme: {p['sistema']}",kind='system'))
    nodes.append(dict(text='Fin del recorrido principal',kind='terminal'))
    previous=None
    mm=[f'%% {title}', 'flowchart TD']
    for i,n in enumerate(nodes):
        decision=n['kind']=='decision'
        tw=320 if decision else 470
        th=len(wrap(n['text'],tw))*24
        h=max(160,th*1.8+24) if decision else max(64,th+32)
        alt=n.get('alt')
        bh=0
        if alt:
            bt=f"{alt['id']} · {alt['respuesta']}\nContinuidad: {alt['continuidad']}"
            bh=len(wrap(bt,310))*24+36
        rowh=max(h,bh)
        cy=y+rowh/2
        if previous:
            cv.line([(300,previous[0]),(300,cy-h/2)],True)
            if previous[1]:
                cv.text('No',323,previous[0]+24,45,15)
        if decision:
            cv.polygon([(300,cy-h/2),(560,cy),(300,cy+h/2),(40,cy)])
            cv.text(n['text'],300,cy-th/2+17,tw)
            cv.line([(560,cy),(655,cy)],True)
            cv.text('Sí',609,cy-12,55,15)
            cv.rect(655,cy-bh/2,355,bh,'#fff7e9','#b9944a')
            cv.text(bt,832,cy-(bh-36)/2+17,310,18)
            label=E(n['text'])
            mm.append(f'  N{i}{{"{label}"}}')
            mm.append(f'  A{i}["{E(bt).replace(chr(10), "<br/>")}"]')
            mm.append(f'  N{i} -->|Sí| A{i}')
        else:
            fill={'terminal':'#e5f2df','actor':'#eef4fa','system':'#eaf5ef'}[n['kind']]
            cv.rect(40,cy-h/2,520,h,fill,radius=30 if n['kind']=='terminal' else 10)
            cv.text(n['text'],300,cy-th/2+17,tw)
            label=E(n['text'])
            mm.append(f'  N{i}' + (f'(["{label}"])' if n['kind']=='terminal' else f'["{label}"]'))
        if i:
            link=' -->|No| ' if nodes[i-1]['kind']=='decision' else ' --> '
            mm.append(f'  N{i-1}{link}N{i}')
        previous=(cy+h/2,decision)
        y+=rowh+52
    cv.text('Las alternativas indican dónde retomar o terminar; no todas concluyen en éxito.',525,y,970,15)
    cv.save(c['id'],int(y+30))
    (ROOT/'mermaid'/f"{c['id']}.mmd").write_text('\n'.join(mm)+'\n',encoding='utf-8')


def uml(group, cases):
    title='Casos de uso · '+ROLES[group]
    cv=Canvas(title,'Diagrama UML: actor fuera del límite UniFundme web; óvalos dentro del sistema y líneas de asociación. La disposición es vertical, no representa una secuencia.')
    cv.text(title,525,34,980,24,True)
    note={'V':'La consulta pública también está disponible para personas con sesión.',
          'C':'Visitante: registro y acceso. Usuario con cuenta: acciones autorizadas. Comentarios y contacto: Donador o Emprendedor.',
          'D':'Requiere cuenta Donador. El capital es simulado. Elegir una recompensa es opcional al donar.',
          'E':'Requiere cuenta Emprendedor y propiedad de la campaña. Aplican requisitos y estados de cada ficha.',
          'A':'También disponible para Superadministrador. Cada operación respeta sus restricciones.',
          'S':'El Superadministrador también posee los casos del Administrador; este diagrama muestra sus funciones exclusivas.'}[group]
    cv.text(note,525,70,980,17)
    base=175
    spacing=135
    height=base+spacing*len(cases)+65
    cv.rect(345,140,665,height-175,'#ffffff','#6c8a9e',0)
    cv.text('UniFundme · aplicación web',677,168,620,20,True)
    actor_names=['Visitante','Usuario con cuenta'] if group=='C' else [ROLES[group]]
    actor_y=[base+spacing*.5,base+spacing*5] if group=='C' else [base+spacing*max(.8,len(cases)/2)]
    for label,cy in zip(actor_names,actor_y):
        cv.ellipse(92,cy-55,36,36)
        cv.line([(110,cy-19),(110,cy+35)])
        cv.line([(65,cy),(155,cy)])
        cv.line([(110,cy+35),(75,cy+78)])
        cv.line([(110,cy+35),(145,cy+78)])
        cv.text(label,110,cy+103,190,17,True)
    pu=['@startuml','top to bottom direction','skinparam shadowing false',f'title {title}']
    for i,label in enumerate(actor_names):
        pu.append(f'actor "{label}" as Actor{i}')
    pu.append('rectangle "UniFundme · aplicación web" {')
    for i,c in enumerate(cases):
        cy=base+spacing*(i+.5)
        cv.ellipse(405,cy-48,550,96)
        text=c['id']+' · '+c['titulo']+(' [Parcial]' if c['estado']=='Parcial' else '')
        rows=wrap(text,440,18)
        cv.text(text,680,cy-(len(rows)*24)/2+17,440)
        ai=0 if group!='C' or c['id'] in ('CU-C01','CU-C02') else 1
        cv.line([(155,actor_y[ai]),(405,cy)])
        pu.append(f'  usecase "{text}" as {c["id"].replace("-", "_")}')
    pu.append('}')
    for c in cases:
        ai=0 if group!='C' or c['id'] in ('CU-C01','CU-C02') else 1
        pu.append(f'Actor{ai} -- {c["id"].replace("-", "_")}')
    if group=='D':
        # Relación opcional: D05 agrega selección de recompensa a D04.
        pu.append('CU_D05 ..> CU_D04 : <<extend>>\n')
        y1=base+spacing*4.5-48
        y2=base+spacing*3.5+48
        cv.line([(680,y1),(680,y2)],True,True)
        cv.text('«extend»',755,(y1+y2)/2+5,120,14)
    pu+=['note bottom',note,'end note','@enduml']
    cv.text('Las asociaciones indican participación; los pasos y excepciones se describen en cada ficha.',525,height-14,990,15)
    cv.save('UML-'+group,int(height))
    (ROOT/'plantuml'/f'UML-{group}.puml').write_text('\n'.join(pu)+'\n',encoding='utf-8')


def story_link(id):
    return f'<a href="../historias-usuario/index.html#{id}">{id}</a>'


def case_link(code):
    return f'<a href="#CU-{code}">CU-{code}</a>'


def rich(text):
    return re.sub(r'\b(CU-[VCDEAS]\d{2})\b',lambda m:f'<a href="#{m[1]}">{m[1]}</a>',E(text))


def main():
    for folder in ['svg','png','mermaid','plantuml']:
        (ROOT/folder).mkdir(parents=True,exist_ok=True)
    expected={h['id'][3:] for h in HISTORIAS if h['estado']!='Pendiente' and h['id']!='HU-T01'}
    assert set(CASOS)==expected, (set(CASOS)^expected)
    cases=[]
    for code,data in CASOS.items():
        h=HU['HU-'+code]
        actor={'C01':'Visitante','C02':'Persona con cuenta','C05':'Donador o Emprendedor','C10':'Donador o Emprendedor','C11':'Donador o Emprendedor'}.get(code,h['rol'])
        c=dict(id='CU-'+code, grupo=code[0], actor=actor, actores_secundarios=(['Servicio externo de la red social elegida'] if code=='V07' else ['Proveedor del video'] if code in ('V05','V12') else []),
               titulo=h['titulo'], objetivo=h['historia'].split(', quiero ',1)[-1].removesuffix('.'), estado=h['estado'],
               acceso=h['acceso'], limites=h['limites'], historia=h['id'], criterios=[x['id'] for x in h['criterios']],
               diagramas_previos=h['diagramas'], pendientes=h['dependencias'], fuentes=h['fuentes'],
               relaciones=([dict(tipo='extend',destino='CU-D04',condicion='La persona elige una recompensa al aportar.')] if code=='D05' else []), **data)
        assert c['pasos'] and c['alternativas']
        assert all(1<=a['paso']<=len(c['pasos']) for a in c['alternativas'])
        assert all((REPO/f).is_file() for f in c['fuentes'])
        cases.append(c)
        actividad(c)
    for group in ROLES:
        uml(group,[c for c in cases if c['grupo']==group])
    pending=[h for h in HISTORIAS if h['estado']=='Pendiente']
    data=dict(version='1.0', alcance='Aplicación web de UniFundme; excluye móvil',
              convenciones=dict(Actual='Recorrido web conectado identificado en la aplicación; no implica certificación de funcionamiento en producción.',
                                Parcial='Recorrido utilizable con las limitaciones explícitas de la ficha.',
                                Pendiente='Capacidad sin recorrido web completo disponible; no se presenta como caso operativo.'),
              casos=cases, reglas_transversales=HU['HU-T01'], funciones_pendientes=pending)
    (ROOT/'casos.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    body=[]
    for group,label in ROLES.items():
        body.append(f'<section class="role-section" id="rol-{group}"><h2>{E(label)}</h2><details class="overview"><summary>Diagrama UML de {E(label)}</summary><p>Los óvalos representan objetivos y las líneas indican quién participa. Su posición vertical no define el orden de ejecución.</p><div class="diagram"><img loading="lazy" src="svg/UML-{group}.svg" alt="Casos de uso UML de {E(label)}"></div><p><a href="svg/UML-{group}.svg">Abrir SVG</a> · <a href="png/UML-{group}.png">PNG</a> · <a href="plantuml/UML-{group}.puml">Fuente PlantUML</a></p></details>')
        for c in [c for c in cases if c['grupo']==group]:
            links=' · '.join(f'<a href="../diagramas-web/index.html#{f}">{f}</a>' for f in c['diagramas_previos'])
            search=E(json.dumps(c,ensure_ascii=False))
            body.append(f'<details class="case" id="{c["id"]}" data-role="{group}" data-status="{c["estado"]}" data-search="{search}"><summary><span class="code">{c["id"]}</span> {E(c["titulo"])} <span class="badge {c["estado"].lower()}">{c["estado"]}</span></summary><div class="case-body"><dl>')
            fields=[('Objetivo',c['objetivo'][:1].upper()+c['objetivo'][1:]+'.'),('Actor principal',c['actor']),('Otros participantes',', '.join(c['actores_secundarios']) or 'Ningún actor externo adicional en este recorrido.'),('Acceso',c['acceso']),('Disparador',c['disparador']),('Precondiciones',c['precondicion']),('Resultado al completar el recorrido',c['postcondicion'])]
            for label,value in fields:
                body.append(f'<dt>{label}</dt><dd>{E(value)}</dd>')
            body.append('</dl><h3>Flujo principal</h3><div class="table-wrap"><table><thead><tr><th>Paso</th><th>Acción de la persona</th><th>Respuesta de UniFundme</th></tr></thead><tbody>')
            for p in c['pasos']:
                body.append(f'<tr><td>{p["numero"]}</td><td>{E(p["actor"])}</td><td>{E(p["sistema"])}</td></tr>')
            body.append('</tbody></table></div><h3>Alternativas y excepciones</h3><ol class="alternatives">')
            for a in c['alternativas']:
                body.append(f'<li><strong>{a["id"]} · Paso {a["paso"]}: {E(a["condicion"])}</strong><p>{E(a["respuesta"])}</p><p class="continuity">{rich(a["continuidad"])}</p></li>')
            body.append('</ol>')
            if c['limites']:
                body.append(f'<aside><strong>Alcance de este recorrido.</strong> {E(c["limites"])}</aside>')
            body.append(f'<details class="activity"><summary>Diagrama vertical de {c["id"]}</summary><p>Se sigue el recorrido principal hacia abajo. En cada condición, Sí conduce a la alternativa indicada; No continúa. La alternativa señala el paso o caso al que volver, o si termina.</p><div class="diagram"><img loading="lazy" src="svg/{c["id"]}.svg" alt="Recorrido vertical de {E(c["titulo"])}"></div><p><a href="svg/{c["id"]}.svg">Abrir SVG</a> · <a href="png/{c["id"]}.png">PNG</a> · <a href="mermaid/{c["id"]}.mmd">Fuente Mermaid</a></p></details>')
            body.append(f'<p class="trace">Historia y criterios de aceptación: {story_link(c["historia"])} ({len(c["criterios"])} criterios). Diagramas de navegación: {links}.</p>')
            if c['pendientes']:
                body.append('<p>Capacidades relacionadas pendientes: '+', '.join(f'<a href="#pendiente-{p}">{p}</a>' for p in c['pendientes'])+'.</p>')
            body.append('<details class="sources"><summary>Referencias de la aplicación</summary><ul>'+''.join(f'<li><a href="../../{E(f)}">{E(f)}</a></li>' for f in c['fuentes'])+'</ul></details></div></details>')
        body.append('</section>')
    # Las reglas compartidas no se disfrazan de objetivos independientes.
    rules='<section id="reglas"><h2>Reglas compartidas de acceso y privacidad</h2><p>Se aplican a todos los casos que consultan o modifican datos privados. '+story_link('HU-T01')+'.</p><ul>'
    for ca in HU['HU-T01']['criterios']:
        rules+=f'<li>Dado {E(ca["dado"])}, cuando {E(ca["cuando"])}, entonces {E(ca["entonces"])}</li>'
    rules+='</ul><p>El Superadministrador puede realizar las funciones del Administrador. Tener sesión no concede permisos de otro rol ni acceso a recursos ajenos. Las excepciones de cada ficha complementan estas reglas.</p><p>Cuando una consulta falla, el error no equivale a una lista vacía. Una operación no se considera completada solo por pulsar un botón. En los guardados parciales de campañas se comprueba lo realmente almacenado antes de repetir la creación.</p></section>'
    pend='<section id="pendientes"><h2>Funciones pendientes o no disponibles</h2><p>Estas capacidades no tienen aquí una secuencia operativa ni un diagrama que sugiera que ya funcionan. Su definición futura está en las historias vinculadas.</p>'
    for h in pending:
        pend+=f'<article class="pending" id="pendiente-{h["id"]}"><h3>{E(h["titulo"])} <span class="badge pendiente">Pendiente</span></h3><p>{E(h["limites"] or h["acceso"])}</p><p>{story_link(h["id"])}</p></article>'
    pend+='</section>'
    matrix='<section id="trazabilidad"><h2>Índice y trazabilidad</h2><p>62 casos cubren las 62 historias actuales o parciales de objetivos de usuario. HU-T01 aporta las reglas compartidas; las otras 17 historias documentan capacidades pendientes. Los 47 diagramas anteriores quedan vinculados a estos casos o a esas capacidades.</p><div class="table-wrap"><table><thead><tr><th>Caso</th><th>Funcionalidad</th><th>Historia</th><th>Estado</th></tr></thead><tbody>'
    for c in cases:
        matrix+=f'<tr><td><a href="#{c["id"]}">{c["id"]}</a></td><td>{E(c["titulo"])}</td><td>{story_link(c["historia"])}</td><td>{c["estado"]}</td></tr>'
    matrix+='</tbody></table></div></section>'
    counts=Counter(c['estado'] for c in cases)
    roleoptions=''.join(f'<option value="{g}">{label}</option>' for g,label in ROLES.items())
    nav=' · '.join(f'<a href="#rol-{g}">{label}</a>' for g,label in ROLES.items())
    page='''<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>UniFundme · Casos de uso web</title><style>
    :root{font-family:Arial,sans-serif;color:#203a4a;background:#f4f7f6;line-height:1.6}*{box-sizing:border-box}body{margin:0}main{max-width:1140px;margin:auto;padding:32px 28px 80px}header{background:#183829;color:white;padding:32px;border-radius:18px}h1{font-size:2.2rem;margin:0}h2{margin-top:42px;color:#194f35}h3{font-size:1.08rem}header p{max-width:900px}a{color:#196248;text-underline-offset:3px}header a{color:#dbf4ac}nav{margin-top:20px}nav a{display:inline-block;margin:3px}.stats{display:flex;flex-wrap:wrap;gap:12px;margin:22px 0}.stats span{background:#e9f1e6;border-radius:10px;padding:10px 16px}.filters{padding:18px;background:white;border:1px solid #cfddd4;border-radius:12px;display:flex;flex-wrap:wrap;gap:14px}.filters label{display:flex;flex-direction:column;gap:4px;flex:1;min-width:190px}input,select,button{font:inherit;padding:9px;border:1px solid #9baeaa;border-radius:6px}button{cursor:pointer;background:#edf5e8;color:#20442d}.tools{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0}summary{cursor:pointer;font-weight:bold;padding:16px}.case,.overview{border:1px solid #cbd8d2;border-radius:10px;background:white;margin:14px 0}.case-body{padding:0 22px 22px}.badge{font-size:.78rem;white-space:nowrap;padding:4px 9px;border-radius:20px;margin-left:8px;display:inline-block}.actual{background:#e1f0db;color:#264719}.parcial{background:#fff1c7;color:#67460c}.pendiente{background:#eee8f5;color:#573d73}.code{font-family:monospace;color:#326443;margin-right:7px}dt{font-weight:bold;margin-top:11px}dd{margin-left:0}table{border-collapse:collapse;width:100%;background:white}th,td{text-align:left;vertical-align:top;padding:12px;border:1px solid #d3ded8}th{background:#eaf0ec}.table-wrap{overflow:auto}.alternatives{list-style:none;padding:0}.alternatives li{border-left:4px solid #d3aa54;padding:9px 14px;margin:14px 0;background:#fffaf0}.alternatives p{margin:5px 0}.continuity{color:#4e6457}aside{background:#fff5dc;padding:15px;border-radius:7px}.activity{border-top:1px solid #d3ded8;margin-top:20px}.diagram{max-height:780px;overflow:auto;background:white;border:1px solid #d9e2dd}.diagram img{display:block;width:100%;min-width:850px;height:auto}.trace,.sources{font-size:.9rem}.pending{background:white;padding:10px 20px;margin:12px 0;border-left:4px solid #9e8ab3}.sources ul{overflow-wrap:anywhere}[hidden]{display:none!important}#result{color:#496051}section{scroll-margin-top:15px}.case:target,.pending:target{outline:3px solid #72a83b}footer{margin-top:40px;border-top:1px solid #cad8ce;padding-top:20px;color:#52675c}.empty{padding:15px;background:#fff5dc}@media(max-width:650px){main{padding:16px 12px}header{padding:22px}h1{font-size:1.7rem}.case-body{padding:0 12px 18px}.badge{margin-left:0}td,th{padding:8px}}@media print{body{background:white}main{max-width:none;padding:0}header{background:white;color:#203a4a;padding:0}header a{color:#196248}.filters,.tools,#result,.sources{display:none}details>summary{list-style:none}.case,.overview{break-before:auto;box-shadow:none}.case{break-inside:auto}.diagram{max-height:none;overflow:visible}.diagram img{min-width:0;width:100%}.activity{break-before:page}.activity .diagram img{max-height:245mm;object-fit:contain}table{font-size:10pt}h2,h3,summary{break-after:avoid}a{color:inherit}footer{font-size:10pt}}
    </style></head><body><main>'''
    page+=f'<header><h1>UniFundme · Casos de uso</h1><p>Guía de las funcionalidades de la aplicación web, organizada por roles. Cada caso explica quién participa, cómo comienza, qué hace la persona, cómo responde el sistema y qué sucede ante alternativas o restricciones.</p><nav>{nav} · <a href="#reglas">Reglas compartidas</a> · <a href="#pendientes">Funciones pendientes</a> · <a href="#trazabilidad">Índice</a></nav></header>'
    page+=f'<div class="stats"><span><strong>62</strong> casos redactados</span><span><strong>6</strong> diagramas UML por rol</span><span><strong>62</strong> diagramas verticales</span><span><strong>{counts["Actual"]}</strong> actuales · <strong>{counts["Parcial"]}</strong> parciales</span></div>'
    page+='<section id="lectura"><h2>Cómo leer esta guía</h2><p><strong>Actual:</strong> recorrido web conectado identificado en la aplicación. <strong>Parcial:</strong> recorrido utilizable con límites explícitos. <strong>Pendiente:</strong> capacidad sin recorrido completo disponible; aparece al final, sin instrucciones operativas. Estas etiquetas describen el alcance y no certifican disponibilidad en producción.</p><p>Los diagramas UML muestran actores y objetivos dentro del límite de UniFundme. Los diagramas verticales de cada ficha muestran los pasos y alternativas del caso. Las condiciones de acceso se comprueban antes de actuar; tener sesión iniciada no implica permisos para todos los roles.</p><p>Las pestañas principales de campaña son <strong>Historia y Proyecto</strong>, <strong>Transparencia y Fondos</strong>, <strong>Hitos y Avances</strong> y <strong>Comentarios</strong>. Esta última puede requerir desplazar la barra horizontalmente a la derecha. Los nombres de las acciones siguen la web.</p></section>'
    page+=f'<div class="filters"><label>Buscar casos<input id="search" type="search" placeholder="Nombre, menú, rol o código…"></label><label>Rol<select id="role"><option value="">Todos los roles</option>{roleoptions}</select></label><label>Disponibilidad<select id="status"><option value="">Actuales y parciales</option><option>Actual</option><option>Parcial</option></select></label></div><p id="result" aria-live="polite"></p><div class="tools"><button id="reset">Restablecer filtros</button><button id="expand">Abrir todas las fichas</button><button id="print">Imprimir / Guardar como PDF</button><a href="unifundme-casos-uso-web.zip">Descargar el paquete completo</a></div><p>Los filtros se aplican a las fichas operativas. Las reglas, las funciones pendientes y el índice permanecen disponibles al final.</p>'
    page+=''.join(body)+rules+pend+matrix+'<footer>Alcance: aplicación web de UniFundme. No incluye la versión móvil. <a href="../historias-usuario/index.html">Historias de usuario y criterios de aceptación</a> · <a href="../diagramas-web/index.html">Diagramas de navegación</a> · <a href="casos.json">Datos estructurados</a>.</footer>'
    page+=r'''</main><script>
    const cases=[...document.querySelectorAll('.case')], sections=[...document.querySelectorAll('.role-section')];
    const search=document.querySelector('#search'), role=document.querySelector('#role'), status=document.querySelector('#status');
    const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const cache=new Map(cases.map(c=>[c,norm(c.dataset.search)]));
    function filter(){const words=norm(search.value).split(/\s+/).filter(Boolean);let count=0;for(const c of cases){c.hidden=!!((role.value&&c.dataset.role!==role.value)||(status.value&&c.dataset.status!==status.value)||!words.every(w=>cache.get(c).includes(w)));if(!c.hidden)count++}for(const s of sections)s.hidden=![...s.querySelectorAll('.case')].some(c=>!c.hidden);document.querySelector('#result').textContent=`${count} de ${cases.length} casos visibles`;}
    for(const x of [search,role,status])x.addEventListener('input',filter);
    document.querySelector('#reset').onclick=()=>{search.value=role.value=status.value='';filter()};
    document.querySelector('#expand').onclick=()=>{for(const c of cases)if(!c.hidden)c.open=true};
    function reveal(){const target=document.getElementById(decodeURIComponent(location.hash.slice(1)));if(!target)return;let el=target;while(el){el.hidden=false;if(el.tagName==='DETAILS')el.open=true;el=el.parentElement}target.scrollIntoView({block:'start'});}
    addEventListener('hashchange',reveal);
    let snapshot;
    addEventListener('beforeprint',()=>{snapshot=[...document.querySelectorAll('details')].map(d=>[d,d.open]);for(const [d]of snapshot)d.open=true});
    addEventListener('afterprint',()=>{if(snapshot)for(const[d,open]of snapshot)d.open=open;snapshot=null});
    document.querySelector('#print').onclick=()=>window.print();filter();if(location.hash)reveal();
    </script></body></html>'''
    (ROOT/'index.html').write_text(page,encoding='utf-8')
    # Paquete portable: incluye los documentos previos de los enlaces de trazabilidad.
    archive=ROOT/'unifundme-casos-uso-web.zip'
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
        for directory in [ROOT,ROOT.parent/'historias-usuario',ROOT.parent/'diagramas-web']:
            for path in sorted(directory.rglob('*')):
                if path.is_file() and path.suffix!='.zip' and '__pycache__' not in path.parts:
                    z.write(path,path.relative_to(ROOT.parent))
    print(f'{len(cases)} casos; {len(pending)} pendientes; {dict(counts)}; 68 SVG y 68 PNG.')


if __name__=='__main__':
    main()
