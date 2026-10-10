"""
Vonscent 20ml decant атомайзер — бодит хэмжээ (1 Blender нэгж = 1 см, Z дээш).
Хэмжээс: Ø2.6 × 11.4см. Гэр 0–7.55, цагираг 7.55–7.75, таг 7.75–11.4.

  python vial20.py -- <out_dir>                     # вэбийн GLB + .blend
  python vial20.py -- <out_dir> --render black      # студийн рендер (black|pink|silver)

Вэбийн GLB: объектын нэр three.js-д нэрээр нь олдоно (vial_20_*). Шингэн нь
БҮТЭН өндрөөр (түвшин/цалгилтыг shader тайрна). Рендерт тусдаа meniscus-тэй
шингэн ашиглана.

Бодит харагдуулах дүрмүүд (docs/… судалгаа):
- шил хоёр давхар гадаргуутай (хана 0.08см), ирмэгүүд дугуйлсан;
- шингэн шилний дотор хана руу 0.02мм ДАВХЦАНА (зай үлдвэл буруу хугарна);
- шингэний өнгө Volume Absorption-оор зузаанд нь (ирмэг тунгалаг);
- шилэнд бичил roughness noise; гэр нь brushed (anisotropic) металл;
- студи: муруй дэвсгэр, 2 урт softbox + 2 rim strip + дээд гэрэл, AgX,
  shadow caustics (MNEE).
"""
import math, sys, os
import bpy, bmesh

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
OUT = args[0]
ENV = "--env" in args          # студийг 360° HDR болгож рендерлэх (вэбийн орчны гэрэл)
FINISH = args[args.index("--render") + 1] if "--render" in args else ("black" if ENV else None)
SEG = 64 if FINISH is None else 128

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ----------------------------------------------------------------- геометр

def fillet(pts, radius_at, steps=None):
    steps = steps or (8 if FINISH else 5)
    out = []
    for i, p in enumerate(pts):
        r = radius_at.get(i)
        if not r or i == 0 or i == len(pts) - 1:
            out.append(p); continue
        a, b, c = pts[i - 1], p, pts[i + 1]
        v1 = (a[0] - b[0], a[1] - b[1]); v2 = (c[0] - b[0], c[1] - b[1])
        l1 = math.hypot(*v1); l2 = math.hypot(*v2)
        r = min(r, l1 * 0.49, l2 * 0.49)
        v1 = (v1[0] / l1, v1[1] / l1); v2 = (v2[0] / l2, v2[1] / l2)
        p1 = (b[0] + v1[0] * r, b[1] + v1[1] * r); p2 = (b[0] + v2[0] * r, b[1] + v2[1] * r)
        for s in range(steps + 1):
            t = s / steps
            out.append(((1 - t) ** 2 * p1[0] + 2 * (1 - t) * t * b[0] + t ** 2 * p2[0],
                        (1 - t) ** 2 * p1[1] + 2 * (1 - t) * t * b[1] + t ** 2 * p2[1]))
    return out


def lathe(name, profile, seg=None, loc=(0, 0, 0)):
    seg = seg or SEG
    bm = bmesh.new(); rings = []
    for (r, z) in profile:
        if r < 1e-6:
            rings.append([bm.verts.new((0, 0, z))])
        else:
            rings.append([bm.verts.new((r * math.cos(2 * math.pi * k / seg), r * math.sin(2 * math.pi * k / seg), z)) for k in range(seg)])
    for i in range(len(rings) - 1):
        A, B = rings[i], rings[i + 1]
        if len(A) == 1 and len(B) == 1: continue
        if len(A) == 1:
            for k in range(seg): bm.faces.new((A[0], B[k], B[(k + 1) % seg]))
        elif len(B) == 1:
            for k in range(seg): bm.faces.new((A[k], B[0], A[(k + 1) % seg]))
        else:
            for k in range(seg): bm.faces.new((A[k], B[k], B[(k + 1) % seg], A[(k + 1) % seg]))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for poly in me.polygons: poly.use_smooth = True
    ob = bpy.data.objects.new(name, me); ob.location = loc
    scene.collection.objects.link(ob)
    return ob

def orient(ob, outward):
    """Нээлттэй гадаргуугийн нормалийг хүссэн чиглэлд (outward(центр) → вектор) эргүүлнэ."""
    me = ob.data; score = 0.0
    for p in me.polygons:
        c = p.center; d = outward(c)
        score += p.normal.dot(d)
    if score < 0:
        for p in me.polygons: p.flip()
        me.update()

# ---------------------------------------------------------------- материал

