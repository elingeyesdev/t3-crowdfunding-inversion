"""Rasteriza nuestros SVG simples con Pillow para inspección y exportación PNG.
Uso: python docs/diagramas-web/render_previa.py D03
Requiere Pillow. No interviene en la guía, que funciona sin dependencias.
"""
from pathlib import Path
import math
import re
import sys
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parent
(root/'png').mkdir(exist_ok=True)
for diagram_id in (sys.argv[1:] or ['D03']):
    svg = ET.parse(root/'svg'/f'{diagram_id}.svg').getroot()
    _, _, width, height = map(float, svg.attrib['viewBox'].split())
    image = Image.new('RGB', (int(width), int(height)), 'white')
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf',18)
    label_font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf',16)
    for node in svg.iter():
        tag = node.tag.split('}')[-1]
        a = node.attrib
        if tag=='rect':
            x,y,w,h=[float(a[k]) for k in ['x','y','width','height']]
            draw.rounded_rectangle((x,y,x+w,y+h),radius=float(a['rx']),fill=a['fill'],outline=a['stroke'])
        elif tag=='polygon':
            points=[tuple(map(float,p.split(','))) for p in a['points'].split()]
            draw.polygon(points,fill=a['fill'])
            draw.line(points+[points[0]],fill=a['stroke'],width=1)
        elif tag=='path' and a.get('class')=='edge':
            tokens=re.findall(r'[MVH]|-?\d+(?:\.\d+)?',a['d'])
            points=[]
            i=0
            x=y=0
            while i<len(tokens):
                command=tokens[i];i+=1
                if command=='M':x,y=float(tokens[i]),float(tokens[i+1]);i+=2
                elif command=='V':y=float(tokens[i]);i+=1
                elif command=='H':x=float(tokens[i]);i+=1
                points.append((x,y))
            draw.line(points,fill='#526578',width=2)
            if len(points)>1:
                end,prev=points[-1],points[-2]
                angle=math.atan2(end[1]-prev[1],end[0]-prev[0])
                draw.polygon([end]+[(end[0]-10*math.cos(angle+s),end[1]-10*math.sin(angle+s)) for s in [-0.4,0.4]],fill='#526578')
        elif tag=='text':
            y=float(a['y'])
            parts=list(node)
            if parts:
                for part in parts:
                    y+=float(part.attrib.get('dy',0))
                    draw.text((float(part.attrib['x']),y),part.text or '',font=font,fill='#193449',anchor='ms')
            else:
                draw.text((float(a['x']),y),node.text or '',font=label_font,fill='#42596b',anchor='ms' if a.get('text-anchor')=='middle' else 'ls')
    image.save(root/'png'/f'{diagram_id}.png')
    print(f'{diagram_id}.png: {image.width} x {image.height}')
