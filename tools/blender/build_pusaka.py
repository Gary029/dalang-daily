"""
Builds the 22 pusaka (src/shared/pusaka.ts) as small chunky vinyl-toy objects
and renders each to public/pusaka/<id>.webp (240x320, transparent, Eevee).

Shapes follow the wayang reference spec: Rahwana's tiered makuta with garuda
mungkur and hair fall, the Epiphyllum night flower on its flat cladode, the
gunungan with gate, guards, bull and tiger, naga heads and kala face, Bima's
red thumbnail, the garuda blencong on its chain, the kendhi with tall flared
neck and teat spout, keris with ganja, Solo ukiran and gayaman / ladrang
warangka, Sinta's hair jewel, and so on.

Models are written in "icon units": the 120x160 frame of the old SVG icons,
x to the right, y DOWN, d toward the viewer (1 unit = 0.01 blender units).
Every render is auto-framed to the same fill of the 3:4 frame.

  blender -b --python tools/blender/build_pusaka.py -- [--only kayon,blencong] [--out DIR] [--quality 80]
"""
import bpy, bmesh, math, os, sys
from mathutils import Vector, Matrix

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def arg(name, default=None):
    return ARGS[ARGS.index(name) + 1] if name in ARGS else default

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = arg("--out", os.path.join(ROOT, "public", "pusaka"))
ONLY = set(arg("--only", "").split(",")) - {""}
DEBUG = "--debug" in ARGS
QUALITY = int(arg("--quality", "88"))
W_PX, H_PX = 240, 320
FILL = 0.86            # share of the frame the object's silhouette may use
YAW, ELEV = 16.0, 9.0  # camera: a little from the right and above
S = 0.01
TAU = math.tau

# ---------------------------------------------------------------- materials

def lin(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]

_mats = {}
def mat(color, kind="vinyl", c2=None, scale=1.0):
    """kind: vinyl | gold | metal | glow | glass | dots | wave | stripe | grain | check | poleng"""
    key = (color, kind, c2, scale)
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new(f"{kind}{len(_mats)}")
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    def setp(n, v):
        if n in p.inputs:
            p.inputs[n].default_value = v
    setp("Base Color", (*lin(color), 1))
    setp("Roughness", 0.45)
    setp("Specular IOR Level", 0.4)
    if kind in ("gold", "metal"):
        setp("Metallic", 0.55 if kind == "gold" else 0.7)
        setp("Roughness", 0.3 if kind == "gold" else 0.35)
    if kind == "glow":
        setp("Emission Color", (*lin(color), 1))
        setp("Emission Strength", 2.2)
    if kind == "glass":
        setp("Roughness", 0.08)
        setp("Coat Weight", 1.0)
        setp("Emission Color", (*lin(color), 1))
        setp("Emission Strength", 0.35)
    if kind in ("dots", "wave", "stripe", "grain", "check", "poleng"):
        tc = nt.nodes.new("ShaderNodeTexCoord")
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = (scale, scale, scale)
        nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.inputs["A"].default_value = (*lin(color), 1)
        mix.inputs["B"].default_value = (*lin(c2 or "#000000"), 1)
        if kind == "dots":
            tx = nt.nodes.new("ShaderNodeTexVoronoi")
            tx.inputs["Scale"].default_value = 30
            nt.links.new(mp.outputs["Vector"], tx.inputs["Vector"])
            ramp = nt.nodes.new("ShaderNodeValToRGB")
            ramp.color_ramp.interpolation = "CONSTANT"
            ramp.color_ramp.elements[0].position = 0.0
            ramp.color_ramp.elements[0].color = (1, 1, 1, 1)
            ramp.color_ramp.elements[1].position = 0.22
            ramp.color_ramp.elements[1].color = (0, 0, 0, 1)
            nt.links.new(tx.outputs["Distance"], ramp.inputs["Fac"])
            nt.links.new(ramp.outputs["Color"], mix.inputs["Factor"])
        elif kind in ("wave", "stripe", "grain"):
            tx = nt.nodes.new("ShaderNodeTexWave")
            tx.inputs["Scale"].default_value = {"wave": 6, "stripe": 9, "grain": 4}[kind]
            tx.inputs["Distortion"].default_value = {"wave": 9, "stripe": 0, "grain": 4}[kind]
            tx.inputs["Detail"].default_value = 2
            if kind == "stripe":
                tx.bands_direction = "Z"
            nt.links.new(mp.outputs["Vector"], tx.inputs["Vector"])
            ramp = nt.nodes.new("ShaderNodeValToRGB")
            ramp.color_ramp.elements[0].position = 0.45
            ramp.color_ramp.elements[1].position = 0.75
            nt.links.new(tx.outputs["Fac"], ramp.inputs["Fac"])
            nt.links.new(ramp.outputs["Color"], mix.inputs["Factor"])
        elif kind == "check":
            tx = nt.nodes.new("ShaderNodeTexChecker")
            tx.inputs["Scale"].default_value = 10
            tx.inputs["Color1"].default_value = (0, 0, 0, 1)
            tx.inputs["Color2"].default_value = (1, 1, 1, 1)
            nt.links.new(mp.outputs["Vector"], tx.inputs["Vector"])
            nt.links.new(tx.outputs["Fac"], mix.inputs["Factor"])
        if kind == "poleng":
            # cells: white on even parity, odd cells cycle black / red / black / yellow
            sep = nt.nodes.new("ShaderNodeSeparateXYZ")
            nt.links.new(mp.outputs["Vector"], sep.inputs["Vector"])
            def op(o, a, b=None):
                n = nt.nodes.new("ShaderNodeMath"); n.operation = o
                for i, v in enumerate((a, b)):
                    if v is None:
                        continue
                    if isinstance(v, (int, float)):
                        n.inputs[i].default_value = v
                    else:
                        nt.links.new(v, n.inputs[i])
                return n.outputs[0]
            ix = op("FLOOR", sep.outputs["X"]); iz = op("FLOOR", sep.outputs["Z"])
            k = op("ADD", ix, op("MULTIPLY", iz, 3.0))
            u = op("FRACT", op("DIVIDE", k, 8.0))
            ramp = nt.nodes.new("ShaderNodeValToRGB")
            cr = ramp.color_ramp
            cr.interpolation = "CONSTANT"
            cols = ["#f3efe6", "#17151a", "#f3efe6", "#c8282a", "#f3efe6", "#17151a", "#f3efe6", "#e8b630"]
            cr.elements[0].position = 0.0
            cr.elements[0].color = (*lin(cols[0]), 1)
            cr.elements[1].position = 1 / 8 - 0.01
            cr.elements[1].color = (*lin(cols[1]), 1)
            for i in range(2, 8):
                e = cr.elements.new(i / 8 - 0.01)
                e.color = (*lin(cols[i]), 1)
            nt.links.new(u, ramp.inputs["Fac"])
            nt.links.new(ramp.outputs["Color"], p.inputs["Base Color"])
        else:
            nt.links.new(mix.outputs["Result"], p.inputs["Base Color"])
    _mats[key] = m
    return m

# ---------------------------------------------------------------- geometry

OBJS = []

def V(x, y, d=0.0):
    return Vector(((x - 60) * S, -d * S, (80 - y) * S))

def mk(name, verts, faces, m, smooth=True):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.update()
    for p in me.polygons:
        p.use_smooth = smooth
    ob = bpy.data.objects.new(name, me)
    ob.data.materials.append(m)
    bpy.context.scene.collection.objects.link(ob)
    OBJS.append(ob)
    return ob

def cubic(p0, p1, p2, p3, n=16):
    out = []
    for i in range(n + 1):
        t = i / n; u = 1 - t
        out.append(tuple(u ** 3 * a + 3 * u * u * t * b + 3 * u * t * t * c + t ** 3 * d
                         for a, b, c, d in zip(p0, p1, p2, p3)))
    return out

def path(start, segs, n=12):
    """svg-like poly from cubic segments [(c1,c2,end) | (end,)]"""
    pts = [start]
    for s in segs:
        if len(s) == 1:
            pts.append(s[0])
        else:
            pts += cubic(pts[-1], *s, n=n)[1:]
    return pts

def mirror(pts, cx=60):
    return [(2 * cx - x, y) for x, y in reversed(pts)]

def sweep(pts, r, m, seg=12, caps=True, name="tube", h=None, smooth=True):
    """tube along pts [(x,y,d)]; r: float | list (half-width); h: depth half-size (flat ribbons)"""
    P_ = [V(*p) if len(p) == 3 else V(p[0], p[1], 0) for p in pts]
    n = len(P_)
    rs = r if isinstance(r, (list, tuple)) else [r] * n
    hs = h if isinstance(h, (list, tuple)) else ([h] * n if h is not None else rs)
    verts, faces = [], []
    depth = Vector((0, -1, 0))
    prevN = None
    for i, c in enumerate(P_):
        T = (P_[min(i + 1, n - 1)] - P_[max(i - 1, 0)]).normalized()
        up = depth if abs(T.dot(depth)) < 0.9 else Vector((0, 0, 1))
        N = T.cross(up).normalized()
        if prevN is not None and N.dot(prevN) < 0:
            N = -N
        prevN = N
        B = N.cross(T).normalized()
        for k in range(seg):
            a = TAU * k / seg
            verts.append(c + N * (rs[i] * S * math.cos(a)) + B * (hs[i] * S * math.sin(a)))
    for i in range(n - 1):
        for k in range(seg):
            a, b = i * seg + k, i * seg + (k + 1) % seg
            faces.append((a, b, b + seg, a + seg))
    if caps:
        faces.append(tuple(range(seg))[::-1])
        faces.append(tuple(range((n - 1) * seg, n * seg)))
    return mk(name, verts, faces, m, smooth)

