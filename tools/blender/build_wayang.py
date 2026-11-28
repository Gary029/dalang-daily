"""
Builds the 3D wayang from tools/blender/figures.json (scripts/export-figures.ts):
chunky vinyl-toy part assemblies after the Dalang VR figures. Every polygon
becomes a rounded, bevelled slab in its colour, stacked by layer; the carved
holes are cut clean through; sphere eyes on both faces; bracelets on the
wrists.

Writes public/models/<id>.glb in figure units (x faces right, y up, z is
thickness, +z the side nearer the lamp) with the nodes
  body                   torso, legs, kain and the gapit (no head)
  head                   everything the engine turns with the head; its
                         origin is the neck pivot, so turning the node about
                         z by HEAD[pose.head] degrees is the posed head
  front_<s><e>           the front arm, shoulder s and elbow e (0..2)
  back_<s><e>            the back arm behind the body: the same mesh as the
                         front arm, mirrored about its own shoulder
and card art public/art/<id>-<arm>.webp (rest pose, front shoulder 0..2).

  blender -b --python tools/blender/build_wayang.py -- [--only semar,bima] [--no-art] [--no-glb]
          [--sheet out.png]   also renders a review sheet of every built figure in a few poses
"""
import bpy, bmesh, json, math, os, sys
from mathutils import Vector, Matrix

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def arg(name, default=None):
    return ARGS[ARGS.index(name) + 1] if name in ARGS else default

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA = json.load(open(os.path.join(ROOT, "tools", "blender", "figures.json"), encoding="utf8"))
HEAD = DATA["head"]
ONLY = set(arg("--only", "").split(",")) - {""}
ART = "--no-art" not in ARGS
GLB = "--no-glb" not in ARGS
SHEET = arg("--sheet")

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

def B(x, y, z=0.0):
    """figure (x, y, z) -> blender (x, -z, y); the glTF export (y-up) turns it back"""
    return Vector((x, -z, y))

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
    """a rounded slab from a 2D polygon, centred at figure depth z"""
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
    me.transform(Matrix.Translation((0, 0, z)))
    me.transform(Matrix.Rotation(math.radians(90), 4, "X"))
    mo = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(mo)
    return mo

def cutter(holes):
    """clean prisms through the whole puppet, one per carved hole"""
    me = bpy.data.meshes.new("cut")
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

def torus(name, loc, major, minor, rot, mat, seg=12, ring=5):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
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

def join(name, objs, origin=None):
    """one mesh object from the parts; origin (blender coords) becomes its pivot"""
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
    if origin is not None:
        ob.data.transform(Matrix.Translation(-origin))
        ob.location = origin
    return ob

def fz(layer):
    """figure z of a part's centre for a stacking layer (+z faces the viewer)"""
    return layer * LAYER

def shifted(poly, dx, dy):
    return [v - (dx if k % 2 == 0 else dy) for k, v in enumerate(poly)]

def build(f):
    reset()
    _mats.clear()
    col = f["colors"]
    mat = lambda kind: material(f"{f['id']}_{kind}", col[kind], kind)
    braid = material(f"{f['id']}_bracelet", f["bracelet"], "gold")
    # holes in two groups so each cutter matches its part's group; a part is
    # cut by any hole it overlaps (exact at rest, which is what shows)
    groups = []
    for is_head in (False, True):
        hs = [h["poly"] for h in f["holes"] if h["head"] == is_head]
        if hs:
            groups.append((cutter(hs), [bbox2(h) for h in hs]))
    body_parts, head_parts = [], []
    for k, p in enumerate(f["parts"]):
        horn = p["kind"] == "horn"
        thick = ROD_THICK if horn else THICK
        ob = slab(f"p{k}", p["poly"], fz(p["layer"]), thick, BEVEL * (0.5 if horn else 1))
        ob.data.materials.append(mat(p["kind"]))
        if not horn:
            for cut, boxes in groups:
                if any(overlaps(bbox2(p["poly"]), h) for h in boxes):
                    cut_holes(ob, cut)
        (head_parts if p["head"] else body_parts).append(ob)
    # a gold belt along the top edge of the kain
    cloth = next((p for p in f["parts"] if p["kind"] == "cloth" and not p["head"]), None)
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
        body_parts.append(ob)
    # eyes on both faces of the head, looking forward (+x)
    h = f["head"]
    r = max(0.0085, min(h["rx"], h["ry"]) * 0.17)
    ex, ey = h["cx"] + h["rx"] * 0.4, h["cy"] + h["ry"] * 0.16
    front = fz(4) + THICK / 2
    white, black = material("eye_white", "#fbf7ee", "white"), material("eye_black", "#141010", "hair")
    eyes = head_parts if h["turns"] and head_parts else body_parts
    for side in (1, -1):
        z = side * (front - r * 0.35)
        eyes.append(sphere("eye", B(ex, ey, z), r, white))
        eyes.append(sphere("pupil", B(ex + r * 0.25, ey, z + side * r * 0.62), r * 0.55, black))
    body = join("body", body_parts)
    head = join("head", head_parts, B(*f["neck"])) if head_parts else None
    for cut, _ in groups:
        bpy.data.objects.remove(cut)
    # nine arm meshes in the front shoulder's frame; the back arm instances them
    fsx, fsy = f["shoulders"]["front"]
    bsx, bsy = f["shoulders"]["back"]
    arms = {}
    for arm in f["arms"]:
        if arm["side"] != "front":
            continue
        se = f"{arm['shoulder']}{arm['elbow']}"
        base = arm["layer"]
        objs = []
        for k, p in enumerate(arm["parts"]):
            horn = p["kind"] == "horn"
            ob = slab(f"a{se}_{k}", shifted(p["poly"], fsx, fsy), fz(p["layer"] - base),
                      ROD_THICK if horn else THICK * 0.9, BEVEL * (0.5 if horn else 0.9))
            ob.data.materials.append(mat(p["kind"]))
            objs.append(ob)
        wx, wy = arm["wrist"]
        w = arm["width"] * 1.7
        # ring around the forearm: torus axis along the forearm direction
        objs.append(torus("bangle", B(wx - fsx, wy - fsy, 0), w, w * 0.3, (0, math.pi / 2 - arm["angle"], 0), braid))
        fr = join(f"front_{se}", objs)
        fr.location = B(fsx, fsy, fz(base))
        bk = bpy.data.objects.new(f"back_{se}", fr.data)
        bpy.context.scene.collection.objects.link(bk)
        back_layer = next(a["layer"] for a in f["arms"] if a["side"] == "back")
        bk.location = B(bsx, bsy, fz(back_layer))
        bk.scale = (-1, 1, 1)
        arms[f"front_{se}"] = fr
        arms[f"back_{se}"] = bk
    return body, head, arms

