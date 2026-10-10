"use client";

import * as React from "react";
import { Canvas, addAfterEffect, useFrame, useThree } from "@react-three/fiber";
import { Environment, useGLTF } from "@react-three/drei";
import { GltfVial, SoftShadow, VIALS_URL } from "./vial-gltf";
import { LiquidSlosh } from "./liquid-material";
import { MAX_FRAME_MS, SAMPLE_COUNT, nextDpr } from "../adaptive-dpr";
import * as THREE from "three";
import type { MlSize } from "@/lib/constants";
import {
  VIAL_SPECS,
  finishForTheme,
  heroAsset,
  vialPositions,
  type VialFinish,
  type VialSpec,
} from "@/features/marketing/vial-specs";

/*
 * Дэлгүүрийн 4 бодит decant савыг жинхэнэ харьцаагаар (см) зэрэгцүүлсэн 3D
 * (туршилт). Сонгосон сав урагшилж нэг эргэнэ; металл гэр/таг нь
 * «рентген» мэт тунгалаг болж дотор нь ДҮҮРЭН шилэн vial харагдана —
 * «том саванд бага хийж өгдөг юм уу» гэсэн төөрөгдлийг арилгана.
 *
 * - Загвар: Blender-ийн GLB (vial-gltf.tsx, scripts/blender/vials.py).
 * - frameloop="demand": хөдөлгөөн байх үед л рендерлэнэ; hero дэлгэцээс
 *   гарвал "never" — GPU бүрэн амарна.
 * - Савны өнгө (хар/ягаан/мөнгөлөг) = theme. Эдгээр нь UI өнгө биш, бодит
 *   барааны материал тул энд тогтмолоор бичигдэв (public/bottles/*).
 */

interface Finish {
  sleeve: THREE.MeshPhysicalMaterialParameters;
  trim: THREE.MeshPhysicalMaterialParameters;
}

const FINISHES: Record<VialFinish, Finish> = {
  black: {
    sleeve: {
      color: "#0c0c0e",
      metalness: 0.85,
      roughness: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
    },
    trim: { color: "#141416", metalness: 1, roughness: 0.08 },
  },
  pink: {
    sleeve: { color: "#e48aa8", metalness: 0.5, roughness: 0.42 },
    trim: { color: "#ececf0", metalness: 1, roughness: 0.06 },
  },
  silver: {
    sleeve: { color: "#d4d5da", metalness: 1, roughness: 0.26 },
    trim: { color: "#f2f2f5", metalness: 1, roughness: 0.05 },
  },
};

/**
 * Шингэн — ус шиг тунгалаг (бүх theme дээр). Цагаан = өнгө шингээхгүй;
 * туяа нэмэх бол энд үл ялиг өнгө өгнө (зузаанд шингэнэ, attenuation).
 */
const LIQUID_COLOR = "#FFFFFF";

/**
 * Blender студийн 360° орчин — gainmap JPG (UltraHDR, ~50KB). Эх нь
 * `scripts/hero-env/studio.hdr` (vial20.py --env, 0.7MB); `pnpm hero:gainmap`.
 * drei `Environment` `.jpg`-г `HDRJPGLoader`-оор HDR болгон задална.
 */
const STUDIO_HDR = heroAsset("/models/studio.jpg");
/**
 * Хар theme: шал/дэвсгэр нь хар студи (vials.py --env-dark). Цайвар шал
 * гялгар хар гэрийн доод хэсэгт саарал болж тусдаг байв.
 */
const STUDIO_HDR_DARK = heroAsset("/models/studio_dark.jpg");
const ENV_ROTATION = new THREE.Euler(0, Math.PI / 2, 0);
/** Хар гэр нь орчныг бага тусгадаг тул арай хүчтэй. */
const ENV_INTENSITY: Record<VialFinish, number> = {
  black: 1.25,
  pink: 1,
  silver: 1,
};

/** Хэмжээний бүх хүрээ (см) — камер үүнийг дэлгэцэнд багтаана. */
// Камер ~5% ойр (анх 15 × 14.2): савнууд канвасыг дүүргэж, hero-гийн голд «санамсаргүй»
// хоосон зурвас үлдэхгүй. (Савнуудын өргөн ~12.1см, сонгосон нь урагшилна.)
const FIT_W = 14.3;
const FIT_H = 13.5;
const CENTER_Y = 5.6;
const FOV = 24;

