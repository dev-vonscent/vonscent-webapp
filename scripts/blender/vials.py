"""
Vonscent decant савнууд — 2/5/10/20мл, бодит хэмжээ (1 Blender нэгж = 1 см, Z дээш).
Хэмжээс нь барааны 3 дахь зураг (public/bottles/*):
  2мл  Ø1.4 × 5.2   — тунгалаг шилэн vial + хар хөвөөтэй хөвөө + шовгор таг
  5мл  Ø1.9 × 8.5   — металл гэр + ил шүршигч (таггүй)
  10мл Ø2.3 × 9.9   — металл гэр + цагираг + таг
  20мл Ø2.6 × 11.4  — металл гэр + цагираг + таг

  python vials.py -- <out>                    # вэб: vials.glb + vials.blend
  python vials.py -- <out> --shadows          # сав бүрийн доорх сүүдэр (shadow_<ml>.png)
  python vials.py -- <out> --render <finish>  # 4 савны студийн рендер (black|pink|silver)
  python vials.py -- <out> --env              # студийн 360° HDR (вэбийн орчны гэрэл)
                                              #   → scripts/hero-env/ руу хуулаад `pnpm hero:gainmap`
  python vials.py -- <out> --env-dark         # хар theme-ийн студи (хар шал/дэвсгэр)

Вэбийн GLB-д шингэн БҮТЭН өндрөөр (түвшин/цалгилтыг shader тайрна); дүүргэлтийн
түвшин нь объектын `fill` (glTF extras → three userData.fill).

GLB-г public/models-д хуулсны дараа ЗААВАЛ `pnpm hero:glb` (meshopt шахалт ~3.4×,
+ hero-assets.json). Нэг файл дээр ГАНЦ удаа — шахсан файлыг дахин бүү шах.

Бодит харагдуулах дүрмүүд: шил хоёр давхар гадаргуутай, ирмэгүүд дугуйлсан; рендерт
шил↔шингэний ЗААГ гадаргуу (IOR 1.5/1.36) — давхцуулбал Cycles-д шингэн харладаг;
шилэнд бичил roughness noise; ягаан/мөнгөлөг гэр brushed (anisotropic); студи:
муруй дэвсгэр, 2 урт softbox + 2 rim strip + дээд + дэвсгэрийн гэрэл, AgX, shadow caustics.
"""
import math, sys, os
import bpy, bmesh
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
OUT = args[0]
ENV_DARK = "--env-dark" in args  # хар theme: шал/дэвсгэр хар (гялгар хар гэр доод хэсэгтээ саарал тусгалгүй)
ENV = "--env" in args or ENV_DARK
SHADOWS = "--shadows" in args
FINISH = args[args.index("--render") + 1] if "--render" in args else ("black" if (ENV or SHADOWS) else None)
WEB = FINISH is None
SEG = 48 if WEB else 128

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ------------------------------------------------------------- геометр

def fillet(pts, radius_at, steps=None):
    steps = steps or (4 if WEB else 8)
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


def lathe(name, profile, loc=(0, 0, 0), seg=None):
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
    """Нээлттэй гадаргуугийн нормалийг outward(центр) чиглэлд эргүүлнэ."""
    me = ob.data
    score = sum(p.normal.dot(outward(p.center)) for p in me.polygons)
    if score < 0:
        for p in me.polygons: p.flip()
        me.update()

# ------------------------------------------------------------ материал

def principled(name, **kw):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    for k, v in kw.items(): b.inputs[k].default_value = v
    return m, b


def srgb(h):
    h = h.lstrip("#"); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c) + (1,)


FINISHES = {
    #          гэр: өнгө, roughness, anisotropic, лак      цагираг/шүршигч: өнгө, roughness
    "black":  (srgb("#0b0b0d"), 0.16, 0.0, True,         srgb("#121214"), 0.06),
    "pink":   (srgb("#e48aa8"), 0.32, 0.55, False,       srgb("#f0f0f3"), 0.03),
    "silver": (srgb("#d6d7dc"), 0.28, 0.6, False,        srgb("#f4f4f6"), 0.03),
}
fin = FINISHES[FINISH or "black"]

M_SLEEVE, b = principled("shell", **{"Base Color": fin[0], "Metallic": 1.0, "Roughness": fin[1],
                                     "Anisotropic": fin[2], "Coat Weight": 1.0 if fin[3] else 0.0, "Coat Roughness": 0.04})