def principled(name, **kw):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    for k, v in kw.items(): b.inputs[k].default_value = v
    return m, b


def srgb(h):
    h = h.lstrip("#"); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c) + (1,)


FINISHES = {
    #          гэр (өнгө, roughness, anisotropic)     цагираг/шүршигч
    "black":  (srgb("#0b0b0d"), 0.16, 0.0, True,     srgb("#121214"), 0.06),
    "pink":   (srgb("#e48aa8"), 0.32, 0.55, False,   srgb("#f0f0f3"), 0.03),
    "silver": (srgb("#d6d7dc"), 0.28, 0.6, False,    srgb("#f4f4f6"), 0.03),
}
fin = FINISHES[FINISH or "black"]

M_SLEEVE, b = principled("sleeve", **{"Base Color": fin[0], "Metallic": 1.0, "Roughness": fin[1],
                                      "Anisotropic": fin[2], "Coat Weight": 1.0 if fin[3] else 0.0, "Coat Roughness": 0.04})
if fin[2] > 0:
    nt = M_SLEEVE.node_tree
    tan = nt.nodes.new("ShaderNodeTangent"); tan.direction_type = "RADIAL"; tan.axis = "Z"
    nt.links.new(tan.outputs["Tangent"], b.inputs["Tangent"])
M_TRIM, _ = principled("trim", **{"Base Color": fin[4], "Metallic": 1.0, "Roughness": fin[5]})
M_SPRAYER, _ = principled("sprayer", **{"Base Color": fin[4], "Metallic": 1.0 if not fin[3] else 0.9, "Roughness": fin[5] + 0.08})

# Шил: бичил roughness noise (хэт төгс гадаргуу CG шиг харагддаг).
M_GLASS, gb = principled("glass", **{"Base Color": (1, 1, 1, 1), "Transmission Weight": 1.0, "Roughness": 0.0, "IOR": 1.5})
nt = M_GLASS.node_tree
noise = nt.nodes.new("ShaderNodeTexNoise"); noise.inputs["Scale"].default_value = 18.0; noise.inputs["Detail"].default_value = 6
ramp = nt.nodes.new("ShaderNodeMapRange"); ramp.inputs["To Min"].default_value = 0.0; ramp.inputs["To Max"].default_value = 0.035
ramp.inputs["From Min"].default_value = 0.45; ramp.inputs["From Max"].default_value = 0.75
nt.links.new(noise.outputs["Fac"], ramp.inputs["Value"]); nt.links.new(ramp.outputs["Result"], gb.inputs["Roughness"])

# Шингэн: гадаргуу нь өнгөгүй, туяа нь эзлэхүүнд шингээгдэнэ (Volume Absorption).
M_LIQUID, lb = principled("liquid", **{"Base Color": (1, 1, 1, 1), "Transmission Weight": 1.0, "Roughness": 0.0, "IOR": 1.36})
nt = M_LIQUID.node_tree
absorb = nt.nodes.new("ShaderNodeVolumeAbsorption")
absorb.inputs["Color"].default_value = srgb("#e8c98a"); absorb.inputs["Density"].default_value = 0.35
nt.links.new(absorb.outputs["Volume"], nt.nodes["Material Output"].inputs["Volume"])

# Рендер: шил↔шингэний ЗААГ гадаргуу. Cycles давхар орчныг (шилэн доторх
# шингэн) дараалан тооцдоггүй тул давхцуулбал гэрэл бүтэн ойж шингэн
# харлана. Зөв арга: шүргэлцэх хэсэг нь нэг гадаргуу, IOR = 1.5/1.36,
# нормаль нь шингэн рүү (Blender Artists «Accurate liquid in glass»).
TINT = srgb("#f6ead0")
M_IFACE, _ = principled("glass_liquid_iface", **{"Base Color": TINT, "Transmission Weight": 1.0, "Roughness": 0.0, "IOR": 1.5 / 1.36})
M_LTOP, _ = principled("liquid_top", **{"Base Color": TINT, "Transmission Weight": 1.0, "Roughness": 0.0, "IOR": 1.36})

M_TUBE, _ = principled("tube", **{"Base Color": (0.95, 0.95, 0.95, 1), "Transmission Weight": 0.8, "Roughness": 0.3, "IOR": 1.45})
M_HOLE, _ = principled("nozzle", **{"Base Color": (0.75, 0.75, 0.75, 1), "Roughness": 0.4})

# ------------------------------------------------------------------- сав

