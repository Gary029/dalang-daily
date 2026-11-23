"""
Builds the 3D wayang from tools/blender/figures.json (scripts/export-figures.ts):
chunky vinyl-toy part assemblies after the Dalang VR figures. Every polygon
becomes a rounded, bevelled slab in its colour, stacked by layer; the carved
holes are cut clean through; sphere eyes on both faces; bracelets on the
wrists. Writes public/models/<id>.glb (nodes body, arm0, arm1, arm2, in
figure units: x faces right, y up, z is thickness) and card art
public/art/<id>-<arm>.webp.

  blender -b --python tools/blender/build_wayang.py -- [--only semar,bima] [--no-art] [--sheet out.png]
"""
import bpy, bmesh, json, math, os, sys
from mathutils import Vector, Matrix

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def arg(name, default=None):
    return ARGS[ARGS.index(name) + 1] if name in ARGS else default

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA = json.load(open(os.path.join(ROOT, "tools", "blender", "figures.json"), encoding="utf8"))
ONLY = set(arg("--only", "").split(",")) - {""}
ART = "--no-art" not in ARGS

THICK = 0.034      # slab thickness, figure units
LAYER = 0.0042     # z step between stacked parts
BEVEL = 0.0075
ROD_THICK = 0.011

def hex_rgba(h):
    h = h.lstrip("#")
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return (*lin, 1.0)

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

_mats = {}
def material(key, color, kind):
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new(key)
    if hasattr(m, "use_nodes") and not m.node_tree:
        m.use_nodes = True
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = hex_rgba(color)
    # vinyl: soft sheen; gold a little metallic
    p.inputs["Roughness"].default_value = 0.32 if kind == "gold" else 0.45
    p.inputs["Metallic"].default_value = 0.55 if kind == "gold" else 0.0
    _mats[key] = m
    return m

def slab(name, poly, z, thick, bevel):
    """a rounded slab from a 2D polygon, centred at depth z (figure +z = viewer)"""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "2D"
    cu.fill_mode = "BOTH"
    xs, ys = poly[0::2], poly[1::2]
    size = min(max(xs) - min(xs), max(ys) - min(ys))
    b = min(bevel, size * 0.22, thick * 0.45)
    cu.bevel_depth = b
    cu.bevel_resolution = 1
    cu.extrude = max(0.0005, thick / 2 - b)
    sp = cu.splines.new("POLY")
    sp.points.add(len(xs) - 1)
    for i, (x, y) in enumerate(zip(xs, ys)):
        sp.points[i].co = (x, y, 0, 1)
    sp.use_cyclic_u = True
    ob = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob)
    bpy.data.curves.remove(cu)
    # figure (x, y, z) -> blender (x, -z, y): glTF export (y-up) turns it back
    me.transform(Matrix.Translation((0, 0, z)))
    me.transform(Matrix.Rotation(math.radians(90), 4, "X"))
    mo = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(mo)
    return mo

def cutter(holes):
    bm = bmesh.new()
    for poly in holes:
        verts = [bm.verts.new((poly[i], 0.3, poly[i + 1])) for i in range(0, len(poly), 2)]
        f = bm.faces.new(verts)
        bmesh.ops.extrude_face_region(bm, geom=[f])
    bm.normal_update()
    me = bpy.data.meshes.new("cut")
    bm.to_mesh(me)
    bm.free()
    # extrude went along the face normal; rebuild as clean prisms instead
    me.clear_geometry()
    bm = bmesh.new()
    for poly in holes:
        n = len(poly) // 2
        lo = [bm.verts.new((poly[2 * i], -0.3, poly[2 * i + 1])) for i in range(n)]
        hi = [bm.verts.new((poly[2 * i], 0.3, poly[2 * i + 1])) for i in range(n)]
        bm.faces.new(lo)
        bm.faces.new(list(reversed(hi)))
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("cut", me)
    bpy.context.scene.collection.objects.link(ob)
    ob.hide_render = True
    return ob

def bbox2(poly):
    xs, ys = poly[0::2], poly[1::2]
    return min(xs), min(ys), max(xs), max(ys)

def overlaps(a, b):
    return a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]

def cut_holes(ob, cut):
    mod = ob.modifiers.new("holes", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.object = cut
    mod.solver = "EXACT"
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier=mod.name)

