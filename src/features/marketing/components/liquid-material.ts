import * as THREE from "three";

/**
 * Цалгидаг шингэний материал (MeshPhysicalMaterial + onBeforeCompile).
 *
 * Шингэний mesh нь савны дотор талыг БҮТЭН дүүргэсэн хаалттай бие. Shader нь
 * world-space дээрх хазгай хавтгайгаар (гадаргуу) дээд хэсгийг нь тайрч
 * хаяна — тиймээс сав хазайхад гадаргуу үргэлж хэвтээ хэвээр, сав хөдлөхөд
 * `uWobble` (налуу) хэлбэлзэж цалгина. Тайрсан нүхээр харагдах арын
 * нүүрүүдийг (back face) гадаргуу болгон зурна: нормаль = хавтгайн нормаль,
 * өнгө нь арай цайвар — ингэснээр гэрэл/тусгалтай жинхэнэ гадаргуу шиг.
 */
export interface LiquidUniforms {
  /** Гадаргын төвийн world Y. */
  uSurfaceY: { value: number };
  /** Савны тэнхлэгийн world XZ (налуу энэ цэгээс тооцогдоно). */
  uCenter: { value: THREE.Vector2 };
  /** Гадаргын налуу (dY/dX, dY/dZ) — цалгилт. */
  uWobble: { value: THREE.Vector2 };
  /** Жижиг долгионы хүч (0–1) ба цаг. */
  uRipple: { value: number };
  uTime: { value: number };
  uSurfaceColor: { value: THREE.Color };
}

/**
 * `glow` — цагаан бүдэг дотоод гэрэл (emissive) + арай хүчтэй тусгал.
 * Тунгалаг ус хар дэвсгэр дээр харагдахгүй, цайвар дэвсгэр дээр хоосон
 * шилнээс ялгарахгүй байсан — бүх theme дээр шингэнийг цагаан өнгөөр ялгана.
 */