R = 1.3; SLEEVE_TOP = 7.55; TRIM_H = 0.2; CAP_B = SLEEVE_TOP + TRIM_H; H = 11.4; WALL = 0.05
GR = 1.1; GW = 0.08; G_TOP = 7.7; G_INNER_BOTTOM = 0.26
OVERLAP = 0.002            # 0.02мм — шингэн шилний дотор хана руу давхцана
LIR = GR - GW + OVERLAP
FILL = 6.5                 # рендерийн шингэний түвшин (вэбийнхтэй ижил)


def build(prefix, x=0.0, closed=True, web=False):
    """Нэг сав. closed=False бол гэр/цагираг/таггүй (дотор нь харагдана)."""
    L = (x, 0, 0); obs = []
    def add(ob, m):
        ob.data.materials.append(m); obs.append(ob); return ob
    if closed:
        add(lathe(f"{prefix}_sleeve", fillet([(0, 0), (R, 0), (R, SLEEVE_TOP), (R - WALL, SLEEVE_TOP), (R - WALL, 0.05), (0, 0.05)], {1: 0.12, 2: 0.02}), loc=L), M_SLEEVE)
        add(lathe(f"{prefix}_trim", fillet([(R - WALL, SLEEVE_TOP), (R + 0.004, SLEEVE_TOP), (R + 0.004, CAP_B), (R - WALL, CAP_B)], {1: 0.03, 2: 0.03}), loc=L), M_TRIM)
        add(lathe(f"{prefix}_cap", fillet([(R - WALL, CAP_B), (R, CAP_B), (R, H), (0, H), (0, H - 0.05), (R - WALL, H - 0.05)], {1: 0.02, 2: 0.12}), loc=L), M_SLEEVE)
    if web:
        add(lathe(f"{prefix}_glass", fillet([(0, 0.08), (GR, 0.08), (GR, G_TOP), (GR - GW, G_TOP), (GR - GW, G_INNER_BOTTOM), (0, G_INNER_BOTTOM)],
                                            {1: 0.25, 2: 0.03, 3: 0.03, 4: 0.18}), loc=L), M_GLASS)
    else:
        IR = GR - GW; MEN = FILL + 0.07
        # Шил: гадна тал + шингэнээс ДЭЭШХ дотор тал (агаар↔шил). Нормаль шилнээс гадагш.
        g = add(lathe(f"{prefix}_glass", fillet([(IR, MEN), (IR, G_TOP), (GR, G_TOP), (GR, 0.08), (0, 0.08)], {1: 0.03, 2: 0.03, 3: 0.25}), loc=L), M_GLASS)
        def glass_out(c, x=x):
            rr = math.hypot(c.x - x, c.y)
            if c.z < 0.1: return __import__("mathutils").Vector((0, 0, -1))
            if rr > GR - 0.02: return __import__("mathutils").Vector(((c.x - x) / rr, c.y / rr, 0))
            return __import__("mathutils").Vector((-(c.x - x) / max(rr, 1e-6), -c.y / max(rr, 1e-6), 0))
        orient(g, glass_out)
        # Заг: дотор ёроол + хана (шингэн хүрэх хэсэг). Нормаль шингэн рүү.
        f = add(lathe(f"{prefix}_iface", fillet([(0, G_INNER_BOTTOM), (IR, G_INNER_BOTTOM), (IR, MEN)], {1: 0.18}), loc=L), M_IFACE)
        def into_liquid(c, x=x):
            rr = math.hypot(c.x - x, c.y)
            v = __import__("mathutils").Vector((-(c.x - x), -c.y, 0.0))
            if c.z < G_INNER_BOTTOM + 0.12 and rr < IR - 0.15: return __import__("mathutils").Vector((0, 0, 1))
            return v.normalized() if v.length > 1e-6 else __import__("mathutils").Vector((0, 0, 1))
        orient(f, into_liquid)
        # Шингэний чөлөөт гадаргуу (meniscus) — нормаль дээш.
        t = add(lathe(f"{prefix}_ltop", [(IR, MEN), (IR - 0.04, FILL + 0.03), (IR - 0.1, FILL + 0.01), (IR - 0.25, FILL), (0, FILL)], loc=L), M_LTOP)
        orient(t, lambda c: __import__("mathutils").Vector((0, 0, 1)))
    if web:
        # Вэб: бүтэн өндөр, түвшинг shader тайрна.
        prof = fillet([(0, G_INNER_BOTTOM - OVERLAP), (LIR, G_INNER_BOTTOM - OVERLAP), (LIR, 7.2), (0, 7.2)], {1: 0.18})
    else:
        # Рендер: хананд хүрэх хэсэгтээ үл ялиг дээш муруйсан гадаргуу (meniscus).
        prof = fillet([(0, G_INNER_BOTTOM - OVERLAP), (LIR, G_INNER_BOTTOM - OVERLAP), (LIR, FILL + 0.07)], {1: 0.18})
        prof += [(LIR - 0.04, FILL + 0.03), (LIR - 0.1, FILL + 0.01), (LIR - 0.25, FILL), (0, FILL)]
    if web:
        add(lathe(f"{prefix}_liquid", prof, loc=L), M_LIQUID)
    add(lathe(f"{prefix}_sprayer", fillet([(0, 7.35), (1.16, 7.35), (1.16, 8.55), (1.2, 8.6), (1.2, 8.78), (1.16, 8.82), (0.62, 8.82), (0.62, 10.35), (0, 10.35)],
                                          {1: 0.04, 2: 0.03, 5: 0.02, 6: 0.03, 7: 0.08}), loc=L), M_SPRAYER)
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.08, depth=0.04, location=(x, -0.62, 10.0), rotation=(math.pi / 2, 0, 0))
    noz = bpy.context.active_object; noz.name = f"{prefix}_nozzle"; add(noz, M_HOLE)
    cu = bpy.data.curves.new(f"{prefix}_tube_curve", "CURVE"); cu.dimensions = "3D"; cu.bevel_depth = 0.045; cu.bevel_resolution = 3
    sp = cu.splines.new("BEZIER"); sp.bezier_points.add(2)
    for bp, co in zip(sp.bezier_points, [(x + 0.15, 0, 7.4), (x + 0.2, 0, 2.0), (x + 0.75, 0, 0.32)]):
        bp.co = co; bp.handle_left_type = bp.handle_right_type = "AUTO"
    tco = bpy.data.objects.new(f"{prefix}_tube", cu); scene.collection.objects.link(tco)
    bpy.ops.object.select_all(action="DESELECT"); bpy.context.view_layer.objects.active = tco; tco.select_set(True)
    bpy.ops.object.convert(target="MESH"); tube = bpy.context.active_object; tube.name = f"{prefix}_tube"
    tube.data.materials.clear(); add(tube, M_TUBE)
    for p in tube.data.polygons: p.use_smooth = True
    return obs


