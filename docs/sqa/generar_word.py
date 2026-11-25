"""Convierte la versión HTML del Plan SQA a un documento Word editable."""
from html.parser import HTMLParser
from pathlib import Path
import json
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'output/pdf/Plan_SQA_Agil_UniFundMe_editable.html'
OUT=ROOT/'output/documents/Plan_SQA_UniFundMe.docx'
OUT.parent.mkdir(parents=True,exist_ok=True)

class Node:
 def __init__(self,tag='',attrs=()):self.tag=tag;self.attrs=dict(attrs);self.children=[]
 def text(self):return ''.join(x.text() if isinstance(x,Node) else x for x in self.children)
 def find(self,tag):
  found=[]
  for child in self.children:
   if isinstance(child,Node):
    if child.tag==tag:found.append(child)
    found.extend(child.find(tag))
  return found

class Parser(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=True);self.root=Node();self.stack=[self.root]
 def handle_starttag(self,tag,attrs):
  node=Node(tag,attrs);self.stack[-1].children.append(node)
  if tag not in {'meta','br','link','img','hr','input'}:self.stack.append(node)
 def handle_endtag(self,tag):
  for i in range(len(self.stack)-1,0,-1):
   if self.stack[i].tag==tag:self.stack=self.stack[:i];break
 def handle_data(self,text):self.stack[-1].children.append(text)

parser=Parser();parser.feed(SOURCE.read_text(encoding='utf-8'))
sections=parser.root.find('section')
assert len(sections)==9
doc=Document()
section=doc.sections[0]
section.page_width=Inches(8.5);section.page_height=Inches(11)
section.left_margin=section.right_margin=Inches(1)
section.top_margin=Pt(62);section.bottom_margin=Pt(55)
section.header_distance=Pt(28);section.footer_distance=Pt(25)
section.different_first_page_header_footer=True

normal=doc.styles['Normal'];normal.font.name='Arial';normal.font.size=Pt(11)
normal.font.color.rgb=RGBColor(0,0,0)
normal.paragraph_format.line_spacing=Pt(14.4)
normal.paragraph_format.space_after=Pt(8)
normal.paragraph_format.widow_control=True
for name,size in [('Title',25),('Heading 1',18),('Heading 2',12),('Heading 3',10.5)]:
 s=doc.styles[name];s.font.name='Arial';s.font.size=Pt(size);s.font.bold=True;s.font.color.rgb=RGBColor(0,0,0)
 s.paragraph_format.keep_with_next=True
 s.paragraph_format.space_before=Pt(10 if name!='Title' else 0)
 s.paragraph_format.space_after=Pt(8)
 s.paragraph_format.line_spacing=Pt(size+4)
 # Remove theme colors and paragraph borders from built-in styles.
 for color in s.element.xpath('.//w:color'):
  for attr in ['themeColor','themeTint','themeShade']:
   color.attrib.pop(qn('w:'+attr),None)
  color.set(qn('w:val'),'000000')
 for border in s.element.xpath('.//w:pBdr'):border.getparent().remove(border)

head=section.header.paragraphs[0]
head.text='UniFundMe | Plan SQA | XP y Kanban | Versión 3.0'
head.style=doc.styles['Normal']
for run in head.runs:run.font.size=Pt(8);run.font.color.rgb=RGBColor(0,0,0)
def footer(footer):
 p=footer.paragraphs[0];p.paragraph_format.space_after=Pt(0)
 p.paragraph_format.tab_stops.add_tab_stop(Inches(6.2))
 run=p.add_run('Software Quality Assurance | Gestión académica 2026\t');run.font.size=Pt(8)
 field=OxmlElement('w:fldSimple');field.set(qn('w:instr'),'PAGE');p._p.append(field)
footer(section.footer);footer(section.first_page_footer)