if fin[2] > 0:
    nt = M_SLEEVE.node_tree
    tan = nt.nodes.new("ShaderNodeTangent"); tan.direction_type = "RADIAL"; tan.axis = "Z"
    nt.links.new(tan.outputs["Tangent"], b.inputs["Tangent"])
M_TRIM, _ = principled("trim", **{"Base Color": fin[4], "Metallic": 1.0, "Roughness": fin[5]})
M_SPRAYER, _ = principled("sprayer", **{"Base Color": fin[4], "Metallic": 0.9 if fin[3] else 1.0, "Roughness": fin[5] + 0.08})
M_PLASTIC, _ = principled("plastic", **{"Base Color": srgb("#111113"), "Roughness": 0.42, "Coat Weight": 0.4})

M_GLASS, gb = principled("glass", **{"Base Color": (1, 1, 1, 1), "Transmission Weight": 1.0, "Roughness": 0.0, "IOR": 1.5})
nt = M_GLASS.node_tree
noise = nt.nodes.new("ShaderNodeTexNoise"); noise.inputs["Scale"].default_value = 18.0; noise.inputs["Detail"].default_value = 6
rmap = nt.nodes.new("ShaderNodeMapRange"); rmap.inputs["To Min"].default_value = 0.0; rmap.inputs["To Max"].default_value = 0.035
rmap.inputs["From Min"].default_value = 0.45; rmap.inputs["From Max"].default_value = 0.75
nt.links.new(noise.outputs["Fac"], rmap.inputs["Value"]); nt.links.new(rmap.outputs["Result"], gb.inputs["Roughness"])

TINT = srgb("#f6ead0")
M_LIQUID, _ = principled("liquid", **{"Base Color": TINT, "Transmission Weight": 1.0, "Roughness": 0.0, "IOR": 1.36})
M_IFACE, _ = principled("glass_liquid_iface", **{"Base Color": TINT, "Transmission Weight": 1.0, "Roughness": 0.0, "IOR": 1.5 / 1.36})
M_TUBE, _ = principled("tube", **{"Base Color": (0.95, 0.95, 0.95, 1), "Transmission Weight": 0.8, "Roughness": 0.3, "IOR": 1.45})
M_SPRING, _ = principled("spring", **{"Base Color": srgb("#d9d9de"), "Metallic": 1.0, "Roughness": 0.25})
M_HOLE, _ = principled("nozzle", **{"Base Color": (0.75, 0.75, 0.75, 1), "Roughness": 0.4})

# ---------------------------------------------------------------- сав
#            мөр: радиус, өндөр     товч: радиус, өндөр
SPRAYERS = {
    5:  (0.89, 1.38,             0.74, 1.37),   # орой 8.5 (таг 8.62)
    10: (1.08, 1.72,             0.77, 1.56),   # орой 9.78 (таг 9.9)
    20: (1.22, 1.85,             0.87, 1.68),   # орой 11.28 (таг 11.4)
}

TRIM_H = 0.2; WALL = 0.05
ATOMIZERS = {
    #   R      гэрийн дээд   H      шилний R  таг
    20: (1.30, 7.55,         11.4,  1.10,     True),
    10: (1.15, 6.30,         9.9,   0.96,     True),
    5:  (0.95, 5.55,         8.62,  0.78,     True),   # тагтай (таггүйгээр 8.5)
}


def tube(prefix, x, top, bottom_x, bottom_z, r=0.045):
    cu = bpy.data.curves.new(f"{prefix}_tube_curve", "CURVE"); cu.dimensions = "3D"
    cu.bevel_depth = r; cu.bevel_resolution = 3
    sp = cu.splines.new("BEZIER"); sp.bezier_points.add(2)
    for bp, co in zip(sp.bezier_points, [(x + 0.12, 0, top), (x + 0.16, 0, top * 0.3), (x + bottom_x, 0, bottom_z)]):
        bp.co = co; bp.handle_left_type = bp.handle_right_type = "AUTO"
    tco = bpy.data.objects.new(f"{prefix}_tube", cu); scene.collection.objects.link(tco)
    bpy.ops.object.select_all(action="DESELECT"); bpy.context.view_layer.objects.active = tco; tco.select_set(True)
    bpy.ops.object.convert(target="MESH"); t = bpy.context.active_object; t.name = f"{prefix}_tube"
    t.data.materials.clear(); t.data.materials.append(M_TUBE)
    for p in t.data.polygons: p.use_smooth = True
    return t


