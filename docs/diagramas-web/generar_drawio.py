"""Convierte las fuentes Mermaid de esta guía a figuras nativas de draw.io.

Ejecutar: python docs/diagramas-web/generar_drawio.py
Solo admite la sintaxis flowchart TD usada por esta guía; falla ante otra sintaxis.
Volver a ejecutarlo reemplaza las copias .drawio generadas.
"""
from pathlib import Path
import html
import re
import textwrap
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
NODE = re.compile(r'([NB]\d+)(\(\[|\[|\{)"(.*)"(\]\)|\]|\})')
EDGE = re.compile(r'([NB]\d+) --> *(?:\|"(.*?)"\| *)?([NB]\d+)')


def parse(path):
    source = path.read_text(encoding="utf-8")
    nodes, edges = {}, []
    for number, raw in enumerate(source.splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("%%") or line == "flowchart TD":
            continue
        if match := NODE.fullmatch(line):
            key, opening, label, closing = match.groups()
            assert closing == {"([": "])", "[": "]", "{": "}"}[opening]
            assert key not in nodes, f"Nodo duplicado: {key}"
            nodes[key] = (opening, html.unescape(label))
        elif match := EDGE.fullmatch(line):
            start, label, end = match.groups()
            edges.append((start, html.unescape(label or ""), end))
        else:
            raise ValueError(f"{path.name}:{number}: sintaxis no soportada: {line}")
    assert nodes and all(a in nodes and b in nodes for a, _, b in edges)
    title = source.splitlines()[0].removeprefix("%% ")
    return title, nodes, edges


def geometry(cell, **values):
    return ET.SubElement(cell, "mxGeometry", {"as": "geometry", **{k: str(v) for k, v in values.items()}})


def diagram(path):
    title, nodes, edges = parse(path)
    page = ET.Element("diagram", id=path.stem, name=title)
    model = ET.SubElement(page, "mxGraphModel", dx="1400", dy="900", grid="1",
                          gridSize="10", guides="1", tooltips="1", connect="1",
                          arrows="1", fold="1", page="0", pageScale="1",
                          pageWidth="1400", pageHeight="1000", math="0", shadow="0")
    root = ET.SubElement(model, "root")
    ET.SubElement(root, "mxCell", id="0")
    ET.SubElement(root, "mxCell", id="1", parent="0")
    header = ET.SubElement(root, "mxCell", id="title", value=title, vertex="1", parent="1",
                           style="text;html=0;align=left;verticalAlign=middle;fontSize=22;fontStyle=1;whiteSpace=wrap;")
    geometry(header, x=60, y=20, width=1180, height=70)
    # Tamaños variables por fila para evitar solapamientos en los textos largos.
    sizes = {}
    for key, (kind, label) in nodes.items():
        count = len(textwrap.wrap(label, width=28 if kind == "{" else 42)) or 1
        sizes[key] = (420, max(160, count * 44 + 40) if kind == "{" else max(70, count * 23 + 28))
    rows = sorted(int(key[1:]) for key in nodes if key.startswith("N"))
    positions, y = {}, 130
    for row in rows:
        main, branch = f"N{row}", f"B{row}"
        height = max(sizes[main][1], sizes.get(branch, (0, 0))[1])
        for key, x in ((main, 60), (branch, 680)):
            if key in nodes:
                w, h = sizes[key]
                positions[key] = (x, y + (height - h) / 2, w, h)
        y += height + 85
    for key, (kind, label) in nodes.items():
        shape = {"{": "rhombus;", "([": "rounded=1;arcSize=50;", "[": "rounded=0;"}[kind]
        color = "#fff2cc" if kind == "{" else "#d5e8d4" if kind == "([" else "#dae8fc"
        if key.startswith("B"):
            color = "#fff4e6"
        cell = ET.SubElement(root, "mxCell", id=key, value=label, vertex="1", parent="1",
                             style=shape + "whiteSpace=wrap;html=0;fontFamily=Arial;fontSize=17;"
                             "align=center;verticalAlign=middle;spacing=12;"
                             f"fillColor={color};strokeColor=#8296a6;")
        x, top, w, h = positions[key]
        geometry(cell, x=x, y=top, width=w, height=h)
    for index, (start, label, end) in enumerate(edges):
        returning = start.startswith("B")
        branching = end.startswith("B")
        anchors = ("exitX=1;exitY=0.5;entryX=1;entryY=0.5;" if returning else
                   "exitX=1;exitY=0.5;entryX=0;entryY=0.5;" if branching else
                   "exitX=0.5;exitY=1;entryX=0.5;entryY=0;")
        cell = ET.SubElement(root, "mxCell", id=f"edge{index}", value=label,
                             edge="1", parent="1", source=start, target=end,
                             style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=0;"
                             "endArrow=block;endFill=1;fontSize=15;labelBackgroundColor=#ffffff;"
                             "strokeColor=#526578;jettySize=auto;orthogonalLoop=1;" + anchors)
        geo = geometry(cell, relative=1)
        if returning:
            # Las vueltas rodean las alternativas por la derecha.
            lane = 1160 + int(start[1:]) * 14
            points = ET.SubElement(geo, "Array", {"as": "points"})
            for key in (start, end):
                _, top, _, height = positions[key]
                ET.SubElement(points, "mxPoint", x=str(lane), y=str(top + height / 2))
    return page, nodes, edges


def validate(path, expected_nodes, expected_edges):
    root = ET.parse(path).getroot()
    cells = root.findall("./diagram/mxGraphModel/root/mxCell")
    actual_nodes = {c.get("id"): c.get("value") for c in cells
                    if c.get("vertex") == "1" and c.get("id") != "title"}
    actual_edges = [(c.get("source"), c.get("value"), c.get("target"))
                    for c in cells if c.get("edge") == "1"]
    assert actual_nodes == {key: label for key, (_, label) in expected_nodes.items()}, path
    assert actual_edges == expected_edges, path


def main():
    sources = sorted((ROOT / "mermaid").glob("*.mmd"))
    assert sources, "No hay fuentes Mermaid"
    # Analizar todo antes de escribir para no producir una conversión parcial.
    parsed = [(path, *diagram(path)) for path in sources]
    output = ROOT / "drawio"
    output.mkdir(exist_ok=True)
    node_count = edge_count = 0
    for source, page, nodes, edges in parsed:
        document = ET.Element("mxfile", host="app.diagrams.net", type="device", compressed="false")
        document.append(page)
        ET.indent(document, space="  ")
        destination = output / f"{source.stem}.drawio"
        ET.ElementTree(document).write(destination, encoding="utf-8", xml_declaration=True)
        validate(destination, nodes, edges)
        node_count += len(nodes)
        edge_count += len(edges)
    print(f"{len(parsed)} archivos .drawio validados: {node_count} nodos y {edge_count} conexiones.")


if __name__ == "__main__":
    main()