os.makedirs(OUT, exist_ok=True)

if FINISH is None:
    obs = build("vial_20", web=True)
    root = bpy.data.objects.new("vial_20", None); scene.collection.objects.link(root)
    for ob in obs: ob.parent = root
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "vial20.blend"))
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, "vial20.glb"), export_format="GLB", export_yup=True, export_apply=True)
    print("GLB", os.path.getsize(os.path.join(OUT, "vial20.glb")))
    sys.exit(0)

# ------------------------------------------------------------------ студи
closed = [] if ENV else build("closed", x=-1.9, closed=True)
opened = [] if ENV else build("open", x=1.9, closed=False)
for ob in closed + opened:
    if ob.name.endswith(("_glass", "_iface", "_ltop")):
        ob.visible_shadow = True
        ob.cycles.is_caustics_caster = True

# Муруй дэвсгэр (cyclorama): шал → зөөлөн муруй → арын хана.
prof = [(-60, 0)] + [(18 + 26 * math.sin(a), 26 - 26 * math.cos(a)) for a in [i * math.pi / 2 / 24 for i in range(25)]] + [(44, 70)]
bm = bmesh.new(); W = 90
rows = [[bm.verts.new((sx, y, z)) for sx in (-W, W)] for (y, z) in prof]
for i in range(len(rows) - 1):
    bm.faces.new((rows[i][0], rows[i][1], rows[i + 1][1], rows[i + 1][0]))
me = bpy.data.meshes.new("cyc"); bm.to_mesh(me); bm.free()
for p in me.polygons: p.use_smooth = True
cyc = bpy.data.objects.new("cyclorama", me); scene.collection.objects.link(cyc)
cyc_m, _ = principled("backdrop", **{"Base Color": srgb("#e9e9ec"), "Roughness": 0.55})
cyc.data.materials.append(cyc_m); cyc.cycles.is_caustics_receiver = True


def softbox(name, loc, size, energy, aim=(0, 0, 5.5), color=(1, 1, 1), caustics=True):
    d = bpy.data.lights.new(name, "AREA"); d.shape = "RECTANGLE"; d.size, d.size_y = size
    d.energy = energy; d.color = color; d.cycles.is_caustics_light = caustics
    L = bpy.data.objects.new(name, d); L.location = loc; scene.collection.objects.link(L)
    c = L.constraints.new("TRACK_TO"); tgt = bpy.data.objects.new(name + "_aim", None)
    tgt.location = aim; scene.collection.objects.link(tgt); c.target = tgt
    c.track_axis = "TRACK_NEGATIVE_Z"; c.up_axis = "UP_Y"
    return L