def cyl(p0, p1, r0, r1, m, seg=16, h=None):
    n = 4
    pts = [tuple(a + (b - a) * i / (n - 1) for a, b in zip(p0, p1)) for i in range(n)]
    rs = [r0 + (r1 - r0) * i / (n - 1) for i in range(n)]
    return sweep(pts, rs, m, seg, h=h, name="cyl")

def lathe(prof, cx, m, d0=0.0, seg=24, rmod=None, xoff=None, sd=1.0, smooth=True, name="lathe"):
    """revolve [(r, y)] about the vertical axis through (cx, d0)"""
    verts, faces, rings = [], [], []
    for r, y in prof:
        ox = xoff(y) if xoff else 0
        if r <= 1e-6:
            verts.append(V(cx + ox, y, d0)); rings.append([len(verts) - 1])
            continue
        ring = []
        for k in range(seg):
            th = TAU * k / seg
            rr = r * (rmod(th, y) if rmod else 1)
            verts.append(V(cx + ox + rr * math.cos(th), y, d0 - rr * math.sin(th) * sd))
            ring.append(len(verts) - 1)
        rings.append(ring)
    for a, b in zip(rings, rings[1:]):
        if len(a) == 1 and len(b) == 1:
            continue
        if len(a) == 1:
            faces += [(a[0], b[k], b[(k + 1) % seg]) for k in range(seg)]
        elif len(b) == 1:
            faces += [(a[k], b[0], a[(k + 1) % seg]) for k in range(seg)]
        else:
            faces += [(a[k], b[k], b[(k + 1) % seg], a[(k + 1) % seg]) for k in range(seg)]
    if len(rings[0]) > 1:
        faces.append(tuple(rings[0]))
    if len(rings[-1]) > 1:
        faces.append(tuple(rings[-1])[::-1])
    ob = mk(name, verts, faces, m, smooth)
    fixnormals(ob)
    return ob

def fixnormals(ob):
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data); bm.free()

def ell(c, rx, ry, rd, m, seg=20, rot=0.0, name="ell"):
    """ellipsoid at icon point c=(x,y,d); rot turns it in the picture plane (degrees)"""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=max(8, seg // 2), radius=1)
    bm.to_mesh(me); bm.free()
    me.transform(Matrix.Diagonal((rx * S, rd * S, ry * S, 1)))
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    ob.data.materials.append(m)
    ob.location = V(*c) if len(c) == 3 else V(c[0], c[1])
    ob.rotation_euler = (0, math.radians(rot), 0)
    bpy.context.scene.collection.objects.link(ob)
    OBJS.append(ob)
    return ob

def ball(c, r, m, seg=14):
    return ell(c, r, r, r, m, seg)

def torus(c, R, r, m, axis=(0, 1, 0), seg=24, ring=8, sx=1.0, sy=1.0):
    """axis in icon terms (x, y-down, d): (0,0,1) faces the viewer, (0,1,0) lies flat"""
    verts, faces = [], []
    for i in range(seg):
        a = TAU * i / seg
        for j in range(ring):
            b = TAU * j / ring
            rr = R + r * math.cos(b)
            verts.append(Vector((rr * math.cos(a) * sx * S, rr * math.sin(a) * sy * S, r * math.sin(b) * S)))
    for i in range(seg):
        for j in range(ring):
            faces.append((i * ring + j, ((i + 1) % seg) * ring + j, ((i + 1) % seg) * ring + (j + 1) % ring, i * ring + (j + 1) % ring))
    ob = mk("torus", verts, faces, m)
    ax = Vector((axis[0], -axis[2], -axis[1])).normalized()
    ob.rotation_euler = ax.to_track_quat("Z", "Y").to_euler()
    ob.location = V(*c) if len(c) == 3 else V(c[0], c[1])
    return ob

def slab(poly, m, d=0.0, thick=4.0, bevel=1.2, name="slab"):
    """extruded rounded plate from an icon-space polygon, facing the viewer, centred at depth d"""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "2D"
    cu.fill_mode = "BOTH"
    b = min(bevel, thick * 0.45)
    cu.bevel_depth = b * S
    cu.bevel_resolution = 2
    cu.extrude = max(0.0002, (thick / 2 - b) * S)
    sp = cu.splines.new("POLY")
    sp.points.add(len(poly) - 1)
    for i, (x, y) in enumerate(poly):
        sp.points[i].co = ((x - 60) * S, (80 - y) * S, 0, 1)
    sp.use_cyclic_u = True
    ob = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob); bpy.data.curves.remove(cu)
    me.transform(Matrix.Rotation(math.radians(90), 4, "X"))
    me.transform(Matrix.Translation((0, -d * S, 0)))
    mo = bpy.data.objects.new(name, me)
    mo.data.materials.append(m)
    bpy.context.scene.collection.objects.link(mo)
    try:
        bpy.context.view_layer.objects.active = mo
        bpy.ops.object.select_all(action="DESELECT"); mo.select_set(True)
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))
    except Exception:
        pass
    OBJS.append(mo)
    return mo

def cut(ob, polys, d0=-60, d1=60):
    """punch prisms (icon polygons) through ob between depths d0..d1"""
    bm = bmesh.new()
    for poly in polys:
        lo = [bm.verts.new(V(x, y, d0)) for x, y in poly]
        hi = [bm.verts.new(V(x, y, d1)) for x, y in poly]
        bm.faces.new(lo); bm.faces.new(list(reversed(hi)))
        n = len(poly)
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("cut"); bm.to_mesh(me); bm.free()
    co = bpy.data.objects.new("cut", me)
    bpy.context.scene.collection.objects.link(co)
    mod = ob.modifiers.new("cut", "BOOLEAN")
    mod.operation = "DIFFERENCE"; mod.object = co; mod.solver = "EXACT"
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(co)

def circle(cx, cy, r, n=20, ry=None, a0=0):
    ry = ry or r
    return [(cx + r * math.cos(a0 + TAU * i / n), cy - ry * math.sin(a0 + TAU * i / n)) for i in range(n)]

def rect(x0, y0, x1, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]

def turn(objs, deg, cx=60, cy=80, d=0, axis="Y"):
    """rotate objects in the picture plane (axis Y, +deg = clockwise on screen) or about vertical (Z)"""
    bpy.context.view_layer.update()
    piv = V(cx, cy, d)
    M = Matrix.Translation(piv) @ Matrix.Rotation(math.radians(deg), 4, axis) @ Matrix.Translation(-piv)
    for o in objs:
        o.matrix_world = M @ o.matrix_world

def since(n):
    return OBJS[n:]

def polar(cx, cy, r, a):
    a = math.radians(a)
    return (cx + r * math.cos(a), cy - r * math.sin(a))

def flame(x, y, h, w, d=0.0, lean=0.0):
    """three nested glowing teardrops, base at (x,y)"""
    for k, (col, s, dd) in enumerate((("#f0582a", 1.0, 0), ("#ff9a2e", .72, .55), ("#ffe27a", .45, .95))):
        hh, ww = h * s, w * s
        prof = [(0, y - hh)]
        for i in range(1, 12):
            t = i / 12
            prof.append((ww * math.sin(math.pi * t ** 1.6) ** 0.8 * (0.35 + 0.65 * t), y - hh + hh * t))
        prof.append((0, y))
        lathe(prof, x, mat(col, "glow"), d0=d + w * dd, seg=16, sd=.7,
              xoff=lambda yy, hh=hh: lean * ((y - yy) / hh) ** 2 * hh * .25)

# ---------------------------------------------------------------- palette

GOLD = "#e0b35a"; GOLD2 = "#c8973a"; DARKW = "#4a2717"; MAROON = "#7a1f1f"; CREAM = "#f6e7c8"
RED = "#d0302f"; BLUE = "#3f7fd0"; GREEN = "#3f9a5e"; BLACK = "#1d1a22"
gold = lambda: mat(GOLD, "gold")
gold2 = lambda: mat(GOLD2, "gold")

def blade_poly(base_y, tip_y, cx, luk, amp, wb, gandhik=4, n=36, pw=.55):
    L, R = [], []
    for i in range(n + 1):
        t = i / n
        y = base_y + (tip_y - base_y) * t
        x = cx + amp * math.sin(math.pi * luk * t) * (1 - 0.35 * t)
        w = wb * (1 - t) ** pw
        extra = gandhik * max(0, 1 - t / 0.16)
        L.append((x - w, y)); R.append((x + w + extra, y))
    return L + R[::-1][1:]

def ganja(cx, b, dirn=1, d=0.0):
    """the keris crosspiece; dirn=1: blade above (tip up). sirah cecak on the gandhik (right) side"""
    pts = [(-16, 1.5), (-20, 0), (-16, -1.5), (6, -3), (12, -2.2), (15, -4), (19.5, -3.4), (21, -1), (19, 2.5), (12, 3.2)]
    poly = [(cx + x, b + y * dirn) for x, y in pts]
    if dirn < 0:
        poly = poly[::-1]
    return slab(poly, mat("#2d2b33", "metal"), d=d, thick=7, bevel=1.6)

def ukiran(cx, top, dirn=1, d=0.0, wood="#5a2e1a"):
    """Solo 'tunggak semi' hilt: waisted, swelling, head bent toward the gandhik side.
    top = where it meets the mendak; dirn=1 grows downward"""
    L = 40
    prof = [(4.6, 0), (6.2, 5), (5.0, 11), (6.6, 18), (8.2, 26), (7.8, 32), (6.0, 37), (3.0, 39.5), (0, 40)]
    prof = [(r, top + dirn * y) for r, y in prof]
    if dirn < 0:
        prof = prof[::-1]
    lathe(prof, cx, mat(wood, "grain", "#3b1d0f", 6), d0=d, seg=18, sd=.8,
          xoff=lambda yy: 7 * (abs(yy - top) / L) ** 2.2)
    for k in (11, 31):
        torus((cx + 7 * (k / L) ** 2.2, top + dirn * k, d), 5.6 if k == 11 else 7.7, .9, mat("#2a160b"), seg=18, ring=6)