def nozzle(prefix, x, r_act, z):
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.075 * (r_act / 0.62) ** 0.5, depth=0.04,
                                        location=(x, -r_act, z), rotation=(math.pi / 2, 0, 0))
    n = bpy.context.active_object; n.name = f"{prefix}_nozzle"; n.data.materials.append(M_HOLE)
    return n


def glass_and_liquid(prefix, x, GR, GW, g_top, inner_bottom, fill, obs, add):
    """Шил + шингэн. Вэб: шил нэг бие, шингэн бүтэн өндөр. Рендер: заг гадаргуу."""
    L = (x, 0, 0); IR = GR - GW
    if WEB:
        add(lathe(f"{prefix}_glass", fillet([(0, 0.06), (GR, 0.06), (GR, g_top), (IR, g_top), (IR, inner_bottom), (0, inner_bottom)],
                                            {1: GR * 0.22, 2: 0.03, 3: 0.03, 4: IR * 0.18}), loc=L), M_GLASS)
        liq = add(lathe(f"{prefix}_liquid", fillet([(0, inner_bottom - 0.002), (IR + 0.002, inner_bottom - 0.002), (IR + 0.002, g_top - 0.45), (0, g_top - 0.45)],
                                                   {1: IR * 0.18}), loc=L), M_LIQUID)
        liq["fill"] = fill
        return
    MEN = fill + 0.07
    g = add(lathe(f"{prefix}_glass", fillet([(IR, MEN), (IR, g_top), (GR, g_top), (GR, 0.06), (0, 0.06)], {1: 0.03, 2: 0.03, 3: GR * 0.22}), loc=L), M_GLASS)
    def glass_out(c):
        rr = math.hypot(c.x - x, c.y)
        if c.z < 0.08: return Vector((0, 0, -1))
        if rr > GR - 0.02: return Vector(((c.x - x) / rr, c.y / rr, 0))
        return Vector((-(c.x - x) / max(rr, 1e-6), -c.y / max(rr, 1e-6), 0))
    orient(g, glass_out)
    f = add(lathe(f"{prefix}_iface", fillet([(0, inner_bottom), (IR, inner_bottom), (IR, MEN)], {1: IR * 0.18}), loc=L), M_IFACE)
    def into_liquid(c):
        rr = math.hypot(c.x - x, c.y)
        if c.z < inner_bottom + 0.1 and rr < IR * 0.8: return Vector((0, 0, 1))
        v = Vector((-(c.x - x), -c.y, 0.0)); return v.normalized() if v.length > 1e-6 else Vector((0, 0, 1))
    orient(f, into_liquid)
    t = add(lathe(f"{prefix}_ltop", [(IR, MEN), (IR - 0.04, fill + 0.03), (IR - 0.1, fill + 0.01), (IR - 0.22, fill), (0, fill)], loc=L), M_LIQUID)
    orient(t, lambda c: Vector((0, 0, 1)))