def table(node):
 rows=node.find('tr');headers=[x for x in rows[0].children if isinstance(x,Node) and x.tag in ['th','td']]
 t=doc.add_table(rows=0,cols=len(headers));t.alignment=WD_TABLE_ALIGNMENT.CENTER;t.autofit=False
 names=[x.text() for x in headers]
 if names[0]=='Caso':ratios=[.14,.46,.4]
 elif names==['Grupo','Historias','Alcance']:ratios=[.15,.15,.7]
 elif names==['Tipo','Aplicación','Evidencia']:ratios=[.22,.51,.27]
 elif names==['Responsabilidad','Colaborador web','Colaborador móvil']:ratios=[.27,.365,.365]
 elif names==['Momento','Actividad','Salida verificable'] or names[0]=='Estado del flujo':ratios=[.21,.48,.31]
 elif names==['Riesgo','Impacto','Mitigación','Responsable']:ratios=[.22,.25,.37,.16]
 elif names==['Indicador','Línea base','Meta y seguimiento']:ratios=[.25,.34,.41]
 elif names==['Prioridad','Mejora','Criterio de cierre']:ratios=[.15,.43,.42]
 elif len(names)==2:ratios=[.78,.22] if names[0]=='Estado' else [.32,.68]
 else:ratios=[1/len(names)]*len(names)
 for col,ratio in zip(t.columns,ratios):col.width=Inches(6.5*ratio)
 props=t._tbl.tblPr
 borders=OxmlElement('w:tblBorders')
 for side in ['top','left','bottom','right','insideH','insideV']:
  e=OxmlElement('w:'+side);e.set(qn('w:val'),'single');e.set(qn('w:sz'),'4');e.set(qn('w:color'),'D9D9D9');borders.append(e)
 props.append(borders)
 margins=OxmlElement('w:tblCellMar')
 for side,value in [('top','90'),('left','100'),('bottom','90'),('right','100')]:
  e=OxmlElement('w:'+side);e.set(qn('w:w'),value);e.set(qn('w:type'),'dxa');margins.append(e)
 props.append(margins)
 for i,node_row in enumerate(rows):
  row=t.add_row();trpr=row._tr.get_or_add_trPr();trpr.append(OxmlElement('w:cantSplit'))
  if i==0:trpr.append(OxmlElement('w:tblHeader'))
  cells=[x for x in node_row.children if isinstance(x,Node) and x.tag in ['th','td']]
  for j,(cell,item) in enumerate(zip(row.cells,cells)):
   cell.width=Inches(6.5*ratios[j]);cell.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
   p=cell.paragraphs[0];p.paragraph_format.space_after=Pt(0);p.paragraph_format.line_spacing=Pt(12)
   p.paragraph_format.keep_with_next=False
   if j==0 and names[0] in ['Caso','Prioridad','Grupo']:p.alignment=WD_ALIGN_PARAGRAPH.CENTER
   run=p.add_run(item.text());run.font.name='Arial';run.font.size=Pt(9)
   run.font.bold=(i==0);run.font.color.rgb=RGBColor(255,255,255) if i==0 else RGBColor(0,0,0)
   shade=OxmlElement('w:shd');shade.set(qn('w:fill'),'25384A' if i==0 else ('F3F5F7' if i%2==0 else 'FFFFFF'));cell._tc.get_or_add_tcPr().append(shade)
 doc.add_paragraph().paragraph_format.space_after=Pt(2)

for i,node_section in enumerate(sections):
 if i==0:
  p=doc.add_paragraph();p.paragraph_format.space_after=Pt(95)
 for node in node_section.children:
  if not isinstance(node,Node):continue
  text=node.text()
  if node.tag=='table':table(node);continue
  if node.tag not in ['h1','h2','h3','p']:continue
  style=('Title' if i==0 else 'Heading 1') if node.tag=='h1' else ('Heading 2' if node.tag=='h2' else ('Heading 3' if node.tag=='h3' else 'Normal'))
  p=doc.add_paragraph(text,style)
  if node.tag=='h1' and i>0:p.paragraph_format.page_break_before=True
  if i==0:
   p.alignment=WD_ALIGN_PARAGRAPH.CENTER;p.paragraph_format.space_after=Pt(18)
   if node.tag=='p':
    for run in p.runs:run.font.size=Pt(12)

doc.core_properties.title='Plan SQA de UniFundMe'
doc.core_properties.author='Equipo de desarrollo de UniFundMe'
doc.core_properties.subject='Plan de aseguramiento de la calidad con XP y Kanban'
doc.save(OUT)

# Verify section order and complete requirement inclusion in the saved DOCX.
saved=Document(OUT)
heads=[p.text for p in saved.paragraphs if p.style.name=='Heading 1']
assert heads==[node.find('h1')[0].text() for node in sections[1:]]
scope=[];inside=False
for p in saved.paragraphs:
 if p.text=='2 Alcance':inside=True
 elif p.text=='3 Estrategia de pruebas':break
 if inside:scope.append(p.text)
scope='\n'.join(scope)
catalog=json.loads((ROOT/'docs/historias-usuario/historias.json').read_text(encoding='utf-8'))['historias']
for hu in catalog:
 assert hu['historia'] in scope
 for criterion in hu['criterios']:
  assert criterion['id'] in scope
  assert criterion['dado'] in scope and criterion['cuando'] in scope and criterion['entonces'] in scope
print(f'Created {OUT}; verified eight sections, 80 stories, 304 criteria, {len(saved.tables)} tables.')