export function createLiquidMaterial(color: string, glow = 0) {
  const uniforms: LiquidUniforms = {
    uSurfaceY: { value: 0 },
    uCenter: { value: new THREE.Vector2() },
    uWobble: { value: new THREE.Vector2() },
    uRipple: { value: 0 },
    uTime: { value: 0 },
    uSurfaceColor: {
      value: new THREE.Color(color),
    },
  };

  // Тунгалаг шингэн: жинхэнэ transmission (ард байгаа зүйл хугарч харагдана),
  // өнгө нь гадаргуу дээр биш ЗУЗААНААР шингээгдэнэ (attenuation) — ингэж
  // сүү шиг цагаан биш, ус шиг тунгалаг, үл ялиг туяатай болно.
  const material = new THREE.MeshPhysicalMaterial({
    color: "#ffffff",
    roughness: 0.02,
    metalness: 0,
    transmission: 1,
    thickness: 2,
    ior: 1.33,
    attenuationColor: new THREE.Color(color),
    attenuationDistance: 9,
    // Шилтэй адил — босоо тусгалын зураас үүсгэхгүйн тулд сул.
    specularIntensity: 0.3 + 0.4 * glow,
    envMapIntensity: 0.3 + 0.5 * glow,
    emissive: new THREE.Color("#ffffff"),
    emissiveIntensity: 0.2 * glow,
    transparent: false,
    side: THREE.DoubleSide,
  });

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vLiqWorld;",
      )
      .replace(
        "#include <project_vertex>",
        "#include <project_vertex>\nvLiqWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vLiqWorld;
uniform float uSurfaceY;
uniform vec2 uCenter;
uniform vec2 uWobble;
uniform float uRipple;
uniform float uTime;
uniform vec3 uSurfaceColor;
float liquidSurface(vec3 p) {
  vec2 d = p.xz - uCenter;
  float r = length(d);
  // Налуу хавтгай + төвөөс тархах жижиг долгион.
  return uSurfaceY + dot(d, uWobble)
    + uRipple * 0.05 * sin(r * 8.0 - uTime * 9.0) * exp(-r * 0.6);
}`,
      )
      .replace(
        "void main() {",
        `void main() {
  if (vLiqWorld.y > liquidSurface(vLiqWorld)) discard;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
  if (!gl_FrontFacing) diffuseColor.rgb = uSurfaceColor;`,
      )
      .replace(
        "#include <normal_fragment_begin>",
        `#include <normal_fragment_begin>
  if (!gl_FrontFacing) {
    normal = normalize((viewMatrix * vec4(-uWobble.x, 1.0, -uWobble.y, 0.0)).xyz);
  }`,
      );
  };
  material.customProgramCacheKey = () => "vonscent-liquid-wobble";

  return { material, uniforms };
}

/**
 * Цалгилтын физик: пүрш + сааруулагч (damped spring). Савны (шингэний төвийн)
 * хурдатгал ба хазайлтын хурд нь гадаргууг эсрэг тал руу нь түлхэнэ.
 */
/** Хурдатгалын нөлөө: k/g·4 (k=100, g=981 см/с²). */
const ACC_GAIN = 0.4;
/** Хазайлтын хурдны нөлөө — сав огцом найгахад шингэн хоцорч цалгина. */
const TILT_GAIN = 14;

export class LiquidSlosh {
  private w = new THREE.Vector2(); // налуу
  private v = new THREE.Vector2(); // налуугийн хурд
  private prevPos = new THREE.Vector3();
  private prevVel = new THREE.Vector3();
  private prevUp = new THREE.Vector3(0, 1, 0);
  private started = false;
  private tmp = new THREE.Vector3();
  private up = new THREE.Vector3();
  private acc = new THREE.Vector3();
  private vel = new THREE.Vector3();
  private quat = new THREE.Quaternion();

  /** ~1.6Hz хэлбэлзэл, сул сааралт — хэд хэдэн удаа цалгиж байж намдана. */
  constructor(
    private stiffness = 100,
    private damping = 2.6,
    private maxSlope = 0.55,
  ) {}

  /** Буцаах утга: хөдөлгөөн үргэлжилж байгаа эсэх (invalidate хийх эсэх). */
  update(
    obj: THREE.Object3D,
    localCenter: THREE.Vector3,
    fillLocalY: number,
    uniforms: LiquidUniforms,
    dt: number,
    time: number,
  ): boolean {
    dt = Math.min(Math.max(dt, 1 / 240), 1 / 30);
    const pos = obj.localToWorld(this.tmp.copy(localCenter));
    this.up.set(0, 1, 0).applyQuaternion(obj.getWorldQuaternion(this.quat));

    if (!this.started) {
      this.prevPos.copy(pos);
      this.prevUp.copy(this.up);
      this.started = true;
    }
    this.vel.copy(pos).sub(this.prevPos).divideScalar(dt);
    this.acc.copy(this.vel).sub(this.prevVel).divideScalar(dt);
    const dUpX = (this.up.x - this.prevUp.x) / dt;
    const dUpZ = (this.up.z - this.prevUp.z) / dt;

    // Хурдатгал → гадаргуу эсрэг тал руу налана (тэнцвэрт налуу ≈ a/g,
    // нүдэнд харагдах хэмжээнд ~4 дахин өсгөсөн); хазайлтын хурд → инерци.
    const fx = -this.acc.x * ACC_GAIN - dUpX * TILT_GAIN;
    const fz = -this.acc.z * ACC_GAIN - dUpZ * TILT_GAIN;
    // Жижиг алхмуудаар (≤1/120с) — урт frame дээр ч тогтвортой.
    const sub = Math.max(1, Math.ceil(dt * 120));
    const h = dt / sub;
    for (let i = 0; i < sub; i++) {
      this.v.x +=
        (fx - this.stiffness * this.w.x - this.damping * this.v.x) * h;
      this.v.y +=
        (fz - this.stiffness * this.w.y - this.damping * this.v.y) * h;
      this.w.addScaledVector(this.v, h);
    }
    if (this.w.length() > this.maxSlope) this.w.setLength(this.maxSlope);

    this.prevPos.copy(pos);
    this.prevVel.copy(this.vel);
    this.prevUp.copy(this.up);

    // Гадаргын өндөр = савны тэнхлэг дээрх дүүргэлтийн цэгийн world Y.
    const fill = obj.localToWorld(
      this.tmp.set(localCenter.x, fillLocalY, localCenter.z),
    );
    uniforms.uSurfaceY.value = fill.y;
    uniforms.uCenter.value.set(fill.x, fill.z);
    uniforms.uWobble.value.copy(this.w);
    const energy = this.w.length() + this.v.length() * 0.1;
    uniforms.uRipple.value = Math.min(1, energy * 2);
    uniforms.uTime.value = time;

    return energy > 0.002 || this.vel.lengthSq() > 1e-4;
  }

  /** Гаднаас түлхэлт (жишээ нь сонгоход сав «үсрэх»). */
  kick(x: number, z: number) {
    this.v.x += x;
    this.v.y += z;
  }
}