def mendak(cx, y, d=0.0):
    torus((cx, y, d), 5.2, 2.2, gold(), seg=20)
    for a in range(0, 360, 60):
        p = (cx + 6.2 * math.cos(math.radians(a)), y, d - 6.2 * math.sin(math.radians(a)))
        ball(p, 1.3, mat(RED, "glass"), seg=8)

# ================================================================= items

def blencong():
    g = gold(); g2 = gold2()
    # fan tail of pierced feathers, upright behind the body
    cx, cy = 46, 92
    pts = [(cx + 4, cy + 4)]
    N = 7; a0, a1 = 66, 176
    for k in range(N * 6 + 1):
        a = a0 + (a1 - a0) * k / (N * 6)
        r = 40 + 7 * math.sin(math.pi * (k % 6) / 6)
        pts.append(polar(cx, cy, r, a))
    tail = slab(pts, g2, d=-7, thick=3.4, bevel=1)
    slots = []
    for i in range(N):
        a = a0 + (a1 - a0) * (i + .5) / N
        for r0, r1 in ((14, 25), (28, 39)):
            p0, p1 = polar(cx, cy, r0, a), polar(cx, cy, r1, a)
            nx, ny = math.sin(math.radians(a)) * 1.5, math.cos(math.radians(a)) * 1.5
            slots.append([(p0[0] - nx, p0[1] - ny), (p1[0] - nx, p1[1] - ny), (p1[0] + nx, p1[1] + ny), (p0[0] + nx, p0[1] + ny)])
    cut(tail, slots)
    # near wing, spread down and back
    wx, wy = 56, 98
    pts = [(wx + 6, wy - 6)]
    N = 5; a0, a1 = 150, 228
    for k in range(N * 6 + 1):
        a = a0 + (a1 - a0) * k / (N * 6)
        r = 36 + 7 * math.sin(math.pi * (k % 6) / 6) - 6 * (k / (N * 6))
        pts.append(polar(wx, wy, r, a))
    wing = slab(pts, g, d=15, thick=3.4, bevel=1)
    slots = []
    for i in range(N):
        a = a0 + (a1 - a0) * (i + .5) / N
        p0, p1 = polar(wx, wy, 15, a), polar(wx, wy, 30, a)
        nx, ny = math.sin(math.radians(a)) * 1.4, math.cos(math.radians(a)) * 1.4
        slots.append([(p0[0] - nx, p0[1] - ny), (p1[0] - nx, p1[1] - ny), (p1[0] + nx, p1[1] + ny), (p0[0] + nx, p0[1] + ny)])
    cut(wing, slots)
    # round oil-reservoir body, neck, crowned head, hooked beak
    ell((62, 104, 0), 22, 17, 16, mat(GOLD, "dots", GOLD2, 1.2))
    sweep([(68, 96, 0), (73, 82, 0), (79, 70, 0), (84, 62, 0)], [8.5, 7.5, 6.8, 6.5], g)
    ell((86, 56, 0), 9, 9, 8, g)
    sweep([(93, 52, 0), (100, 53, 0), (105, 59, 0), (103, 68, 0)], [4.5, 3.8, 2.4, .6], g2, h=[3.5, 3, 2, .6])
    for s in (1, -1):
        ball((88, 53, 7 * s), 2.3, mat("#fff8e8"), seg=10)
        ball((89, 53, 8.6 * s), 1.3, mat(BLACK), seg=8)
    torus((86, 48.5, 0), 7, 1.6, g2, axis=(0, 1, 0), seg=18, ring=6)
    for i, x in enumerate((80, 86, 92)):
        cyl((x, 48, 0), (x + (x - 86) * .25, 37 if i == 1 else 40, 0), 2.6, .3, g, seg=10)
    ball((86, 47, 7), 2, mat(RED, "glass"), seg=10)
    # chain and S-hook
    sweep([(64, 25, 0), (64, 14, 0), (65.5, 8.5, 0), (69.5, 7, 0), (72.5, 9.5, 0), (71.5, 13.5, 0)], 1.9, g2, seg=8)
    y, k = 27, 0
    while y < 86:
        torus((64, y, 0), 3.0, 1.15, g2, axis=(0, 0, 1) if k % 2 == 0 else (1, 0, 0), seg=14, ring=6, sy=1.6)
        y += 6.6; k += 1
    # oil pan at the breast with the flame
    cyl((80, 110, 2), (90, 110, 2), 2, 1.6, g2, seg=8)
    lathe([(0, 115), (6, 114.5), (9.5, 112), (10.5, 109.5), (9.5, 109.5)], 92, g2, d0=2, seg=20)
    flame(92, 110, 30, 7, d=2, lean=.2)
    # feet
    for x0, x1 in ((56, 53), (66, 68)):
        sweep([(x0, 118, 0), (x1, 126, 0), (x1 + 2, 130, 0)], [2.6, 2.2, 1.4], g2, seg=8)

def kayon():
    out = path((60, 6), [((63, 16), (74, 28), (86, 44)), ((98, 60), (104, 80), (104, 100)),
                         ((104, 118), (100, 132), (96, 146))], n=10)
    out = out + mirror(out)[:-1]
    sc = lambda pts, k, cx=60, cy=100: [(cx + (x - cx) * k, cy + (y - cy) * k) for x, y in pts]
    slab(sc(out, 1.045, 60, 120), mat("#c4372b"), d=-4, thick=3, bevel=1)       # red flame back
    slab(out, gold(), d=0, thick=4, bevel=1.4)
    field = sc(out, .89, 60, 112)
    slab(field, mat("#f4e5bb", "dots", "#a87838", 1.6), d=2.4, thick=1.8, bevel=.6)
    br = mat("#6a4020"); g2 = gold2(); leaf = mat(GREEN); blu = mat(BLUE)
    sweep([(60, 128, 5), (60, 70, 5), (60, 18, 5)], [2.6, 2.0, 1.1], br, seg=8)
    for y, s in ((28, .7), (42, .9), (58, 1.0)):
        for m_ in (1, -1):
            pts = [(60, y, 5), (60 - m_ * 7 * s, y - 6 * s, 5), (60 - m_ * 15 * s, y - 2 * s, 5),
                   (60 - m_ * 15 * s, y + 4 * s, 5), (60 - m_ * 10 * s, y + 5 * s, 5)]
            sweep(pts, [1.5, 1.4, 1.2, 1, .8], g2, seg=6)
            ball((60 - m_ * 10 * s, y + 5 * s, 5.5), 2.0, leaf, seg=8)
            ball((60 - m_ * 8 * s, y - 7 * s, 5.5), 1.6, blu, seg=8)
    ball((60, 16, 5), 2.6, mat(RED, "glass"), seg=10)
    # banteng (left, black) and macan (right, orange) facing each other
    def beast(cx, m_, body, horn):
        ell((cx, 54, 6), 8, 4.5, 3.5, body)
        ball((cx + 8 * m_, 50.5, 6.5), 3.4, body, seg=10)
        for dx in (-5, -2, 3, 6):
            cyl((cx + dx * m_ * .9, 57, 6), (cx + dx * m_, 62, 6), 1.2, 1, body, seg=6)
        sweep([(cx - 8 * m_, 53, 6), (cx - 12 * m_, 50, 6), (cx - 12 * m_, 46, 6)], [1, .8, .6], body, seg=6)
        if horn:
            for dd in (-1.5, 1.5):
                sweep([(cx + 8 * m_, 48, 6 + dd), (cx + 7 * m_, 44, 6 + dd), (cx + 9 * m_, 42, 6 + dd)], [1, .7, .3], mat(CREAM), seg=6)
        else:
            for dd in (-1, 1):
                ball((cx + 7 * m_, 47.5, 6 + dd * 2), 1.2, body, seg=6)
        ball((cx + 9.5 * m_, 49.6, 9.4), .9, mat("#fff8e8"), seg=6)
    beast(37, 1, mat("#2b2830"), True)
    beast(83, -1, mat("#e8892a", "stripe", "#3a1d0c", 1.4), False)
    # kala (banaspati) face on the trunk
    slab(circle(60, 74, 9.5, 22), mat("#c0392b"), d=7, thick=4, bevel=1.5)
    slab([(50, 68), (54, 63), (57, 66), (60, 61), (63, 66), (66, 63), (70, 68), (60, 67)], gold(), d=8, thick=3, bevel=.8)
    for x in (56, 64):
        ball((x, 72, 9.5), 2.7, mat("#fff8e8"), seg=10); ball((x, 72, 12), 1.3, mat(BLACK), seg=8)
    slab(rect(54, 77, 66, 80.5), mat("#3a0d0d"), d=9.5, thick=1.6, bevel=.5)
    for x in (55.5, 64.5):
        cyl((x, 78, 10.5), (x, 83.5, 10.5), 1.3, .2, mat("#fffaf0"), seg=6)
    # two naga heads facing outward above the gate
    for m_ in (1, -1):
        x = 60 - m_ * 22
        ell((x, 90, 6), 7, 4.2, 4, blu, rot=20 * m_)
        cyl((x - 5 * m_, 88, 6), (x - 13 * m_, 84, 6), 3.4, 1.2, blu, seg=10)
        cyl((x - 4 * m_, 92.5, 6), (x - 11 * m_, 94, 6), 2, .8, mat("#2c5aa0"), seg=8)
        for k in range(3):
            cyl((x + (k * 3 - 2) * m_, 86, 6), (x + (k * 3) * m_, 80 - k, 6), 1.6, .3, gold(), seg=6)
        ball((x - 3 * m_, 87.5, 9.8), 1.2, mat("#fff8e8"), seg=6)
    # the gapura: joglo roof, posts, green door, tiled floor
    slab([(36, 112), (60, 94), (84, 112)], mat("#f2c230"), d=6, thick=4, bevel=1)
    slab([(54, 99), (60, 90), (66, 99)], mat(RED), d=7, thick=3, bevel=.8)
    slab(rect(34, 111, 86, 115), mat("#7a4a22"), d=7, thick=3, bevel=.8)
    for x in (46, 74):
        cyl((x, 115, 6), (x, 135, 6), 2.4, 2.4, mat("#5a3218"), seg=10)
    slab([(51, 135), (51, 120), (55, 116), (65, 116), (69, 120), (69, 135)], mat("#5aa04a"), d=4.5, thick=2, bevel=.6)
    slab([(24, 134), (96, 134), (99, 145), (21, 145)], mat("#f2c230", "check", "#d79a1e", 1.2), d=3.5, thick=2, bevel=.6)
    # raksasa guards with clubs
    for m_ in (1, -1):
        x = 60 - m_ * 29
        ell((x, 126, 6), 4.6, 7, 3.6, gold())
        ball((x, 116.5, 7), 4.2, mat("#c0392b"), seg=12)
        ball((x - m_ * 1.5, 116, 11), 1.2, mat("#fff8e8"), seg=6)
        cyl((x + 4 * m_, 131, 8), (x + 8 * m_, 108, 8), 1.4, 2.6, mat("#2b2830"), seg=8)
        ell((x - 4 * m_, 125, 8.5), 3, 4.5, 1.2, mat(BLUE))
    cyl((60, 146, 0), (60, 159, 0), 2.4, 1.6, mat("#3b2116"), seg=10)