def export(f, objs):
    path = os.path.join(ROOT, "public", "models", f"{f['id']}.glb")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.hide_set(False)
        o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        # nothing has modifiers left; leaving this off keeps the back arms
        # sharing the front arms' meshes
        export_apply=False,
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

# --- posing and rendering -------------------------------------------------------

REST = {"arm": 0, "elbow": 0, "back": 0, "backElbow": 0, "head": 0}

def pose(head, arms, j):
    """show one joint set: the head turned, one front and one back arm"""
    if head:
        head.rotation_euler = (0, -math.radians(HEAD[j["head"]]), 0)
    on = {f"front_{j['arm']}{j['elbow']}", f"back_{j['back']}{j['backElbow']}"}
    for name, o in arms.items():
        o.hide_render = name not in on

def posed_x(f, j):
    """x extent of the visible (non-rod) geometry in a joint set"""
    xs = []
    for p in f["parts"]:
        if p["kind"] != "horn":
            xs += p["poly"][0::2]
    for a in f["arms"]:
        s, e = (j["arm"], j["elbow"]) if a["side"] == "front" else (j["back"], j["backElbow"])
        if a["shoulder"] == s and a["elbow"] == e:
            for p in a["parts"]:
                if p["kind"] != "horn":
                    xs += p["poly"][0::2]
    return min(xs), max(xs)

def posed_top(f, j):
    ys = [p["poly"][k] for p in f["parts"] if p["kind"] != "horn" for k in range(1, len(p["poly"]), 2)]
    for a in f["arms"]:
        s, e = (j["arm"], j["elbow"]) if a["side"] == "front" else (j["back"], j["backElbow"])
        if a["shoulder"] == s and a["elbow"] == e:
            ys += [p["poly"][k] for p in a["parts"] if p["kind"] != "horn" for k in range(1, len(p["poly"]), 2)]
    return max(ys)

ART_W, ART_H = 360, 480
PAD = 0.06
SPAN = 1.16 / (1 - 2 * PAD)          # vertical figure units in the frame (art.ts)

def stage(w, h):
    """engine, lights and an ortho camera, set up once per figure"""
    sc = bpy.context.scene
    if sc.camera:
        sc.render.resolution_x, sc.render.resolution_y = w, h
        return sc.camera
    for eng in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
        try:
            sc.render.engine = eng
            break
        except TypeError:
            pass
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.film_transparent = True
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
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

def frame(cam, cx, span, yaw=0.0):
    """feet PAD of the frame up from the bottom, figure centred at cx"""
    cam.data.ortho_scale = span
    cy = -PAD * span + span / 2
    d = 5
    cam.rotation_euler = (math.radians(90), 0, yaw)
    cam.location = (cx + math.sin(yaw) * d, -math.cos(yaw) * d, cy)

def art_span(f, sets):
    """the shared card scale, unless a figure is too tall for it (Rahwana)"""
    top = max(posed_top(f, j) for j in sets)
    return max(SPAN, (top + 0.025) / (1 - PAD))