def build(ml, prefix, x=0.0, closed=True):
    L = (x, 0, 0); obs = []
    def add(ob, m=None):
        if m is not None: ob.data.materials.append(m)
        obs.append(ob); return ob

    if ml == 2:
        # Бодит 2мл (зургаас, хөвөөний Ø1.4-өөр масштаблав):
        #   шил 0–2.3, амсрын хөвөө 2.3–2.42, хөвөөтэй хөвөө 2.42–3.38,
        #   мөр Ø1.21 3.38–3.86, товч Ø1.05 3.86–4.91 (нүхтэй),
        #   таг: доод Ø1.49 → дээд Ø1.32, 2.9–5.2 (хөвөөний доод ~5мм ил).
        #   Шилэн дотор: насосны хоолой + пүрш + муруй гуурс.
        GR, H, NECK = 0.67, 5.2, 2.3
        glass_and_liquid(prefix, x, GR, 0.06, NECK + 0.05, 0.14, 1.65, obs, add)
        add(lathe(f"{prefix}_lip", fillet([(0, NECK - 0.02), (GR - 0.01, NECK - 0.02), (GR - 0.01, NECK + 0.12), (0, NECK + 0.12)], {1: 0.02, 2: 0.02}), loc=L), M_PLASTIC)
        c0, c1 = NECK + 0.12, NECK + 1.08; ribs = 16
        pts = [(0, c0), (0.69, c0)]
        for k in range(ribs * 2 + 1):
            z = c0 + (c1 - c0) * k / (ribs * 2)
            pts.append((0.72 if k % 2 else 0.70, z))
        pts += [(0.66, c1 + 0.02), (0, c1 + 0.02)]
        add(lathe(f"{prefix}_collar", pts, loc=L), M_PLASTIC)
        sh_top, act_top = c1 + 0.48, c1 + 1.53
        add(lathe(f"{prefix}_actuator", fillet([(0, c1), (0.605, c1), (0.605, sh_top), (0.525, sh_top), (0.525, act_top), (0, act_top)],
                                               {1: 0.02, 2: 0.04, 3: 0.02, 4: 0.07}), loc=L), M_PLASTIC)
        add(nozzle(prefix, x, 0.525, act_top - 0.3))
        cap_b = c0 + 0.48
        if closed: add(lathe(f"{prefix}_cap", fillet([(0.722, cap_b), (0.745, cap_b), (0.66, H), (0, H), (0, H - 0.05), (0.635, H - 0.05), (0.722, cap_b + 0.05)],
                                          {1: 0.02, 2: 0.06}), loc=L), M_PLASTIC)
        # Насосны хоолой (тунгалаг) + пүрш (металл) + гуурс
        add(lathe(f"{prefix}_pump", fillet([(0, 1.05), (0.09, 1.05), (0.1, 1.5), (0.16, 1.6), (0.16, NECK + 0.05), (0, NECK + 0.05)], {2: 0.04, 3: 0.04}), loc=L), M_TUBE)
        cu = bpy.data.curves.new(f"{prefix}_spring_curve", "CURVE"); cu.dimensions = "3D"; cu.bevel_depth = 0.018; cu.bevel_resolution = 1 if WEB else 3
        sp = cu.splines.new("POLY"); turns, n = 7, 7 * (14 if WEB else 32)
        sp.points.add(n - 1)
        for k in range(n):
            t = k / (n - 1); a = 2 * math.pi * turns * t
            sp.points[k].co = (x + 0.13 * math.cos(a), 0.13 * math.sin(a), 1.62 + t * (NECK - 1.62), 1)
        so = bpy.data.objects.new(f"{prefix}_spring", cu); scene.collection.objects.link(so)
        bpy.ops.object.select_all(action="DESELECT"); bpy.context.view_layer.objects.active = so; so.select_set(True)
        bpy.ops.object.convert(target="MESH"); so = bpy.context.active_object; so.name = f"{prefix}_spring"
        so.data.materials.clear(); so.data.materials.append(M_SPRING)
        for p in so.data.polygons: p.use_smooth = True
        add(so)
        add(tube(prefix, x, 1.08, 0.42, 0.2, r=0.028))
        return obs

    R, ST, H, GR, has_cap = ATOMIZERS[ml]
    CAP_B = ST + TRIM_H
    s = R / 1.3
    if closed:
        add(lathe(f"{prefix}_sleeve", fillet([(0, 0), (R, 0), (R, ST), (R - WALL, ST), (R - WALL, 0.05), (0, 0.05)], {1: 0.12, 2: 0.02}), loc=L), M_SLEEVE)
        add(lathe(f"{prefix}_trim", fillet([(R - WALL, ST), (R + 0.004, ST), (R + 0.004, CAP_B), (R - WALL, CAP_B)], {1: 0.03, 2: 0.03}), loc=L), M_TRIM)
        if has_cap:
            add(lathe(f"{prefix}_cap", fillet([(R - WALL, CAP_B), (R, CAP_B), (R, H), (0, H), (0, H - 0.05), (R - WALL, H - 0.05)], {1: 0.02, 2: 0.12}), loc=L), M_SLEEVE)
    G_TOP = ST + 0.15
    glass_and_liquid(prefix, x, GR, 0.08 if ml == 20 else 0.07, G_TOP, 0.26 * s + 0.02, ST - 1.05 * s, obs, add)

    # Шүршигч: гэрийн дотор нарийн хүзүү → мөр (shoulder) → товч (actuator).
    # Хэмжээ нь бодит савны (таг авсан) зургаас: 5мл мөр ~96%/товч ~78%,
    # 10мл мөр ~94%/товч ~67% (гэрийн диаметртэй харьцуулсан). 20мл — 10мл-ийн
    # харьцаагаар. Тагтай савнуудад товчны орой тагийн дотор талаас 0.12см доор.
    sh_r, sh_h, act_r, act_h = SPRAYERS[ml]
    neck_r = min(GR + 0.06, R - WALL - 0.01)
    sh_top = CAP_B + sh_h
    act_top = sh_top + act_h
    # Хүзүү нь цагирагийн дотор (ST..CAP_B) л байна — доош цухуйвал шилээр
    # нэвт харагдаж цагирагийн доор «шилэн бөгж» шиг үлддэг байв.
    add(lathe(f"{prefix}_sprayer", fillet([(0, ST + 0.02), (neck_r, ST + 0.02), (neck_r, CAP_B), (sh_r, CAP_B), (sh_r, sh_top),
                                           (act_r, sh_top), (act_r, act_top), (0, act_top)],
                                          {1: 0.03, 3: 0.03, 4: 0.06, 5: 0.03, 6: 0.08}), loc=L), M_SPRAYER)
    add(nozzle(prefix, x, act_r, act_top - 0.35 * s))
    add(tube(prefix, x, ST - 0.15, 0.62 * s, 0.32 * s))
    return obs