def rujakpolo():
    n0 = len(OBJS)
    iron = mat("#50535f", "metal"); g = gold()
    prof = [(0, 7), (5, 9), (11, 16), (17, 27), (21.5, 41), (23, 54), (21, 67), (17, 77), (12, 84), (9, 86)]
    lathe(prof, 60, iron, seg=32, rmod=lambda th, y: 1 + 0.07 * math.cos(8 * th), smooth=True)
    for y, r in ((41, 22.4), (54, 23.6), (67, 21.6)):
        torus((60, y), r, 2, g, axis=(0, 1, 0), seg=32, ring=6)
    for k in range(8):   # gold tumpal triangles on the middle band
        th = TAU * (k + .5) / 8
        if math.sin(th) < -0.2:
            continue
        x, d = 60 + 23.4 * math.cos(th), -23.4 * math.sin(th)
        cyl((x, 52, d), (x, 46, d), 2.2, .3, g, seg=6)
    ball((60, 6, 0), 4.4, g); cyl((60, 4, 0), (60, -3, 0), 2.4, .3, g, seg=8)
    lathe([(9, 85), (13, 88), (12, 92), (7.5, 95)], 60, g, seg=24)
    cyl((60, 94, 0), (60, 140, 0), 6.2, 6.6, mat(DARKW, "grain", "#2e170c", 5), seg=16)
    hel = []
    for i in range(60):
        t = i / 59; a = t * 5 * TAU
        hel.append((60 + 6.8 * math.cos(a), 100 + 36 * t, -6.8 * math.sin(a)))
    sweep(hel, 1.3, g, seg=6)
    for y in (99, 137):
        torus((60, y), 7, 2, g, axis=(0, 1, 0), seg=20, ring=6)
    ball((60, 146, 0), 8, g)
    turn(since(n0), 18)

def pancanaka():
    skin = mat("#d9a84e", "gold")
    cyl((56, 104, -4), (16, 158, -4), 1.8, 2.2, mat("#6a4020", "grain", "#3b2116", 5), seg=8)   # cempurit rod
    sweep([(36, 134, 0), (40, 127, 0), (47, 116, 0)], [10.5, 10.8, 11.5], skin, seg=16)
    n1 = len(OBJS)
    lathe([(9.5, 73), (13.5, 75), (14.5, 80), (13.5, 85), (9.5, 87)], 60, mat(RED), seg=24)
    for off in (-6.5, 6.5):
        torus((60, 80 + off), 12.6, 1.6, gold(), axis=(0, 1, 0), seg=24, ring=6)
    for k in range(6):   # flared naga-petal ornaments around the bracelet
        th = TAU * k / 6
        ell((60 + 14 * math.cos(th), 80, -14 * math.sin(th)), 2.2, 4.6, 2.2, mat(BLUE if k % 2 else "#e8e2d4"), seg=10)
    bpy.context.view_layer.update()
    rotm = Matrix.Translation(V(39, 131, 0)) @ Matrix.Rotation(math.atan2(11, 18), 4, "Y") @ Matrix.Translation(-V(60, 80, 0))
    for o in since(n1):
        o.matrix_world = rotm @ o.matrix_world
    ell((62, 100, 0), 19, 17, 13, skin)
    for i in range(4):
        y = 87 + i * 9.4
        sweep([(62, y, 3 - i), (80, y - 2, 3 - i), (89, y + 3.5, 3 - i), (84, y + 8, 3 - i)],
              [5, 5, 4.8, 4.4], skin, seg=12)
        ell((84.5, y + 7.5, 7 - i), 1.8, 1.5, .8, mat("#f0d79a"), seg=8)
    sweep([(48, 94, 8), (58, 84, 10), (69, 76, 10), (78, 70, 9)], [6.5, 6.2, 5.8, 5.3], skin, seg=12)
    torus((79, 69.5, 9), 5.2, 1.4, gold(), axis=(1, -.7, 0), seg=16, ring=6)
    pts = cubic((80, 67, 9), (83, 42, 8), (106, 22, 5), (114, 46, 3), n=24)
    rs = [5.6 * (1 - i / 24) ** .9 + .3 for i in range(25)]
    sweep(pts, rs, mat("#d32a26", "glass"), seg=12, h=[r * .75 for r in rs])
    edge = cubic((79, 66, 12.5), (82, 46, 11.5), (100, 30, 8), (108, 32, 6.5), n=16)
    sweep(edge, [1.2 * (1 - i / 20) for i in range(17)], gold(), seg=6)
    ell((81.5, 64, 9.5), 3.6, 2.6, 3.4, mat("#fff2dc"), seg=12)

def keris_cakil():
    n0 = len(OBJS)
    cx, b = 42, 100
    slab(blade_poly(b, 10, cx, 7, 3.6, 10.5, 6), mat("#3a3d48", "wave", "#8e97ab", 1.6), d=0, thick=3.2, bevel=1)
    ganja(cx, b + 2)
    mendak(cx, b + 7.5)
    ukiran(cx, b + 10, 1)
    # red gayaman warangka beside it
    top = path((64, 66), [((72, 60), (90, 58), (104, 60)), ((110, 61), (115, 64), (114, 68)),
                          ((104, 74), (96, 78), (90, 78)), ((80, 78), (70, 74), (64, 66))], n=10)
    n1 = len(OBJS)
    lac = mat("#b3262a")
    slab(top, lac, d=0, thick=8, bevel=2.6)
    sweep([(66, 69, 3.4), (80, 76, 3.4), (100, 75, 3.4), (112, 68, 3.4)], .9, gold(), seg=6)
    sweep([(89, 76, 0), (90, 112, 0), (91, 150, 0)], [6.2, 5.2, 3.6], lac, seg=14, h=[3.8, 3.4, 2.6])
    sweep([(89.4, 92, 0), (90.2, 120, 0), (91, 146, 0)], [6.6, 5.6, 4.1], mat(GOLD, "dots", GOLD2, 2), seg=14, h=[4.2, 3.8, 3.1])
    ball((91, 150, 0), 3.6, gold())
    for o in since(n1):
        o.location.y += 24 * S
    turn(since(n1), -34, 90, 100)
    turn(since(n1), 0)
    for o in since(n1):
        o.location.x -= 14 * S
    turn(since(n0), 8)

def kentongan():
    wood = mat("#a8652f", "grain", "#7d4522", 5)
    prof = [(0, 139), (22, 139), (24.5, 128), (25.5, 86), (24.5, 44), (23, 36), (0, 36)]
    log = lathe(prof, 58, wood, seg=36)
    cut(log, [[polar(58, 60, 4.2, a) for a in range(0, 181, 15)] + [polar(58, 118, 4.2, a) for a in range(180, 361, 15)]], d0=3, d1=60)
    lathe([(0, 35.4), (19, 35.4), (19, 36)], 58, mat("#1c0e05"), seg=28)
    slab(rect(55.5, 58, 60.5, 120), mat("#1c0e05"), d=3.5, thick=2, bevel=.4)
    rat = mat("#d8b46a", "check", "#a8803e", 3)
    for y in (44, 50, 124, 130):
        torus((58, y), 25.4, 2.6, rat, axis=(0, 1, 0), seg=32, ring=8)
    sweep([(42, 38, 0), (50, 22, 0), (58, 12, 0), (66, 22, 0), (74, 38, 0)], 1.6, mat(CREAM, "stripe", "#cdb487", 4), seg=8)
    torus((58, 9), 3.6, 1.4, gold2(), axis=(0, 0, 1), seg=14, ring=6)
    cyl((70, 154, 14), (98, 108, 14), 3, 3.2, mat("#7d4522", "grain", "#5a2e14", 6), seg=10)
    ball((100, 104, 14), 8, mat(MAROON))