def render_art(f, head, arms):
    sc = bpy.context.scene
    cam = stage(ART_W, ART_H)
    sc.render.image_settings.file_format = "WEBP"
    sc.render.image_settings.color_mode = "RGBA"
    sc.render.image_settings.quality = 88
    sets = [dict(REST, arm=a) for a in range(3)]
    span = art_span(f, sets)
    out = []
    for a, j in enumerate(sets):
        pose(head, arms, j)
        x0, x1 = posed_x(f, j)
        frame(cam, (x0 + x1) / 2, span)
        path = os.path.join(ROOT, "public", "art", f"{f['id']}-{a}.webp")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        sc.render.filepath = path
        bpy.ops.render.render(write_still=True)
        out.append(os.path.getsize(path))
    pose(head, arms, REST)
    return out

# review sheet: every figure in a few joint sets, and once turned to show depth
SHEET_SETS = [
    ("rest", REST, 0.0),
    ("reach", {"arm": 1, "elbow": 1, "back": 1, "backElbow": 0, "head": 1}, 0.0),
    ("up", {"arm": 2, "elbow": 2, "back": 2, "backElbow": 2, "head": 2}, 0.0),
    ("down", {"arm": 0, "elbow": 2, "back": 0, "backElbow": 1, "head": 1}, 0.0),
    ("turned", {"arm": 1, "elbow": 0, "back": 1, "backElbow": 1, "head": 0}, math.radians(-38)),
]
TILE_W, TILE_H = 220, 300
SHEET_SPAN = 1.5
tiles = {}

def render_sheet_tiles(f, head, arms, tmp):
    sc = bpy.context.scene
    cam = stage(TILE_W, TILE_H)
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    out = []
    for name, j, yaw in SHEET_SETS:
        pose(head, arms, j)
        x0, x1 = posed_x(f, j)
        frame(cam, (x0 + x1) / 2, SHEET_SPAN, yaw)
        path = os.path.join(tmp, f"{f['id']}-{name}.png")
        sc.render.filepath = path
        bpy.ops.render.render(write_still=True)
        out.append(path)
    pose(head, arms, REST)
    tiles[f["id"]] = out

def compose_sheet(path):
    import numpy as np
    ids = list(tiles)
    cols = 2                                  # figures per row
    per = len(SHEET_SETS)
    rows = (len(ids) + cols - 1) // cols
    W, H = cols * per * TILE_W + (cols - 1) * 24, rows * TILE_H
    sheet = np.zeros((H, W, 4), dtype=np.float32)
    sheet[:, :] = (0.93, 0.86, 0.72, 1.0)     # kelir cloth
    for n, fid in enumerate(ids):
        r, c = n // cols, n % cols
        for k, tp in enumerate(tiles[fid]):
            im = bpy.data.images.load(tp)
            px = np.array(im.pixels[:], dtype=np.float32).reshape(TILE_H, TILE_W, 4)
            bpy.data.images.remove(im)
            x = c * (per * TILE_W + 24) + k * TILE_W
            y = H - (r + 1) * TILE_H          # blender images are bottom-up
            a = px[:, :, 3:4]
            dst = sheet[y:y + TILE_H, x:x + TILE_W]
            dst[:, :, :3] = px[:, :, :3] * a + dst[:, :, :3] * (1 - a)
            if k % 2:
                dst[:, :, :3] *= 0.97
    out = bpy.data.images.new("sheet", W, H, alpha=True)
    out.pixels.foreach_set(sheet.ravel())
    out.filepath_raw = path
    out.file_format = "PNG"
    out.save()
    print(f"[wayang] sheet {path} ({W}x{H}, columns: {', '.join(s[0] for s in SHEET_SETS)})")

total = 0
tmp = None
if SHEET:
    tmp = os.path.join(os.path.dirname(os.path.abspath(SHEET)), "tiles")
    os.makedirs(tmp, exist_ok=True)
for f in DATA["figures"]:
    if ONLY and f["id"] not in ONLY:
        continue
    body, head, arms = build(f)
    objs = [body, *([head] if head else []), *arms.values()]
    msg = f"[wayang] {f['id']:11s}"
    if GLB:
        size = export(f, objs)
        total += size
        faces = sum(len(o.data.polygons) for o in [body, *([head] if head else [])]) + \
            sum(len(o.data.polygons) for n, o in arms.items() if n.startswith("front"))
        msg += f" glb {size / 1024:5.1f} KB  faces {faces}"
    if ART:
        sizes = render_art(f, head, arms)
        msg += "  art " + " ".join(f"{s / 1024:.0f}K" for s in sizes)
    if SHEET:
        render_sheet_tiles(f, head, arms, tmp)
    print(msg, flush=True)
if GLB:
    print(f"[wayang] total glb {total / 1024:.0f} KB")
if SHEET:
    compose_sheet(os.path.abspath(SHEET))