softbox("key", (14, -14, 9), (4, 18), 5200)                       # гол: баруун урд, урт
softbox("fill", (-16, -10, 7), (3, 18), 1800)                     # дүүргэлт: зүүн
softbox("rim_l", (-7, 12, 7), (0.8, 18), 2400, caustics=False)    # ирмэгийн зураас (ард)
softbox("rim_r", (7, 12, 7), (0.8, 18), 2400, caustics=False)
softbox("top", (0, -2, 24), (12, 6), 1600, aim=(0, 0, 0))         # дээрээс зөөлөн
# Дэвсгэрийг тусад нь гэрэлтүүлнэ — хана шалтай ижил цайвар болж, муруйлтын
# шугам харагдахгүй (seamless). Савнуудад тусахгүй: зөвхөн хана руу.
bd = softbox("backdrop", (0, 6, 34), (60, 30), 9000, aim=(0, 40, 18), caustics=False)
bd.visible_glossy = False

world = bpy.data.worlds.new("w"); scene.world = world
world.color = (0.14, 0.14, 0.15)

cam_d = bpy.data.cameras.new("cam"); cam_d.lens = 85; cam_d.sensor_fit = "VERTICAL"; cam_d.sensor_height = 24
cam_d.dof.use_dof = True; cam_d.dof.focus_distance = 52; cam_d.dof.aperture_fstop = 11
cam = bpy.data.objects.new("cam", cam_d); scene.collection.objects.link(cam); scene.camera = cam
cam.location = (0, -52, 6.4); cam.rotation_euler = (math.radians(89.6), 0, 0)

r = scene.render; r.engine = "CYCLES"; r.resolution_x = 880; r.resolution_y = 1100
c = scene.cycles; c.device = "CPU"; c.samples = 128; c.use_denoising = True
c.max_bounces = 32; c.transmission_bounces = 24; c.glossy_bounces = 8; c.transparent_max_bounces = 16
c.caustics_reflective = True; c.caustics_refractive = True; c.blur_glossy = 0.4
try:
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
except Exception as e:
    print("AgX look:", e)

if ENV:
    # Гэрлүүд камерт харагддаггүй тул ижил хэмжээтэй гэрэлтдэг хавтан нэмнэ —
    # вэб дээрх тусгалд softbox-ууд яг рендерийнх шиг зурвас болж харагдана.
    bpy.context.view_layer.update()
    for L in [o for o in scene.objects if o.type == "LIGHT"]:
        d = L.data
        bpy.ops.mesh.primitive_plane_add(size=1)
        pl = bpy.context.active_object; pl.name = L.name + "_panel"
        pl.matrix_world = L.matrix_world.copy()
        pl.scale = (d.size, d.size_y, 1)
        em = bpy.data.materials.new(pl.name); em.use_nodes = True
        nt = em.node_tree; nt.nodes.clear()
        e = nt.nodes.new("ShaderNodeEmission"); o = nt.nodes.new("ShaderNodeOutputMaterial")
        e.inputs["Strength"].default_value = d.energy / (d.size * d.size_y * math.pi) * 0.25
        nt.links.new(e.outputs[0], o.inputs["Surface"]); pl.data.materials.append(em)
        pl.visible_shadow = False
    # Савны төв орчмоос 360° (equirectangular) камер.
    cam.location = (0, 0, 5.5); cam.rotation_euler = (math.radians(90), 0, 0)
    cam_d.dof.use_dof = False
    cam_d.type = "PANO"
    try:
        cam_d.panorama_type = "EQUIRECTANGULAR"
    except Exception:
        cam_d.cycles.panorama_type = "EQUIRECTANGULAR"
    r.resolution_x = 1024; r.resolution_y = 512
    c.samples = 96
    scene.view_settings.view_transform = "Standard"; scene.view_settings.look = "None"
    r.image_settings.file_format = "HDR"
    r.filepath = os.path.join(OUT, "studio.hdr")
    bpy.ops.render.render(write_still=True)
    print("env rendered"); sys.exit(0)

r.filepath = os.path.join(OUT, f"studio_{FINISH}.png")
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, f"studio_{FINISH}.blend"))
bpy.ops.render.render(write_still=True)
print("rendered", FINISH)