def dadu():
    bone = mat("#f1e4c6", "dots", "#e2cfa6", .7)
    def die(h, center, rx, rz, faces):
        n0 = len(OBJS)
        sq = [(60 - h, 80 - h), (60 + h, 80 - h), (60 + h, 80 + h), (60 - h, 80 + h)]
        slab(sq, bone, d=0, thick=2 * h, bevel=h * .32)
        ring, dot = mat("#b3262a"), mat("#2a1608")
        for (fx, fy, fd), pips in faces:
            for u, v in pips:
                # face local -> icon coords
                if fd:      # front (+d)
                    p = (60 + u * h * .62, 80 + v * h * .62, h)
                    ax = (0, 0, 1)
                elif fx:    # right
                    p = (60 + h, 80 + v * h * .62, -u * h * .62)
                    ax = (1, 0, 0)
                else:       # top
                    p = (60 + u * h * .62, 80 - h, -v * h * .62)
                    ax = (0, -1, 0)
                torus(p, h * .23, h * .07, ring, axis=ax, seg=14, ring=5)
                ball(p, h * .1, dot, seg=8)
        objs = since(n0)
        bpy.context.view_layer.update()
        piv = V(60, 80, 0)
        M = (Matrix.Translation(V(*center)) @ Matrix.Rotation(math.radians(rz), 4, "Z") @
             Matrix.Rotation(math.radians(rx), 4, "X") @ Matrix.Translation(-piv))
        for o in objs:
            o.matrix_world = M @ o.matrix_world
    five = [(-1, -1), (1, -1), (0, 0), (-1, 1), (1, 1)]
    three = [(-1, -1), (0, 0), (1, 1)]
    two = [(-1, -1), (1, 1)]
    four = [(-1, -1), (1, -1), (-1, 1), (1, 1)]
    die(17, (52, 112, 0), 24, -34, [((0, 0, 1), five), ((1, 0, 0), three), ((0, 1, 0), four)])
    die(12, (72, 54, 0), 30, -18, [((0, 0, 1), two), ((1, 0, 0), [(0, 0)]), ((0, 1, 0), three)])

def tirta():
    g = gold()
    lathe([(0, 146), (13, 146), (14, 143), (10, 138), (9, 134)], 60, gold2(), seg=28)
    bowl = [(9, 134), (22, 130), (34, 123), (41, 114), (44, 106), (45, 103), (41, 103.5)]
    lathe(bowl, 60, g, seg=40, rmod=lambda th, y: 1 + (0.035 * abs(math.cos(6 * th)) if y > 112 else 0))
    torus((60, 112), 43.2, 1.8, mat(RED), axis=(0, 1, 0), seg=40, ring=6)
    for k in range(12):   # lotus petals chased on the bowl
        th = TAU * (k + .5) / 12
        if math.sin(th) < -0.3:
            continue
        x, d = 60 + 37 * math.cos(th), -37 * math.sin(th)
        ell((x, 122, d), 4, 6, 2, gold2(), seg=10)
    lathe([(0, 106), (41, 106), (41, 105)], 60, mat("#3fb0d0", "glass"), seg=40)
    torus((60, 105.5), 9, .9, mat("#bdf3ff", "glass"), axis=(0, 1, 0), seg=24, ring=5)
    drop = [(0, 12), (3, 20), (8, 32), (14, 44), (18, 54), (19.5, 62), (18, 70), (13, 77), (6, 80.5), (0, 81.5)]
    lathe(drop, 60, mat("#5fd0ec", "glass"), seg=28, sd=.8)
    ell((53, 56, 14), 3.4, 8, 1.6, mat("#ffffff", "glow"), seg=10)
    lathe([(0, 87), (1.5, 89.5), (3, 93), (2.6, 95.5), (0, 97)], 60, mat("#5fd0ec", "glass"), seg=12)
    for x, y, r in ((92, 32, 2.4), (28, 46, 2), (96, 74, 1.6), (24, 84, 1.4)):
        ball((x, y, 0), r, mat("#e9fbff", "glow"), seg=8)

def pulanggeni():
    n0 = len(OBJS)
    cx = 60
    wood = mat("#7a3f1c", "grain", "#4e2410", 5)
    lad = path((14, 58), [((22, 68), (34, 71), (46, 71)), ((80, 71),), ((92, 71), (100, 66), (106, 58)),
                          ((109, 70), (100, 80), (88, 82)), ((32, 82),), ((20, 80), (12, 72), (14, 58))], n=10)
    slab(lad, wood, d=0, thick=12, bevel=3.5)
    slab(path((22, 72), [((40, 77), (80, 77), (98, 72))], n=10) + path((98, 74), [((80, 80), (40, 80), (22, 74))], n=10),
         gold(), d=6.2, thick=1.4, bevel=.5)
    sweep([(cx, 81, 0), (cx, 118, 0), (cx + 1, 152, 0)], [6.6, 5.6, 4.2], wood, seg=14, h=[4.4, 4, 3.2])
    sweep([(cx, 92, 0), (cx, 118, 0), (cx + 1, 148, 0)], [7, 6, 4.7], gold(), seg=14, h=[4.8, 4.4, 3.6])
    ball((cx + 1, 152, 0), 3.6, gold())
    for y, s in ((104, 1.0), (122, .85), (138, .7)):   # geni (fire) motif on the pendhok
        fl = [(cx, y + 6 * s), (cx - 4 * s, y + 2 * s), (cx - 3 * s, y - 3 * s), (cx - 1, y - 1),
              (cx, y - 8 * s), (cx + 1, y - 1), (cx + 3 * s, y - 4 * s), (cx + 4 * s, y + 2 * s)]
        slab(fl, mat("#e2452a"), d=4.6 * s + .6, thick=1.6, bevel=.5)
    # the keris drawn a little: golden blade base, ganja, mendak, Solo hilt
    bl = [(cx - 9, 48), (cx + 9, 48), (cx + 14, 50), (cx + 12, 56), (cx + 9, 65), (cx - 8, 65), (cx - 8.5, 56)]
    slab(bl, mat("#e8c060", "wave", "#fff0b0", 1.6), d=0, thick=3.4, bevel=1)
    ganja(cx, 46, -1)
    mendak(cx, 40.5)
    ukiran(cx, 38, -1, wood="#6a3518")
    turn(since(n0), 16)

def kalimasada():
    n0 = len(OBJS)
    slab(rect(-6, 70, 126, 92), mat("#5a2e1a", "grain", "#3b1d0f", 4), d=-5, thick=4, bevel=1.4)
    slab(rect(-2, 72.5, 122, 89.5), mat(CREAM, "stripe", "#cdb487", 9), d=0, thick=8, bevel=1.2)
    ink = mat("#2a1608")
    for row, y in enumerate((77, 81, 85)):
        x = 2 + row * 3
        while x < 116:
            w = 4 + (x * 7 % 5)
            if not (24 < x < 38 or 84 < x < 98):
                slab(rect(x, y - .55, x + w, y + .55), ink, d=4.2, thick=.6, bevel=.2)
            x += w + 2.5
    slab(rect(-6, 70, 2, 92), gold(), d=0, thick=10, bevel=1.4)
    slab(rect(118, 70, 126, 92), gold(), d=0, thick=10, bevel=1.4)
    for x in (31, 91):
        sweep([(x, 69, 5), (x, 81, 5.6), (x, 93, 5)], 1.6, mat(MAROON), seg=8)
        ball((x, 81, 5), 2.2, mat(GOLD2, "gold"), seg=8)
    sweep([(31, 93, 5), (34, 104, 6), (46, 110, 6), (52, 120, 5)], 1.6, mat(MAROON), seg=8)
    coin = slab(circle(54, 126, 7.5, 24), gold(), d=5, thick=2, bevel=.6)
    cut(coin, [rect(51.6, 123.6, 56.4, 128.4)])
    turn(since(n0), -58)

def bow_path(segs, start, n=14):
    return path(start, segs, n=n)

def gandewa():
    n0 = len(OBJS)
    pts = bow_path([((54, 8), (46, 14), (36, 26)), ((72, 42), (96, 58), (96, 80)), ((96, 102), (72, 118), (36, 134)),
                    ((46, 146), (54, 152), (66, 150))], (66, 10))
    n = len(pts)
    rs = [2.2 + 2.6 * math.sin(math.pi * i / (n - 1)) ** 1.5 for i in range(n)]
    sweep([(x, y, 0) for x, y in pts], rs, mat(GOLD, "gold"), seg=12)
    for (x0, y0), sgn in (((66, 10), 1), ((66, 150), -1)):
        sp = [(x0 + 6 * math.cos(a) * (1 - a / 11) - 6 + 6, y0 + sgn * (6 * math.sin(a) * (1 - a / 11)), 0)
              for a in [i * .35 for i in range(22)]]
        sp = [(x0 + (1 - t / 21) * 7 * math.sin(t * .42), y0 + sgn * (7 - (1 - t / 21) * 7 * math.cos(t * .42)), 0) for t in range(22)]
        sweep(sp, [2.4 * (1 - t / 26) for t in range(22)], gold2(), seg=8)
    sweep([(36, 26, 0), (36, 80, 0), (36, 134, 0)], .8, mat(CREAM), seg=6)
    cyl((96, 67, 0), (96, 93, 0), 6.4, 6.4, mat(MAROON), seg=16)
    for y in (67, 75, 85, 93):
        torus((96, y), 6.6, 1.3, gold(), axis=(0, 1, 0), seg=16, ring=6)
    ell((96, 80, 6.8), 2.4, 3.6, 1.4, mat(RED, "glass"), seg=10)
    turn(since(n0), -12)