def sphere(name, loc, r, mat, segs=10):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=max(6, segs // 2), radius=r)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    ob.location = loc
    ob.data.materials.append(mat)
    bpy.context.scene.collection.objects.link(ob)
    return ob

def torus(name, loc, major, minor, rot, mat):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    seg, ring = 14, 6
    rows = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        row = []
        for j in range(ring):
            b = 2 * math.pi * j / ring
            r = major + minor * math.cos(b)
            row.append(bm.verts.new((r * math.cos(a), r * math.sin(a), minor * math.sin(b))))
        rows.append(row)
    for i in range(seg):
        for j in range(ring):
            bm.faces.new((rows[i][j], rows[(i + 1) % seg][j], rows[(i + 1) % seg][(j + 1) % ring], rows[i][(j + 1) % ring]))
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    ob.location = loc
    ob.rotation_euler = rot
    ob.data.materials.append(mat)
    bpy.context.scene.collection.objects.link(ob)
    return ob

def join(name, objs):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    ob.data.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    try:
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(38))
    except Exception:
        bpy.ops.object.shade_smooth()
    # weld what the booleans and slabs left
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0002)
    bm.to_mesh(ob.data)
    bm.free()
    return ob

def fz(layer, thick=THICK):
    """blender y for a part's centre (front of the puppet is -y)"""
    return layer * LAYER

def build(f):
    reset()
    _mats.clear()
    col = f["colors"]
    mat = lambda kind: material(f"{f['id']}_{kind}", col[kind], kind)
    holes = f["holes"]
    hb = [bbox2(h) for h in holes]
    cut = cutter(holes) if holes else None
    parts = []
    for k, p in enumerate(f["parts"]):
        horn = p["kind"] == "horn"
        thick = ROD_THICK if horn else THICK
        ob = slab(f"p{k}", p["poly"], fz(p["layer"]), thick, BEVEL * (0.5 if horn else 1))
        ob.data.materials.append(mat(p["kind"]))
        if cut and not horn and any(overlaps(bbox2(p["poly"]), h) for h in hb):
            cut_holes(ob, cut)
        parts.append(ob)
    # a gold belt along the top edge of the kain
    cloth = next((p for p in f["parts"] if p["kind"] == "cloth"), None)
    if cloth:
        pts = sorted(zip(cloth["poly"][0::2], cloth["poly"][1::2]), key=lambda v: -v[1])[:2]
        (x1, y1), (x2, y2) = sorted(pts)
        a = math.atan2(y2 - y1, x2 - x1)
        r = 0.011
        belt = []
        for t in range(8):
            u = a + math.pi / 2 + t / 7 * math.pi
            belt += [x1 + 0.006 + math.cos(u) * r, y1 + math.sin(u) * r]
        for t in range(8):
            u = a - math.pi / 2 + t / 7 * math.pi
            belt += [x2 - 0.006 + math.cos(u) * r, y2 + math.sin(u) * r]
        ob = slab("belt", belt, fz(cloth["layer"] + 1), THICK, BEVEL)
        ob.data.materials.append(mat("gold"))
        parts.append(ob)
    # eyes on both faces of the head, looking forward (+x)
    h = f["head"]
    r = max(0.0085, min(h["rx"], h["ry"]) * 0.17)
    ex, ey = h["cx"] + h["rx"] * 0.4, h["cy"] + h["ry"] * 0.16
    front = fz(4) + THICK / 2
    white, black = material("eye_white", "#fbf7ee", "white"), material("eye_black", "#141010", "hair")
    for side in (1, -1):
        y = -side * (front - r * 0.35)
        parts.append(sphere("eye", (ex, y, ey), r, white))
        parts.append(sphere("pupil", (ex + r * 0.25, y - side * r * 0.62, ey), r * 0.55, black))
    # a bracelet on the back wrist
    bx, by = f["backHand"]
    bw = f["arms"][0]["width"] * 1.45
    braid = material(f"{f['id']}_bracelet", f["bracelet"], "gold")
    parts.append(torus("bangle", (bx, fz(-2) * 0 - fz(-2), by + bw * 1.4), bw, bw * 0.3, (math.radians(90), 0, 0), braid))
    body = join("body", parts)
    if cut:
        bpy.data.objects.remove(cut)
    arms = []
    for a, arm in enumerate(f["arms"]):
        objs = []
        for k, p in enumerate(arm["parts"]):
            horn = p["kind"] == "horn"
            ob = slab(f"a{a}_{k}", p["poly"], fz(p["layer"]), ROD_THICK if horn else THICK * 0.9, BEVEL * (0.5 if horn else 0.9))
            ob.data.materials.append(mat(p["kind"]))
            objs.append(ob)
        wx, wy = arm["wrist"]
        w = arm["width"] * 1.7
        ang = arm["angle"]
        # ring around the forearm: torus axis along the forearm direction
        objs.append(torus("bangle", (wx, -fz(7), wy), w, w * 0.3, (0, math.pi / 2 - ang, 0), braid))
        arms.append(join(f"arm{a}", objs))
    return body, arms