# ---------------------------------------------------------------- гаралт
os.makedirs(OUT, exist_ok=True)
SIZES = (2, 5, 10, 20)

if WEB:
    for ml in SIZES:
        obs = build(ml, f"vial_{ml}")
        root = bpy.data.objects.new(f"vial_{ml}", None); scene.collection.objects.link(root)
        for ob in obs: ob.parent = root
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "vials.blend"))
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, "vials.glb"), export_format="GLB", export_yup=True,
                              export_apply=True, export_extras=True)
    print("GLB", os.path.getsize(os.path.join(OUT, "vials.glb")))
    sys.exit(0)

# --------------------------------------------------------------- студи
GAP = 1.6
DIAM = {2: 1.4, 5: 1.9, 10: 2.3, 20: 2.6}
xs = {}; cur = -(sum(DIAM.values()) + GAP * 3) / 2
for ml in SIZES:
    xs[ml] = cur + DIAM[ml] / 2; cur += DIAM[ml] + GAP

OPEN = "--open" in args   # шалгах рендер: гэр/таггүй (шүршигч ил)
if FINISH and not ENV and not SHADOWS:
    for ml in SIZES:
        for ob in build(ml, f"r{ml}", x=xs[ml], closed=not OPEN):
            if ob.name.endswith(("_glass", "_iface", "_ltop")):
                ob.cycles.is_caustics_caster = True

prof = [(-60, 0)] + [(18 + 26 * math.sin(a), 26 - 26 * math.cos(a)) for a in [i * math.pi / 2 / 24 for i in range(25)]] + [(44, 70)]
bm = bmesh.new(); W = 90
rows = [[bm.verts.new((sx, y, z)) for sx in (-W, W)] for (y, z) in prof]
for i in range(len(rows) - 1):
    bm.faces.new((rows[i][0], rows[i][1], rows[i + 1][1], rows[i + 1][0]))
me = bpy.data.meshes.new("cyc"); bm.to_mesh(me); bm.free()
for p in me.polygons: p.use_smooth = True
cyc = bpy.data.objects.new("cyclorama", me); scene.collection.objects.link(cyc)
cyc_m, _ = principled("backdrop", **{"Base Color": srgb("#0b0b0c" if ENV_DARK else "#e9e9ec"), "Roughness": 0.55})
cyc.data.materials.append(cyc_m); cyc.cycles.is_caustics_receiver = True


def softbox(name, loc, size, energy, aim=(0, 0, 5.5), caustics=True):
    d = bpy.data.lights.new(name, "AREA"); d.shape = "RECTANGLE"; d.size, d.size_y = size
    d.energy = energy; d.cycles.is_caustics_light = caustics
    Lo = bpy.data.objects.new(name, d); Lo.location = loc; scene.collection.objects.link(Lo)
    c = Lo.constraints.new("TRACK_TO"); tgt = bpy.data.objects.new(name + "_aim", None)
    tgt.location = aim; scene.collection.objects.link(tgt); c.target = tgt
    c.track_axis = "TRACK_NEGATIVE_Z"; c.up_axis = "UP_Y"
    return Lo

softbox("key", (14, -14, 9), (4, 18), 5200)
softbox("fill", (-16, -10, 7), (3, 18), 1800)
softbox("rim_l", (-7, 12, 7), (0.8, 18), 2400, caustics=False)
softbox("rim_r", (7, 12, 7), (0.8, 18), 2400, caustics=False)
softbox("top", (0, -2, 24), (12, 6), 1600, aim=(0, 0, 0))
bd = softbox("backdrop", (0, 6, 34), (60, 30), 9000, aim=(0, 40, 18), caustics=False)
bd.visible_glossy = False