def wijayakusuma():
    green = mat("#4f8a3c"); g2 = mat("#3f7a32")
    # flat scalloped cladode, rising from bottom left
    cl = cubic((10, 156), (40, 140), (70, 128), (110, 92), n=40)
    L, R = [], []
    for i, (x, y) in enumerate(cl):
        t = i / 40
        x2, y2 = cl[min(i + 1, 40)]; x1, y1 = cl[max(i - 1, 0)]
        dx, dy = x2 - x1, y2 - y1; ln = math.hypot(dx, dy)
        nx, ny = -dy / ln, dx / ln
        w = 13 * math.sin(math.pi * min(1, t * 1.05)) ** .6 + .5
        sc = 3.2 * abs(math.sin(t * math.pi * 6)) * (t > .05) * (t < .95)
        L.append((x + nx * (w - sc), y + ny * (w - sc))); R.append((x - nx * (w - sc * .6), y - ny * (w - sc * .6)))
    slab(L + R[::-1], green, d=-4, thick=3.6, bevel=1.4)
    sweep([(x, y, -1.6) for x, y in cl[2:-2]], [1.1] * 37, g2, seg=6)
    # long arching floral tube from a notch of the cladode to the flower
    tube = cubic((52, 132, -2), (40, 108, 0), (40, 84, 4), (56, 64, 8), n=16)
    sweep(tube, [2.6 + 3.4 * (i / 16) ** 2 for i in range(17)], mat("#b9795a"), seg=12)
    for i in (4, 8, 12):
        x, y, d = tube[i]
        cyl((x, y, d), (x + 5, y - 3, d + 1), 1.2, .2, mat("#9a5a40"), seg=6)
    # the flower: spiky star of long narrow petals, facing the viewer
    fx, fy, fd = 62, 50, 12
    def ring(n, L, w, col, a0, dd, tilt):
        m_ = mat(col)
        for k in range(n):
            a = a0 + 360 * k / n
            pts = []
            for i in range(7):
                t = i / 6
                r = 5 + (L - 5) * t
                pts.append((fx + r * math.cos(math.radians(a)), fy - r * math.sin(math.radians(a)), fd + dd - tilt * t * t))
            ws = [w * (.5 + 1.3 * t * (1 - t) * 2) * (1 - t ** 3) + .25 for t in [i / 6 for i in range(7)]]
            sweep(pts, ws, m_, seg=8, h=[.8] * 7)
    ring(14, 40, 1.4, "#c98a6a", 6, -3, 8)
    ring(16, 38, 2.4, "#efe6d2", 0, -1, 6)
    ring(14, 31, 3.4, "#fffdf6", 12, 1, 3)
    lathe([(0, fy - 1), (7, fy), (5, fy + 3)], fx, mat("#fff8e0"), d0=fd, seg=16, sd=.5)
    for k in range(14):
        a = TAU * k / 14
        r = 7 + 3 * (k % 3)
        p = (fx + r * math.cos(a), fy - r * math.sin(a) * .8, fd + 6)
        sweep([(fx, fy, fd + 1), ((fx + p[0]) / 2, (fy + p[1]) / 2, fd + 5), p], .45, mat("#fffbe8"), seg=5)
        ball(p, 1.1, mat("#f2cf5e"), seg=6)
    sweep([(fx, fy, fd), (fx - 2, fy - 4, fd + 8), (fx - 3, fy - 8, fd + 12)], .8, mat("#fffbe8"), seg=6)
    ball((fx - 3, fy - 8, fd + 12), 2, mat("#fff6c8"), seg=8)

def kendhi():
    clay = mat("#b8613a", "dots", "#c9764b", .8)
    clay2 = mat("#8e4426")
    ball((94, 88, -2), 15, clay)
    ball((104.5, 78.5, -2), 4.6, clay)
    body = [(0, 148), (14, 147.5), (16, 145), (14, 143), (26, 138), (35, 128), (39, 112), (37, 98), (31, 88), (22, 81), (12, 77.5)]
    lathe(body, 56, clay, seg=40)
    torus((56, 77.5), 12, 2, clay2, axis=(0, 1, 0), seg=24, ring=6)
    neck = [(12, 77), (9.5, 70), (7.6, 60), (7, 48), (8, 40), (11, 36), (19, 33), (20, 31), (12, 30), (8, 27.5), (4, 26.5), (0, 26)]
    lathe(neck, 56, clay2, seg=28, rmod=lambda th, y: 1 + (0.06 * math.cos(16 * th) if y > 66 else 0))
    # incised zigzag band and lines on the shoulder
    zz = []
    for i in range(37):
        th = math.pi * (-0.05 + 1.1 * i / 36)
        y = 92 if i % 2 == 0 else 99
        r = {92: 34, 99: 36.9}[y]
        zz.append((56 + r * math.cos(th), y, -r * math.sin(th) * -1))
    sweep(zz, .9, mat(CREAM), seg=5)
    for y, r in ((89.5, 32.4), (101.5, 37.6), (118, 39.4)):
        torus((56, y), r, .8, mat("#f0d2b0"), axis=(0, 1, 0), seg=40, ring=5)

def gada_inten():
    n0 = len(OBJS)
    g = gold()
    prof = [(0, 13), (8, 19), (17, 29), (21.5, 48), (20, 68), (12, 85), (8, 89)]
    lathe(prof, 60, g, seg=8, smooth=False, rmod=lambda th, y: 1.0)
    turn(since(n0), 22.5, 60, 50, 0, axis="Z")
    def gem(x, y, d, r, col):
        ell((x, y, d), r, r * 1.2, r * .55, mat(col, "glass"), seg=12)
        torus((x, y, d - .5), r + .4, .7, gold2(), axis=(0, 0, 1), seg=14, ring=5)
    gem(60, 49, 20.6, 5.4, RED)
    gem(60, 72, 16.5, 3.6, BLUE)
    for s in (1, -1):
        gem(60 + 14.5 * s, 48, 14.5, 3.2, "#2f9a62")
    for k in range(5):
        a = -60 + 30 * k
        x = 60 + 6 * math.sin(math.radians(a))
        cyl((x, 15, -6 * math.cos(math.radians(a)) * 0), (x + (x - 60) * .6, 3, 0), 2.4, .3, g, seg=8)
    ball((60, 11, 0), 3.4, mat(RED, "glass"), seg=10)
    lathe([(8, 88), (12, 91), (8, 96)], 60, gold2(), seg=16)
    cyl((60, 96, 0), (60, 138, 0), 6, 6, mat(MAROON), seg=16)
    for y in (104, 112, 120, 128):
        torus((60, y), 6.3, 1.3, g, axis=(0, 1, 0), seg=16, ring=6)
    lathe([(0, 138), (8, 146), (0, 156)], 60, g, seg=4, smooth=False)
    turn(since(n0), -18)

def pasopati():
    n0 = len(OBJS)
    cyl((60, 44, 0), (60, 146, 0), 2.4, 2.4, mat("#c58a52", "grain", "#9a6232", 5), seg=10)
    cres = path((30, 6), [((30, 32), (44, 42), (60, 42)), ((76, 42), (90, 32), (90, 6)),
                          ((82, 22), (72, 30), (60, 30)), ((48, 30), (38, 22), (30, 6))], n=12)
    slab(cres, mat("#f0c76a", "gold"), d=0, thick=5, bevel=1.8)
    lathe([(3, 38), (6, 42), (5.5, 48), (3, 52)], 60, gold2(), seg=16)
    for s in (1, -1):   # naga-curl collar
        sp = [(60 + s * (5 + 7 * math.sin(t * .4) * (1 - t / 22)), 46 - 7 * (1 - math.cos(t * .4)) * (1 - t / 22) + 2, 0) for t in range(18)]
        sweep(sp, [2.0 * (1 - t / 24) for t in range(18)], gold(), seg=8)
    ball((60, 46, 3.5), 2.2, mat(RED, "glass"), seg=10)
    white = mat("#eeeae0", "stripe", "#b9b4aa", 7)
    for s in (1, -1):
        vane = [(60, 112), (60 + 15 * s, 124), (60 + 16 * s, 140), (60 + 13 * s, 148), (60, 138)]
        slab(vane if s < 0 else vane[::-1], white, d=0, thick=1.6, bevel=.6)
    slab([(60, 112), (62, 124), (63, 138), (60, 144), (57, 138), (58, 124)], mat("#9b958a"), d=1.5, thick=1.4, bevel=.5)
    lathe([(2.6, 146), (3, 150), (1, 152)], 60, gold(), seg=10)
    turn(since(n0), 28)

def guwawijaya():
    n0 = len(OBJS)
    pts = cubic((28, 22), (72, 30), (100, 52), (100, 80), n=20) + cubic((100, 80), (100, 108), (72, 130), (28, 138), n=20)[1:]
    pts = [(x, y, 0) for x, y in pts]
    n = len(pts)
    rs = [4.4 + 3.2 * math.sin(math.pi * i / (n - 1)) for i in range(n)]
    sweep(pts, rs, mat(MAROON), seg=14)
    # a gold cord wound around the limbs
    hel = []
    for i in range(n * 4):
        t = i / (n * 4 - 1); j = t * (n - 1); a = int(j); f_ = j - a; a = min(a, n - 2)
        x = pts[a][0] + (pts[a + 1][0] - pts[a][0]) * f_
        y = pts[a][1] + (pts[a + 1][1] - pts[a][1]) * f_
        dx, dy = pts[a + 1][0] - pts[a][0], pts[a + 1][1] - pts[a][1]
        ln = math.hypot(dx, dy); nx, ny = -dy / ln, dx / ln
        r = rs[a] + .4
        ang = t * 34 * TAU
        hel.append((x + nx * r * math.cos(ang), y + ny * r * math.cos(ang), r * math.sin(ang)))
    sweep(hel, 1.1, gold(), seg=6)
    for (x, y), s in (((28, 22), 1), ((28, 138), -1)):
        fin = [(x, y), (x - 6, y - 10 * s), (x - 15, y - 9 * s), (x - 19, y - 2 * s), (x - 12, y + 0 * s), (x - 8, y + 5 * s)]
        slab(fin if s > 0 else fin[::-1], gold(), d=0, thick=3, bevel=1)
        ball((x - 1, y, 0), 5.2, mat(RED, "glass"))
    sweep([(28, 22, 0), (28, 80, 0), (28, 138, 0)], .9, mat(CREAM), seg=6)
    cyl((100, 64, 0), (100, 96, 0), 8.6, 8.6, gold(), seg=18)
    ell((100, 80, 8.8), 3.6, 5.6, 1.8, mat(RED, "glass"), seg=10)
    for y in (64, 96):
        torus((100, y), 8.8, 1.6, gold2(), axis=(0, 1, 0), seg=18, ring=6)
    turn(since(n0), -6)