interface ThemeInfo {
  finish: VialFinish;
  fg: string;
  bg: string;
}

function readTheme(): ThemeInfo {
  const el = document.documentElement;
  const cs = getComputedStyle(el);
  return {
    finish: finishForTheme(el.className),
    fg: cs.getPropertyValue("--foreground").trim() || "#ffffff",
    bg: cs.getPropertyValue("--background").trim() || "#000000",
  };
}

function useThemeInfo(): ThemeInfo {
  const [info, setInfo] = React.useState<ThemeInfo>(readTheme);
  React.useEffect(() => {
    const mo = new MutationObserver(() => setInfo(readTheme()));
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => mo.disconnect();
  }, []);
  return info;
}

export interface DecantLineup3DProps {
  ml: MlSize;
  onSelect: (ml: MlSize) => void;
  /** Хулганы байрлалыг энэ элементийн хүрээнд хэмжинэ. */
  trackRef: React.RefObject<HTMLElement | null>;
  onReady?: () => void;
  className?: string;
}

export default function DecantLineup3D({
  ml,
  onSelect,
  trackRef,
  onReady,
  className,
}: DecantLineup3DProps) {
  const theme = useThemeInfo();
  const onScreen = useOnScreen(trackRef);
  // DPR-ийн дээд хязгаар — `AdaptiveDpr` бууруулна. Prop-оор өгөх ёстой:
  // r3f Canvas дахин render болох бүрд `dpr` prop-оос DPR-ийг дахин тооцдог
  // тул `setDpr`-ийг шууд дуудвал хэмжээ солиход буцаад 2 болдог байв.
  const [maxDpr, setMaxDpr] = React.useState(2);
  return (
    <Canvas
      className={className}
      frameloop={onScreen ? "demand" : "never"}
      dpr={[1, maxDpr]}
      gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
      camera={{ fov: FOV, position: [0, CENTER_Y + 3, 40] }}
      onCreated={({ gl }) => {
        // Blender рендертэй ижил өнгө/тодрол (AgX view transform).
        gl.toneMapping = THREE.AgXToneMapping;
        gl.toneMappingExposure = 1.15;
      }}
      onPointerMissed={() => (document.body.style.cursor = "")}
    >
      {/* Дэвсгэр = хуудасны өнгө. Шил/шингэн гэрэл нэвтрүүлэхдээ ардах
          зургийг ашигладаг — тунгалаг (хар) канвас байвал шингэн саарал,
          бохир харагддаг. Хуудастай ижил өнгө тул зааг харагдахгүй. */}
      <color attach="background" args={[theme.bg]} />
      <FitCamera />
      <ResumeOnShow />
      <AdaptiveDpr onLower={setMaxDpr} />
      {/* Blender-ийн ЯГ ТЭР студи (scripts/blender/vial20.py --env) 360° HDR —
          металл/шилний тусгал рендертэй ижил болно. Blender нь Z-дээш,
          камер нь +Y руу харсан тул тэнхлэгийг эргүүлж тааруулна. */}
      {/* HDR, GLB хоёул ачаалагдтал хамт suspend — ReadySignal зөвхөн бүрэн
          бэлэн үзэгдэл дээр л дуудагдана (хагас зурагдсан сав харагдахгүй). */}
      <React.Suspense fallback={null}>
        <StudioEnvironment finish={theme.finish} />
        <Lineup
          ml={ml}
          onSelect={onSelect}
          trackRef={trackRef}
          finish={theme.finish}
        />
        <ReadySignal onReady={onReady} />
      </React.Suspense>
    </Canvas>
  );
}

/**
 * Hero (trackRef) дэлгэцэнд харагдаж байгаа эсэх. Харагдахгүй үед канвас
 * "never" — утасны найгалт ч, шингэний цалгилт ч frame хүсэхгүй. (Нуугдсан
 * tab-д браузер requestAnimationFrame-ийг өөрөө зогсоодог.)
 */
function useOnScreen(ref: React.RefObject<HTMLElement | null>) {
  const [on, setOn] = React.useState(true);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return on;
}