def export(f, body, arms):
    path = os.path.join(ROOT, "public", "models", f"{f['id']}.glb")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in [body, *arms]:
        o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_texcoords=False,
        # three.js recomputes smooth normals on load (reveal3d.ts): half the size
        export_normals=False,
        export_tangents=False,
        export_attributes=False,
        export_extras=False,
        export_animations=False,
        export_materials="EXPORT",
        # three.js decodes this with MeshoptDecoder (no extra files to host)
        export_meshopt_compression_enable=True,
    )
    return os.path.getsize(path)

# --- card art -----------------------------------------------------------------

ART_W, ART_H = 360, 480
PAD = 0.06
SPAN = 1.16 / (1 - 2 * PAD)          # vertical figure units in the frame (art.ts)

def stage(f):
    sc = bpy.context.scene
    for eng in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
        try:
            sc.render.engine = eng
            break
        except TypeError:
            pass
    sc.render.resolution_x, sc.render.resolution_y = ART_W, ART_H
    sc.render.film_transparent = True
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    sc.render.image_settings.file_format = "WEBP"
    sc.render.image_settings.color_mode = "RGBA"
    sc.render.image_settings.quality = 88
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.42, 0.38, 0.34, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.9
    sc.world = world
    def light(name, energy, loc, size):
        ld = bpy.data.lights.new(name, "AREA")
        ld.energy = energy
        ld.size = size
        ld.color = (1.0, 0.93, 0.82)
        lo = bpy.data.objects.new(name, ld)
        lo.location = loc
        d = Vector((0, 0, 0.5)) - Vector(loc)
        lo.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
        sc.collection.objects.link(lo)
    light("key", 60, (-1.2, -2.2, 1.9), 1.6)
    light("fill", 25, (1.6, -1.8, 0.6), 2.0)
    light("rim", 30, (0.6, 1.8, 1.6), 1.2)
    cd = bpy.data.cameras.new("cam")
    cd.type = "ORTHO"
    cd.ortho_scale = SPAN
    cam = bpy.data.objects.new("cam", cd)
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.rotation_euler = (math.radians(90), 0, 0)
    return cam

def render_art(f, body, arms):
    cam = stage(f)
    out = []
    for a, arm in enumerate(arms):
        for o in arms:
            o.hide_render = o is not arm
        xs = []
        for p in f["parts"] + f["arms"][a]["parts"]:
            if p["kind"] != "horn":
                xs += p["poly"][0::2]
        cx = (min(xs) + max(xs)) / 2
        cam.location = (cx, -5, -PAD * SPAN + SPAN / 2)
        path = os.path.join(ROOT, "public", "art", f"{f['id']}-{a}.webp")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        bpy.context.scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        out.append(os.path.getsize(path))
    return out

total = 0
for f in DATA["figures"]:
    if ONLY and f["id"] not in ONLY:
        continue
    body, arms = build(f)
    size = export(f, body, arms)
    total += size
    tris = sum(len(o.data.polygons) for o in [body, *arms])
    msg = f"[wayang] {f['id']:11s} glb {size / 1024:5.1f} KB  faces {tris}"
    if ART:
        sizes = render_art(f, body, arms)
        msg += "  art " + " ".join(f"{s / 1024:.0f}K" for s in sizes)
    print(msg, flush=True)
print(f"[wayang] total glb {total / 1024:.0f} KB")