def ampal():
    g = gold()
    band = torus((60, 110, 0), 30, 6.2, g, axis=(.85, 0, .55), seg=40, ring=12, sx=1, sy=1.08)
    lathe([(6, 94), (11, 90), (15, 84), (16.5, 78), (15.5, 75)], 60, g, seg=28)
    for k in range(18):
        a = TAU * k / 18
        ball((60 + 16 * math.cos(a), 75.5, -16 * math.sin(a)), 1.3, gold2(), seg=8)
    ell((60, 73, 0), 12.5, 9.5, 12.5, mat("#c8282a", "glass"), seg=24)
    ell((55, 68, 9), 3, 2, 1.2, mat("#ffffff", "glow"), seg=8)
    for s in (1, -1):   # leaf / flame motifs on the shoulders
        sweep([(60 + s * 13, 90, 4), (60 + s * 19, 94, 6), (60 + s * 21, 101, 7), (60 + s * 17, 104, 6)],
              [2.6, 2.6, 2, .8], gold2(), seg=8)
        sweep([(60 + s * 12, 92, 2), (60 + s * 15, 100, 4), (60 + s * 13, 106, 4)], [1.6, 1.4, .6], gold2(), seg=8)

def poleng():
    nx, ny = 28, 26
    verts, faces = [], []
    for j in range(ny + 1):
        for i in range(nx + 1):
            u = i / nx; v = j / ny
            x = 18 + 84 * u
            fr = ((x - 18) / 14) % 1
            yend = 134 + 7 * math.sin(math.pi * fr)
            y = 20 + (yend - 20) * v
            d = 6 * math.sin(u * 3 * math.pi + .4) * (0.25 + 0.75 * v) + 4.5 * (1 - v) ** 4
            verts.append(V(x, y, d))
    for j in range(ny):
        for i in range(nx):
            a = j * (nx + 1) + i
            faces.append((a, a + 1, a + nx + 2, a + nx + 1))
    cl = mk("cloth", verts, faces, mat("#f3efe6", "poleng", None, 11))
    sm = cl.modifiers.new("s", "SOLIDIFY"); sm.thickness = 0.012; sm.offset = 0
    hem = [verts[ny * (nx + 1) + i] for i in range(0, nx + 1)]
    sweep([((h.x / S) + 60, 80 - h.z / S, -h.y / S) for h in hem], 1.4, gold(), seg=6, caps=True)
    wood = mat("#4a2717", "grain", "#2e170c", 4)
    cyl((8, 19, 4), (112, 19, 4), 4.6, 4.6, wood, seg=16)
    for x in (6, 114):
        ball((x, 19, 4), 6.4, gold())
        ball((x + (-3 if x < 60 else 3), 19, 4), 2.4, mat(RED, "glass"), seg=8)
    torus((60, 26, 2.5), 3.4, 1.2, gold2(), axis=(0, 0, 1), seg=12, ring=5)

def konde():
    hair = mat("#221c2a", "wave", "#4a3d5c", 2.5)
    ell((62, 114, 0), 30, 22, 20, hair)
    strand = mat("#4f4266")
    for k in range(9):   # hair swept round into the knot
        a0 = math.radians(200 + k * 17)
        sp = []
        for i in range(14):
            t = i / 13
            a = a0 + t * 2.2
            r = 1 - .78 * t
            x, y = 62 + 29 * r * math.cos(a), 114 - 21 * r * math.sin(a)
            dd = 20 * math.sqrt(max(0.02, 1 - ((x - 62) / 30) ** 2 - ((y - 114) / 22) ** 2)) + .8
            sp.append((x, y, dd))
        sweep(sp, [1.3 - .6 * i / 13 for i in range(14)], strand, seg=6)
    # gold pin through the bun up to the jewel
    sweep([(96, 150, 6), (74, 104, 12), (52, 52, 14)], [1.0, 2.0, 2.6], gold(), seg=10)
    jx, jy, jd = 50, 46, 16
    for k in range(8):
        a = 90 + 45 * k
        tip = polar(jx, jy, 20, a); l1 = polar(jx, jy, 12, a - 14); r1 = polar(jx, jy, 12, a + 14)
        base = polar(jx, jy, 5, a)
        slab([base, l1, tip, r1], gold(), d=jd - 1, thick=3, bevel=1)
        ball((*polar(jx, jy, 15, a), jd + 1.2), 1.8, mat(RED if k % 2 else "#2f9a62", "glass"), seg=8)
    for k in range(12):
        ball((*polar(jx, jy, 9.5, 15 + 30 * k), jd + 2), 1.5, mat("#fbf6ea"), seg=8)
    ell((jx, jy, jd + 2.5), 7, 7, 4.4, mat("#d42c3a", "glass"), seg=20)
    ell((jx - 2.4, jy - 2.4, jd + 6.4), 1.8, 1.4, .8, mat("#ffffff", "glow"), seg=8)
    for k, dx in enumerate((-9, 0, 9)):
        top = (jx + dx, jy + 16 - abs(dx) * .3, jd)
        bot = (jx + dx * 1.2, jy + 30 + (6 if k == 1 else 0), jd)
        sweep([top, bot], .6, gold2(), seg=5)
        ball(bot, 2.8 if k == 1 else 2.2, mat("#fbf6ea" if k != 1 else "#d42c3a", "glass"), seg=10)

def obor():
    """bamboo torch (obor) with a coconut-fibre wick: the fire Hanoman carried on his tail"""
    n0 = len(OBJS)
    bam = mat("#c9a14e", "stripe", "#a98236", 3)
    cyl((60, 66, 0), (60, 154, 0), 9, 8.6, bam, seg=20)
    for y in (92, 124):   # bamboo nodes
        torus((60, y), 9.2, 1.6, mat("#a98236"), axis=(0, 1, 0), seg=20, ring=6)
    lathe([(0, 154), (8.6, 154), (8.6, 153)], 60, mat("#e3c77a"), seg=20)
    fib = mat("#5a3a1c", "grain", "#3a2410", 6)
    lathe([(9.5, 68), (12, 64), (13, 58), (12, 52), (10, 49)], 60, fib, seg=22)
    for y in (58, 64):
        torus((60, y), 12.6, 1.4, mat(MAROON), axis=(0, 1, 0), seg=20, ring=6)
    sweep([(48, 66, 6), (54, 72, 9), (52, 84, 9), (46, 90, 8)], [1.4, 1.4, 1.2, .8], mat(MAROON), seg=6)
    flame(60, 52, 50, 20, d=0, lean=.18)
    turn(since(n0), 8)
    for x, y, r in ((92, 18, 2), (26, 26, 1.6), (98, 50, 1.4), (30, 56, 1.2), (80, 6, 1.2)):
        ball((x, y, 4), r, mat("#ffd85e", "glow"), seg=8)