/** "never" → "demand" болоход нэг frame хүснэ (эс бөгөөс хөдөлгөөн үргэлжлэхгүй). */
function ResumeOnShow() {
  const frameloop = useThree((s) => s.frameloop);
  const invalidate = useThree((s) => s.invalidate);
  React.useEffect(() => {
    if (frameloop !== "never") invalidate();
  }, [frameloop, invalidate]);
  return null;
}

const STUDIO_FILES: Record<VialFinish, string> = {
  black: STUDIO_HDR_DARK,
  pink: STUDIO_HDR,
  silver: STUDIO_HDR,
};

/**
 * Theme солиход шинэ HDR ачаалагдтал ӨМНӨХ HDR-ийг харуулна. Suspense нь
 * аль хэдийн харагдсан агуулгыг дахин suspend болоход нуудаг тул Environment
 * гаднах Suspense-д байвал бүх сав түр алга болдог. Анхны ачаалалтад fallback
 * өөрөө suspend хийж гаднах Suspense (ReadySignal) руу дамжина — poster
 * HDR-гүй үзэгдэл рүү солигдохгүй.
 */
function StudioEnvironment({ finish }: { finish: VialFinish }) {
  const [shown, setShown] = React.useState(finish);
  return (
    <React.Suspense fallback={<StudioEnv finish={shown} />}>
      <StudioEnv finish={finish} onLoaded={setShown} />
    </React.Suspense>
  );
}

function StudioEnv({
  finish,
  onLoaded,
}: {
  finish: VialFinish;
  onLoaded?: (f: VialFinish) => void;
}) {
  const invalidate = useThree((s) => s.invalidate);
  React.useEffect(() => {
    onLoaded?.(finish);
    invalidate();
  }, [finish, onLoaded, invalidate]);
  return (
    <Environment
      files={STUDIO_FILES[finish]}
      environmentIntensity={ENV_INTENSITY[finish]}
      environmentRotation={ENV_ROTATION}
    />
  );
}

/**
 * Poster → 3D солилтын дохио. `onCreated` дээр дуудвал GLB/HDR ачаалагдаагүй,
 * shader compile хийгдээгүй байдаг тул poster алга болоод хоосон үзэгдэл
 * «үсэрч» харагддаг байв. Энд: GLB бэлэн (suspend) →
 * shader-үүдийг урьдчилан compile → 2 frame бодитоор зурсны дараа л дохио өгнө.
 */
function ReadySignal({ onReady }: { onReady?: () => void }) {
  useGLTF(VIALS_URL);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const frames = React.useRef(-1);
  const cb = React.useRef(onReady);
  React.useEffect(() => {
    cb.current = onReady;
  }, [onReady]);

  React.useEffect(() => {
    let alive = true;
    gl.compileAsync(scene, camera)
      .catch(() => undefined)
      .then(() => {
        if (!alive) return;
        frames.current = 0;
        invalidate();
      });
    return () => {
      alive = false;
    };
  }, [gl, scene, camera, invalidate]);

  useFrame(() => {
    if (frames.current < 0 || frames.current > 2) return;
    frames.current += 1;
    // Эхний frame-д transmission FBO дүүрнэ; 2 дахь нь бүрэн зураг.
    if (frames.current === 2) cb.current?.();
    else invalidate();
  });
  return null;
}

/**
 * Удаан GPU дээр DPR-ийг 2 → 1.5 → 1 болгоно (#6, `adaptive-dpr.ts`).
 * Зөвхөн дараалсан frame-ийн `dt`-г хэмждэг тул `demand` горимын idle
 * завсар «удаан» гэж тооцогдохгүй.
 */
function AdaptiveDpr({ onLower }: { onLower: (dpr: number) => void }) {
  const get = useThree((s) => s.get);
  const samples = React.useRef<number[]>([]);
  /** Өмнөх frame дараагийнхаа frame-ийг хүссэн эсэх (r3f loop-ийн төгсгөлд). */
  const chained = React.useRef(false);
  React.useEffect(
    () =>
      addAfterEffect(() => {
        chained.current = get().internal.frames > 0;
      }),
    [get],
  );
  useFrame((state, dt) => {
    const ms = dt * 1000;
    if (!chained.current || ms <= 0 || ms > MAX_FRAME_MS) return;
    samples.current.push(ms);
    if (samples.current.length < SAMPLE_COUNT) return;
    const current = state.viewport.dpr;
    const next = nextDpr(samples.current, current);
    samples.current = [];
    if (next !== current) onLower(next);
  });
  return null;
}

