#!/usr/bin/env python3
"""Generate a passive import fixture, not a hardware session. Requires ezdxf."""
from pathlib import Path
import ezdxf
from ezdxf import bbox

ROOT = Path(__file__).resolve().parents[1] / 'test-files'
ROOT.mkdir(exist_ok=True)
doc = ezdxf.new('R2010')
doc.units = ezdxf.units.MM
doc.header['$MEASUREMENT'] = 1
m = doc.modelspace()
styles = {'RED_CUT': (1, 0xff0000), 'BLUE_CREASE': (5, 0x0000ff), 'BLACK_IGNORE': (7, 0x000000)}
for name, (aci, rgb) in styles.items():
    doc.layers.new(name, dxfattribs={'color': aci, 'true_color': rgb})
def attrs(layer):
    aci, rgb = styles[layer]
    return {'layer': layer, 'color': aci, 'true_color': rgb}
def poly(points, layer, closed=False):
    m.add_lwpolyline(points, close=closed, dxfattribs=attrs(layer))
def line(a,b,layer):
    m.add_line(a,b,dxfattribs=attrs(layer))
# Closed paths: distinct dimensions distinguish contour order and direction.
poly([(5,43),(25,43),(25,60),(5,60)], 'RED_CUT', True)
poly([(32,43),(49,43),(37,61)], 'RED_CUT', True)
m.add_circle((59,53), 6, dxfattribs=attrs('RED_CUT'))
# Open paths: single line, connected zigzag, and true circular arc.
line((6,8),(6,31),'BLUE_CREASE')
poly([(14,10),(22,10),(22,17),(30,17),(30,28)],'BLUE_CREASE')
m.add_arc((49,17), 10, 0, 180, dxfattribs=attrs('BLUE_CREASE'))
# Ignored geometry: full bounding box plus an unmistakable X.
poly([(0,0),(70,0),(70,70),(0,70)],'BLACK_IGNORE',True)
line((56,32),(64,40),'BLACK_IGNORE')
line((56,40),(64,32),'BLACK_IGNORE')
path = ROOT/'colour-protocol-test-70mm.dxf'
doc.saveas(path)
loaded = ezdxf.readfile(path)
audit = loaded.audit()
assert not audit.errors and not audit.fixes
bounds = bbox.extents(loaded.modelspace())
assert tuple(bounds.extmin) == (0,0,0) and tuple(bounds.extmax) == (70,70,0)
assert len(loaded.modelspace()) == 9
for layer in styles:
    assert len([e for e in loaded.modelspace() if e.dxf.layer == layer]) == 3
print(f'Validated: {path}; 70 x 70 mm, 9 entities, 3 per colour, no DXF audit errors.')
# Matching preview with conventional DXF positive-Y-up coordinates.
(ROOT/'colour-protocol-test-70mm.svg').write_text('''<svg xmlns="http://www.w3.org/2000/svg" viewBox="-3 -3 76 76" width="608" height="608">
<rect x="-3" y="-3" width="76" height="76" fill="white"/>
<g transform="translate(0 70) scale(1 -1)" fill="none" stroke-width="0.35">
<g stroke="#000000"><rect x="0" y="0" width="70" height="70"/><path d="M56 32L64 40M56 40L64 32"/></g>
<g stroke="#ff0000"><rect x="5" y="43" width="20" height="17"/><path d="M32 43L49 43L37 61Z"/><circle cx="59" cy="53" r="6"/></g>
<g stroke="#0000ff"><path d="M6 8L6 31M14 10L22 10L22 17L30 17L30 28M59 17A10 10 0 0 1 39 17"/></g>
</g></svg>''')