def mahkota():
    n0 = len(OBJS)
    cx = 54
    # curly black hair fall (ngore) at the back
    ink = mat("#1b1622"); curl = mat("#8a7fa8")
    for x, y, r in ((80, 128, 10), (93, 122, 9), (101, 134, 8.5), (88, 142, 9), (74, 146, 8), (96, 150, 7.5), (106, 120, 6.5)):
        ball((x, y, -2), r, ink, seg=14)
        sp = [(x + r * .7 * (1 - t / 14) * math.cos(t * .55), y - r * .7 * (1 - t / 14) * math.sin(t * .55), -2 + r * .92) for t in range(14)]
        sweep(sp, .9, curl, seg=5)
    # garuda mungkur: the back plate, a garuda head looking backward
    gm = path((66, 122), [((68, 100), (70, 76), (76, 58)), ((80, 46), (88, 38), (97, 40)), ((104, 42), (106, 50), (101, 54)),
                          ((110, 58), (112, 68), (106, 72)), ((114, 78), (114, 88), (108, 92)), ((116, 98), (112, 108), (104, 108)),
                          ((108, 116), (100, 124), (92, 120)), ((84, 126), (72, 126), (66, 122))], n=8)
    slab(gm, mat(GOLD, "dots", "#9a6a30", 1.5), d=-8, thick=4, bevel=1.4)
    slab(path((80, 114), [((80, 94), (84, 74), (92, 62)), ((102, 72), (104, 92), (98, 108)), ((80, 114),)], n=8),
         mat(RED), d=-5.5, thick=1.6, bevel=.6)
    for k, (x, y) in enumerate(((104, 62), (108, 82), (108, 100))):
        ball((x, y, -5.5), 1.8, mat("#2f8a55" if k % 2 else BLUE, "glass"), seg=8)
    ell((96, 45, -5), 5, 4.4, 3.6, gold())
    cyl((100, 44, -5), (107, 48, -5), 2.6, .3, gold2(), seg=10)
    ball((97.5, 43.5, -1.6), 1.3, mat("#fff8e8"), seg=8)
    # tiers of the makuta, each with a crown of lotus-petal points
    tiers = [(118, 102, 26, 23, mat(RED, "dots", "#f2c46a", 1.6)), (102, 88, 22.5, 19.5, mat(GOLD, "dots", "#9a6a30", 1.6)),
             (88, 74, 19, 15.5, mat("#2f8a55", "dots", "#f2c46a", 1.6)), (74, 61, 15, 11.5, mat(GOLD, "dots", "#9a6a30", 1.8)),
             (61, 51, 11, 8.5, mat(RED))]
    for yb, yt, rb, rt, m_ in tiers:
        lathe([(rb, yb), (rb + .6, yb - 2), (rt + .6, yt + 1), (rt, yt)], cx, m_, seg=32)
        torus((cx, yb - 1), rb + .4, 1.4, gold(), axis=(0, 1, 0), seg=32, ring=6)
        n = 9
        for k in range(n):
            th = math.pi * (k + .5) / n + math.pi * .02
            x, d = cx + rt * math.cos(th) * 1.02, -(-rt * math.sin(th)) * 1.0
            cyl((x, yt + 2.5, d), (x, yt - 4.5, d), 2.6, .2, gold(), seg=6, h=1.2)
    bud = [(8.5, 52), (10, 46), (9.5, 38), (7, 28), (3.5, 18), (0, 9)]
    lathe([(0, 53)] + bud, cx, mat("#c42a2a", "glass"), seg=24, xoff=lambda y: -4 * ((52 - y) / 43) ** 2)
    for th in (40, 140, 90):
        x = cx + 8 * math.cos(math.radians(th))
        slab([(x - 5, 54), (x, 40), (x + 5, 54)], mat("#2f8a55"), d=8 * math.sin(math.radians(th)), thick=2, bevel=.6)
    ball((cx - 4.2, 8.5, 0), 2.2, gold(), seg=10)
    # jamang front band with jewels and the upturned front ornament; sumping
    torus((cx, 120), 27.5, 3.4, gold(), axis=(0, 1, 0), seg=36, ring=8)
    for k in range(7):
        th = math.radians(200 + 22 * k)
        ball((cx + 30.5 * math.cos(th), 120, 30.5 * math.sin(th) * -1 * -1), 2, mat(RED, "glass"), seg=8)
    for i, (x, y) in enumerate(((24, 112), (21, 104), (22, 95))):
        sweep([(x + 6, y + 6, 12), (x, y, 12), (x - 4, y - 3, 12), (x - 2, y - 7, 12)], [2.6, 2.4, 1.8, .6], gold(), seg=8)
    sl = path((44, 124), [((40, 134), (34, 142), (26, 150)), ((36, 146), (46, 140), (50, 126)), ((44, 124),)], n=8)
    slab(sl, mat("#2f8a55"), d=26, thick=2.4, bevel=.8)
    turn(since(n0), -4)

def astagina():
    g = gold()
    lathe([(0, 142), (12, 142), (13, 139), (8, 135)], 60, gold2(), seg=28)
    body = [(8, 135), (17, 134), (24, 129), (28.5, 120), (29.5, 110), (27, 101), (23, 96)]
    lathe(body, 60, g, seg=36, rmod=lambda th, y: 1 + 0.045 * abs(math.cos(3 * th)))
    torus((60, 109), 29.8, 2.2, mat(RED), axis=(0, 1, 0), seg=36, ring=6)
    for k, col in enumerate((BLUE, RED, BLUE, "#2f9a62", "#2f9a62")):
        th = math.radians([270, 250, 290, 230, 310][k])
        ball((60 + 31.5 * math.cos(th), 109, -31.5 * math.sin(th)), 2.6 if k == 0 else 2.2, mat(col, "glass"), seg=10)
    torus((60, 96), 23, 1.8, gold2(), axis=(0, 1, 0), seg=32, ring=6)
    lathe([(0, 97), (22, 97), (22, 96.5)], 60, mat("#1a2350"), seg=32)
    ball((60, 92, 0), 4.2, mat("#ffd24a", "glow"), seg=14)
    for x, y, d in ((50, 94, 8), (70, 93, -4), (66, 95, 12), (54, 95, -10), (74, 96, 6)):
        ball((x, y, d), .9, mat("#fff8d0", "glow"), seg=6)
    for a in (60, 75, 90, 105, 120):
        p = polar(60, 92, 34, a)
        sweep([(60, 92, 0), (p[0], p[1], 0)], [1.6, .3], mat("#ffe9a8", "glow"), seg=6)
    n0 = len(OBJS)
    lid = [(24, 82), (24.5, 78), (22, 70), (16, 63), (9, 59.5), (0, 58.5)]
    lathe(lid, 60, g, seg=36, rmod=lambda th, y: 1 + 0.04 * abs(math.cos(3 * th)))
    torus((60, 81.5), 24.4, 1.6, gold2(), axis=(0, 1, 0), seg=32, ring=6)
    for k in range(6):
        th = TAU * k / 6 + .3
        x, d = 60 + 6 * math.cos(th), -6 * math.sin(th)
        cyl((x, 60, d), (x + 2 * math.cos(th), 49, d - 2 * math.sin(th)), 2.6, .3, gold2(), seg=6)
    ball((60, 52, 0), 3.4, mat("#3fb39b", "glass"), seg=12)
    ball((60, 70, 22), 3.4, mat(RED, "glass"), seg=12)
    turn(since(n0), -14, 40, 82, 0)

ITEMS = {
    "blencong": blencong, "kayon": kayon, "rujakpolo": rujakpolo, "pancanaka": pancanaka,
    "keris-cakil": keris_cakil, "kentongan": kentongan, "dadu": dadu, "tirta": tirta,
    "pulanggeni": pulanggeni, "kalimasada": kalimasada, "gandewa": gandewa, "wijayakusuma": wijayakusuma,
    "kendhi": kendhi, "gada-inten": gada_inten, "pasopati": pasopati, "guwawijaya": guwawijaya,
    "ampal": ampal, "poleng": poleng, "konde": konde, "obor": obor, "mahkota": mahkota, "astagina": astagina,
}

# ---------------------------------------------------------------- stage

def stage():
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    try:
        sc.eevee.taa_render_samples = 48
    except Exception:
        pass
    sc.render.resolution_x, sc.render.resolution_y = W_PX, H_PX
    sc.render.film_transparent = True
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.42, 0.38, 0.36, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.85
    sc.world = world
    def light(name, energy, loc, size, col=(1.0, 0.93, 0.82)):
        ld = bpy.data.lights.new(name, "AREA")
        ld.energy = energy; ld.size = size; ld.color = col
        lo = bpy.data.objects.new(name, ld)
        lo.location = loc
        lo.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        sc.collection.objects.link(lo)
    light("key", 70, (-1.4, -2.4, 2.0), 1.8)
    light("fill", 28, (2.0, -1.8, 0.2), 2.2, (0.85, 0.9, 1.0))
    light("rim", 60, (0.8, 2.2, 1.4), 1.4, (1.0, 0.85, 0.7))
    cd = bpy.data.cameras.new("cam"); cd.type = "ORTHO"
    cam = bpy.data.objects.new("cam", cd)
    sc.collection.objects.link(cam); sc.camera = cam
    return cam

def frame(cam):
    """aim along the fixed view direction and fit the silhouette into FILL of the 3:4 frame"""
    y, e = math.radians(YAW), math.radians(ELEV)
    fwd = Vector((-math.sin(y) * math.cos(e), math.cos(y) * math.cos(e), -math.sin(e)))
    rot = fwd.to_track_quat("-Z", "Y")
    right = rot @ Vector((1, 0, 0)); up = rot @ Vector((0, 1, 0))
    dg = bpy.context.evaluated_depsgraph_get()
    xs, ys = [], []
    for o in OBJS:
        if o.name not in bpy.data.objects or o.type != "MESH" or o.hide_render:
            continue
        ev = o.evaluated_get(dg)
        mw = ev.matrix_world
        for v in ev.data.vertices:
            w = mw @ v.co
            xs.append(w.dot(right)); ys.append(w.dot(up))
    if DEBUG:
        for o in OBJS:
            ev = o.evaluated_get(dg)
            if o.type == "MESH" and len(ev.data.vertices):
                ws = [ev.matrix_world @ v.co for v in ev.data.vertices]
                print("  ", o.name, len(ws), [round(min(w[i] for w in ws), 2) for i in range(3)], [round(max(w[i] for w in ws), 2) for i in range(3)])
    cxp, cyp = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    wv, hv = max(xs) - min(xs), max(ys) - min(ys)
    scale = max(hv / FILL, wv / (FILL * W_PX / H_PX))
    cam.data.ortho_scale = scale
    cam.rotation_euler = rot.to_euler()
    cam.location = right * cxp + up * cyp - fwd * 10
    cam.data.clip_end = 30

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    OBJS.clear(); _mats.clear()

os.makedirs(OUT, exist_ok=True)
for pid, fn in ITEMS.items():
    if ONLY and pid not in ONLY:
        continue
    reset()
    cam = stage()
    fn()
    frame(cam)
    sc = bpy.context.scene
    sc.render.image_settings.file_format = "WEBP"
    sc.render.image_settings.color_mode = "RGBA"
    sc.render.image_settings.quality = QUALITY
    p = os.path.join(OUT, f"{pid}.webp")
    sc.render.filepath = p
    bpy.ops.render.render(write_still=True)
    print(f"[pusaka] {pid:13s} {os.path.getsize(p) / 1024:5.1f} KB  objects {len(OBJS)}", flush=True)