/** Канвасын харьцаанаас үл хамааран бүх савыг дэлгэцэнд багтаана. */
function FitCamera() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  React.useLayoutEffect(() => {
    fitToBox(camera, gl.domElement);
    invalidate();
  }, [camera, size, gl, invalidate]);
  return null;
}

/**
 * Канвас нь layout-ын хайрцгаасаа (эцэг элемент) том — эргэх/урагшлах үед
 * сав, сүүдэр ирмэгт тасрахгүй. Камер савнуудыг ХАЙРЦАГТ багтаана (хэмжээ
 * нь өөрчлөгдөхгүй), илүү гарсан хэсгийг setViewOffset-оор нэмж зурна.
 * Hook-ийн гадна: камерын объектыг өөрчилдөг.
 */
function fitToBox(
  camera: THREE.PerspectiveCamera & { manual?: boolean },
  canvas: HTMLCanvasElement,
) {
  const c = canvas.getBoundingClientRect();
  // r3f: <div className> > <div> > <canvas>; түүний эцэг = layout хайрцаг.
  const box =
    canvas.parentElement?.parentElement?.parentElement?.getBoundingClientRect() ??
    c;
  const bw = Math.max(box.width, 1);
  const bh = Math.max(box.height, 1);
  const t = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  const aspect = bw / bh;
  const dist = Math.max(FIT_H / 2 / t, FIT_W / 2 / (t * aspect));
  camera.manual = true; // r3f канвасын харьцаагаар aspect-ыг дарж бичихгүй
  camera.aspect = aspect;
  camera.setViewOffset(
    bw,
    bh,
    c.left - box.left,
    c.top - box.top,
    Math.max(c.width, 1),
    Math.max(c.height, 1),
  );
  camera.position.set(0, CENTER_Y + dist * 0.12, dist);
  camera.lookAt(0, CENTER_Y, 0);
  camera.updateProjectionMatrix();
}