world = bpy.data.worlds.new("w"); scene.world = world; world.color = (0.14, 0.14, 0.15)
cam_d = bpy.data.cameras.new("cam"); cam_d.lens = 85; cam_d.sensor_fit = "VERTICAL"; cam_d.sensor_height = 24
cam = bpy.data.objects.new("cam", cam_d); scene.collection.objects.link(cam); scene.camera = cam
r = scene.render; r.engine = "CYCLES"
c = scene.cycles; c.device = "CPU"; c.use_denoising = True
c.max_bounces = 32; c.transmission_bounces = 24; c.glossy_bounces = 8; c.transparent_max_bounces = 16
c.caustics_reflective = True; c.caustics_refractive = True; c.blur_glossy = 0.4

if SHADOWS:
    # Сав бүрийн доорх сүүдэр: шал = shadow catcher, дээрээс ortho камер.
    # Вэб дээр сав бүрийн доор, савтай хамт хөдөлдөг хавтгайд наана.
    cyc.is_shadow_catcher = True; r.film_transparent = True
    scene.view_settings.view_transform = "Standard"
    cam_d.type = "ORTHO"; cam_d.ortho_scale = 10; cam_d.sensor_fit = "AUTO"
    r.resolution_x = r.resolution_y = 320; c.samples = 96
    for ml in SIZES:
        obs = build(ml, f"s{ml}", x=0.0)
        for ob in obs: ob.visible_camera = False   # зөвхөн сүүдэр нь үлдэнэ
        cam.location = (0, 0, 40); cam.rotation_euler = (0, 0, 0)
        r.filepath = os.path.join(OUT, f"shadow_{ml}.png")
        bpy.ops.render.render(write_still=True)
        for ob in obs: bpy.data.objects.remove(ob, do_unlink=True)
        print("shadow", ml)
    sys.exit(0)

if ENV:
    bpy.context.view_layer.update()
    for Lo in [o for o in scene.objects if o.type == "LIGHT"]:
        d = Lo.data
        bpy.ops.mesh.primitive_plane_add(size=1); pl = bpy.context.active_object
        pl.matrix_world = Lo.matrix_world.copy(); pl.scale = (d.size, d.size_y, 1)
        em = bpy.data.materials.new(Lo.name + "_panel"); em.use_nodes = True; nt = em.node_tree; nt.nodes.clear()
        e = nt.nodes.new("ShaderNodeEmission"); o = nt.nodes.new("ShaderNodeOutputMaterial")
        e.inputs["Strength"].default_value = d.energy / (d.size * d.size_y * math.pi) * 0.25
        nt.links.new(e.outputs[0], o.inputs["Surface"]); pl.data.materials.append(em); pl.visible_shadow = False
    cam.location = (0, 0, 5.5); cam.rotation_euler = (math.radians(90), 0, 0); cam_d.type = "PANO"
    try: cam_d.panorama_type = "EQUIRECTANGULAR"
    except Exception: cam_d.cycles.panorama_type = "EQUIRECTANGULAR"
    r.resolution_x = 1024; r.resolution_y = 512; c.samples = 96
    scene.view_settings.view_transform = "Standard"
    r.image_settings.file_format = "HDR"; r.filepath = os.path.join(OUT, "studio_dark.hdr" if ENV_DARK else "studio.hdr")
    bpy.ops.render.render(write_still=True); print("env rendered"); sys.exit(0)

# 4 савны студийн рендер
cam_d.dof.use_dof = True; cam_d.dof.focus_distance = 62; cam_d.dof.aperture_fstop = 11
cam.location = (0, -62, 6.0); cam.rotation_euler = (math.radians(89.6), 0, 0)
r.resolution_x = 1400; r.resolution_y = 1000; c.samples = 128
scene.view_settings.view_transform = "AgX"
try: scene.view_settings.look = "AgX - Medium High Contrast"
except Exception as e: print("look", e)
r.filepath = os.path.join(OUT, f"lineup_{FINISH}{'_open' if OPEN else ''}.png")
if OPEN: r.resolution_x, r.resolution_y, c.samples = 1050, 750, 48
bpy.ops.render.render(write_still=True); print("rendered", FINISH)