function Lineup({
  ml,
  onSelect,
  trackRef,
  finish,
}: {
  ml: MlSize;
  onSelect: (ml: MlSize) => void;
  trackRef: React.RefObject<HTMLElement | null>;
  finish: VialFinish;
}) {
  const invalidate = useThree((s) => s.invalidate);
  const group = React.useRef<THREE.Group>(null);
  const target = React.useRef({ yaw: 0, pitch: 0 });
  const [fine, setFine] = React.useState(true);
  // Утсан дээр (hover-гүй) савнууд ачаалагдах ба сонгох бүрд хэдэн секунд
  // найгаад зогсоно — үргэлж найгавал "demand" нь тасралтгүй 60fps болж
  // утас халж, батарей иддэг.
  const swayFrom = React.useRef(0); // доорх effect mount дээр тохируулна
  const xs = React.useMemo(() => vialPositions(), []);

  React.useEffect(() => {
    const isFine = window.matchMedia(
      "(hover: hover) and (pointer: fine)",
    ).matches;
    setFine(isFine);
    const area = trackRef.current;
    if (!isFine || !area) return;
    const onMove = (e: PointerEvent) => {
      const r = area.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      target.current = { yaw: x * 0.6, pitch: y * 0.16 };
      invalidate();
    };
    const onLeave = () => {
      target.current = { yaw: 0, pitch: 0 };
      invalidate();
    };
    area.addEventListener("pointermove", onMove);
    area.addEventListener("pointerleave", onLeave);
    return () => {
      area.removeEventListener("pointermove", onMove);
      area.removeEventListener("pointerleave", onLeave);
    };
  }, [trackRef, invalidate]);

  React.useEffect(() => {
    swayFrom.current = performance.now();
    invalidate();
  }, [ml, finish, invalidate]);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const k = Math.min(1, dt * 4);
    const sway = fine
      ? 0
      : swayAmount((performance.now() - swayFrom.current) / 1000);
    const t = fine ? target.current : { yaw: sway, pitch: 0 };
    const dy = t.yaw - g.rotation.y;
    const dx = t.pitch - g.rotation.x;
    g.rotation.y += dy * k;
    g.rotation.x += dx * k;
    if (sway !== 0 || Math.abs(dy) > 0.0005 || Math.abs(dx) > 0.0005)
      invalidate();
  });

  return (
    <group ref={group}>
      {VIAL_SPECS.map((spec, i) => (
        <Vial
          key={spec.ml}
          spec={spec}
          x={xs[i]}
          selected={spec.ml === ml}
          finish={finish}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}

const SWAY_HOLD_S = 6;
const SWAY_FADE_S = 2;

/** Утасны найгалт (радиан): SWAY_HOLD_S тоглоод SWAY_FADE_S-д 0 болж зогсоно. */
function swayAmount(t: number): number {
  const fade = 1 - (t - SWAY_HOLD_S) / SWAY_FADE_S;
  if (fade <= 0) return 0;
  return Math.sin(t * 0.5) * 0.22 * Math.min(1, fade);
}

/** Нэг сав: байрлал/сонголтын анимаци + төрөл бүрийн бүтэц. */
function Vial({
  spec,
  x,
  selected,
  finish,
  onSelect,
}: {
  spec: VialSpec;
  x: number;
  selected: boolean;
  finish: VialFinish;
  onSelect: (ml: MlSize) => void;
}) {
  const invalidate = useThree((s) => s.invalidate);
  const root = React.useRef<THREE.Group>(null);
  const tiltGroup = React.useRef<THREE.Group>(null);
  const cap = React.useRef<THREE.Object3D>(null);
  const reveal = React.useRef(selected ? 1 : 0);
  // Хазайлтын пүрш (радиан): чирэхэд дагаж хазайна, тавихад савлаж буцна.
  const tilt = React.useRef({ x: 0, z: 0, vx: 0, vz: 0 });
  const tiltTarget = React.useRef({ x: 0, z: 0 });
  const [slosh] = React.useState(() => new LiquidSlosh());
  const spin = React.useRef(0);
  const spinTarget = React.useRef(0);

  // Сонгогдох бүрд нэг удаа эргэнэ — металлын гэрэл тусгал гүйж «амьд» болно.
  React.useEffect(() => {
    if (selected) {
      spinTarget.current += Math.PI * 2;
      // Сонгогдох үед жаахан найгана — шингэн цалгина.
      tilt.current.vz += 1.8;
    }
    invalidate();
  }, [selected, invalidate]);

  const r = spec.d / 2;
  const mats = React.useMemo(() => {
    const f = FINISHES[finish];
    const shell = new THREE.MeshPhysicalMaterial({
      ...f.sleeve,
      transparent: true,
    });
    const trim = new THREE.MeshPhysicalMaterial({
      ...f.trim,
      transparent: true,
    });
    // Таг нь тусдаа материал — сонгоход бүрэн алга болно (сүнс давхарга үлдэхгүй).
    const cap = shell.clone();
    return { shell, trim, cap };
  }, [finish]);
  React.useEffect(
    () => () => {
      mats.shell.dispose();
      mats.trim.dispose();
      mats.cap.dispose();
    },
    [mats],
  );

  useFrame((_, dt) => {
    const k = Math.min(1, dt * 5);
    let moving = false;
    const goal = selected ? 1 : 0;
    const d = goal - reveal.current;
    if (Math.abs(d) > 0.001) {
      reveal.current += d * k;
      moving = true;
    } else reveal.current = goal;
    const ds = spinTarget.current - spin.current;
    if (Math.abs(ds) > 0.001) {
      spin.current += ds * Math.min(1, dt * 2.6);
      moving = true;
    } else spin.current = spinTarget.current;

    // Хазайлтын пүрш (бага зэрэг давж савлана).
    const T = tilt.current;
    const tt = tiltTarget.current;
    const kS = 70;
    const cS = 7;
    // Тогтвортой байлгахын тулд жижиг алхмуудаар (≤1/120с) интегралчилна —
    // 3D хүнд үед frame урт болоход пүрш «дэлбэрч» сав унадаг байв.
    const sub = Math.min(12, Math.max(1, Math.ceil(dt * 120)));
    const h = Math.min(dt, 0.1) / sub;
    for (let i = 0; i < sub; i++) {
      T.vx += ((tt.x - T.x) * kS - T.vx * cS) * h;
      T.vz += ((tt.z - T.z) * kS - T.vz * cS) * h;
      T.x += T.vx * h;
      T.z += T.vz * h;
    }
    if (
      Math.abs(T.vx) + Math.abs(T.vz) > 0.0005 ||
      Math.abs(tt.x - T.x) + Math.abs(tt.z - T.z) > 0.0005
    )
      moving = true;
    if (tiltGroup.current) {
      tiltGroup.current.rotation.x = T.x;
      tiltGroup.current.rotation.z = T.z;
    }

    const v = reveal.current;
    if (root.current) {
      root.current.position.z = v * 1.5;
      root.current.rotation.y = spin.current;
    }
    // Металл гэр/таг «рентген» — сонгогдсон үед ~85% тунгалаг.
    const opacity = 1 - v;
    // Таг: 10/20/5мл-д mats.cap, 2мл-д өөрийн хуванцар материал.
    const capMat = (cap.current as THREE.Mesh | null)?.material as
      | THREE.MeshPhysicalMaterial
      | undefined;
    setShellOpacity(mats, opacity, 1 - v, capMat);
    // baseY: meshopt quantization-ийн translation (vial-gltf.tsx).
    if (cap.current)
      cap.current.position.y = (cap.current.userData.baseY ?? 0) + v * 0.9;
    if (moving) invalidate();
  });

  return (
    <group
      ref={root}
      position={[x, 0, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(spec.ml);
      }}
      onPointerDown={(e) => {
        // Савыг чирж хазайлгах/сэгсрэх (хулгана). Тавихад пүршээр буцна.
        if (e.pointerType !== "mouse") return;
        e.stopPropagation();
        const sx = e.clientX;
        const sy = e.clientY;
        const move = (ev: PointerEvent) => {
          tiltTarget.current = {
            x: THREE.MathUtils.clamp((ev.clientY - sy) * 0.004, -0.35, 0.35),
            z: THREE.MathUtils.clamp(-(ev.clientX - sx) * 0.006, -0.6, 0.6),
          };
          invalidate();
        };
        const up = () => {
          tiltTarget.current = { x: 0, z: 0 };
          invalidate();
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => (document.body.style.cursor = "")}
    >
      {/* Сүүдэр нь савтай хамт хөдөлнө (хазайлтад биш). */}
      <SoftShadow r={r} />
      <group ref={tiltGroup}>
        {/* GLB-г гаднах Suspense (ReadySignal) хүлээнэ — энд fallback хэрэггүй. */}
        <GltfVial
          ml={spec.ml}
          mats={mats}
          liquidColor={LIQUID_COLOR}
          liquidGlow={finish === "black" ? 0.1 : 3}
          capRef={cap}
          slosh={slosh}
        />
      </group>
    </group>
  );
}

/** Hook-ийн гадна: гэр/цагирагийн материалын тунгалаг байдлыг тохируулна. */
function setShellOpacity(
  mats: ShellMaterials,
  opacity: number,
  capOpacity: number,
  capMat?: THREE.MeshPhysicalMaterial,
) {
  // Гэр ба таг бүрэн алга болно — «сүнс» давхарга үлдэхгүй.
  // Мөнгөлөг цагираг үлдэнэ — бодит савны таг авсан үеийнх шиг шүршигчийн
  // мөрний доор байрандаа (алга болговол доорх нарийн хүзүү ил гарч хачин харагддаг).
  for (const [m, o] of [
    [mats.shell, opacity],
    [capMat ?? mats.cap, capOpacity],
  ] as const) {
    m.opacity = o;
    m.depthWrite = o > 0.98;
    m.visible = o > 0.02;
  }
}

interface ShellMaterials {
  shell: THREE.MeshPhysicalMaterial;
  trim: THREE.MeshPhysicalMaterial;
  cap: THREE.MeshPhysicalMaterial;
}
