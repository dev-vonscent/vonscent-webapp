"use client";

import * as React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ML_SIZES, SPRAYS_PER_ML, type MlSize } from "@/lib/constants";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import {
  HERO_DEFAULT_ML,
  POSTER_THEMES,
  posterUrl,
  type PosterTheme,
} from "@/features/marketing/vial-specs";

/**
 * 4 савны 3D (three.js, ~200KB) — тусдаа chunk, зөвхөн client дээр.
 * Poster (3D-ийн өөрийнх нь рендер) түүнийг ачаалагдтал — мөн reduced-motion,
 * WebGL-гүй, Save-Data үед байнга — харагдана.
 */
const DecantLineup3D = dynamic(() => import("./decant-vial-3d"), {
  ssr: false,
});

/**
 * 3D-г ачаалах эсэх: reduced-motion биш, WebGL2 байгаа, сул төхөөрөмж /
 * Save-Data биш, hero дэлгэцэн дээр байгаа үед. Бусад үед poster (3D-ийн
 * өөрийнх нь рендер) хангалттай бодит харагдана.
 *
 * Хэзээ:
 *  - Хулгана (`pointer: fine`): хуудас ачаалагдаж дууссаны дараа (idle).
 *  - Хүрэлтийн дэлгэц: hero-г анх хүрэх / хэмжээ сонгох үед л. Утсанд 3D нь
 *    ~1MB татаж, shader compile-оор main thread-ийг түгждэг (Lighthouse-ийн
 *    утасны эмуляцид TBT 0.6–9.7с, 2026-10-10) — хүрээгүй хэрэглэгчид
 *    poster-оос ялгагдахгүй тул тэр зардал дэмий.
 *
 * `wake()` — hero-тэй харьцсан дохио (pointerdown / хэмжээ солих).
 */
function useCan3D(
  reduced: boolean,
  areaRef: React.RefObject<HTMLElement | null>,
) {
  const [can, setCan] = React.useState(false);
  const [woke, setWoke] = React.useState(false);
  const [visible, setVisible] = React.useState(false);
  const [capable, setCapable] = React.useState<"no" | "fine" | "touch">("no");

  React.useEffect(() => {
    // `reduced` эхний render дээр үргэлж false (hook-ийн effect хараахан
    // ажиллаагүй) — шууд уншихгүй бол 3D-г эхлүүлэх idle callback
    // reduced-motion-ий шинэчлэлтээс түрүүлж ажиллаж болно (e2e-д барьсан).
    if (
      reduced ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setCapable("no");
      return;
    }
    const nav = navigator as Navigator & {
      connection?: { saveData?: boolean };
      deviceMemory?: number;
    };
    if (nav.connection?.saveData || (nav.deviceMemory ?? 8) <= 2) return;
    if (!hasHardwareWebGL2()) return;
    setCapable(window.matchMedia("(pointer: fine)").matches ? "fine" : "touch");
  }, [reduced]);

  // Hero-гоос доош гүйлгэсэн хойно ачаалж эхлэхгүй (буцаж ирэхэд л).
  React.useEffect(() => {
    const el = areaRef.current;
    if (!el || !("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), {
      rootMargin: "200px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [areaRef]);

  const want =
    capable === "fine" || (capable === "touch" && woke) ? visible : false;

  React.useEffect(() => {
    if (can || !want) return;
    // Хүрсэн бол шууд; хулганатай үед эхний интерактивт саад болохгүйн тулд idle.
    if (capable === "touch") {
      setCan(true);
      return;
    }
    const start = () => setCan(true);
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(start, { timeout: 2500 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(start, 1200);
    return () => clearTimeout(t);
  }, [can, want, capable]);

  // reduced-motion асаавал ачаалсан 3D-г ч буулгана.
  React.useEffect(() => {
    if (reduced) setCan(false);
  }, [reduced]);

  const wake = React.useCallback(() => setWoke(true), []);
  return { can, wake };
}

/**
 * WebGL2 байгаа, бас программаар зурдаг (GPU-гүй) renderer биш эсэх.
 * SwiftShader / llvmpipe дээр 4 шилэн материалтай үзэгдлийн нэг frame
 * 70мс–10с болж (2026-10-11 хэмжсэн) хуудсыг бүхэлд нь гацаадаг — poster нь
 * ялгаагүй харагдана.
 */
function hasHardwareWebGL2(): boolean {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return false;
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = String(
      gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
    );
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return !/swiftshader|llvmpipe|softpipe|software/i.test(renderer);
  } catch {
    return false;
  }
}

/**
 * Нүүрний hero-гийн зүүн тал (туршилт): дэлгүүрийн 4 бодит савыг жинхэнэ
 * харьцаагаар нь зэрэгцүүлнэ — хэмжээ сонгоход тэр сав урагшилж, дотор нь
 * ДҮҮРЭН шилэн vial харагдана (сав бүр үргэлж дүүрэн ирдэг гэдгийг
 * ойлгуулна). Савыг шууд дарж ч сонгоно. Гол CTA тэр хэмжээгээр шүүсэн
 * каталог руу.
 */
export function DecantPlayground({ intro }: { intro?: React.ReactNode }) {
  const [ml, setMl] = React.useState<MlSize>(HERO_DEFAULT_ML);
  const reduced = usePrefersReducedMotion();
  const areaRef = React.useRef<HTMLDivElement>(null);
  const groupId = React.useId();
  const { can: can3d, wake } = useCan3D(reduced, areaRef);
  const [ready3d, setReady3d] = React.useState(false);
  const show3d = can3d && ready3d;
  const sprays = ml * SPRAYS_PER_ML;

  // 3D-гүй үед poster-ийг шинэ зураг decode хийгдтэл ХУУЧНААР нь үлдээнэ —
  // background-image шууд солигдвол татагдах хооронд хоосон анивчдаг (P5).
  const [posterMl, setPosterMl] = React.useState<MlSize>(ml);
  React.useEffect(() => {
    if (ml === posterMl) return;
    if (show3d) {
      setPosterMl(ml);
      return;
    }
    let alive = true;
    const img = new Image();
    img.src = viewportPosterUrl(ml);
    img
      .decode()
      .catch(() => undefined)
      .then(() => {
        if (alive) setPosterMl(ml);
      });
    return () => {
      alive = false;
    };
  }, [ml, posterMl, show3d]);

  // 3D гарч ирээд fade дууссаны дараа poster-ийг DOM-оос хасна — тэгэхгүй бол
  // хэмжээ/theme солих бүрд харагдахгүй poster дахин татагдана.
  const [posterGone, setPosterGone] = React.useState(false);
  React.useEffect(() => {
    if (!show3d) return;
    const t = setTimeout(() => setPosterGone(true), POSTER_FADE_MS);
    return () => clearTimeout(t);
  }, [show3d]);

  // Hero-гийн бүтэн хоёр тал: зүүн — текст + хэмжээ сонгогч + CTA,
  // баруун — 3D савнууд. Утсан дээр 3D дээрээ. Хулганы байрлалыг бүх
  // hero-гийн хүрээнд хэмжинэ (areaRef).
  return (
    <div
      ref={areaRef}
      // CTA холбоос дарвал хуудас солигдох тул 3D-г дэмий татахгүй.
      onPointerDown={(e) => {
        if (!(e.target as Element).closest("a")) wake();
      }}
      data-hero-3d={show3d ? "ready" : can3d ? "loading" : "off"}
      className="grid w-full items-center gap-6 md:grid-cols-[9fr_11fr] md:gap-8 lg:gap-12"
    >
      <div
        aria-hidden
        className="relative order-1 aspect-16/11 w-full max-md:mx-auto max-md:max-w-sm md:order-2 md:aspect-4/3"
      >
        {!posterGone && (
          <VialPoster
            ml={posterMl}
            className={cn(
              STAGE,
              "transition-[opacity,filter] ease-out",
              show3d && "opacity-0 blur-sm",
            )}
          />
        )}
        {can3d && (
          <DecantLineup3D
            ml={ml}
            onSelect={setMl}
            trackRef={areaRef}
            onReady={() => setReady3d(true)}
            className={cn(
              // size-auto! — r3f-ийн inline width/height:100% нь inset-ийг дардаг.
              STAGE,
              "absolute! size-auto! transition-opacity ease-out",
              show3d ? "opacity-100" : "opacity-0",
            )}
          />
        )}
      </div>

      <div className="order-2 flex flex-col gap-6 max-md:text-center md:order-1">
        {intro}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 max-md:mx-auto max-md:w-full max-md:max-w-sm max-md:justify-center md:max-w-xl">
          <fieldset className="max-md:w-full">
            <legend className="sr-only">Хэмжээгээ сонго</legend>
            <div className="grid grid-cols-4 gap-1.5 sm:flex sm:gap-2">
              {ML_SIZES.map((size) => (
                <label
                  key={size}
                  className="relative"
                  // 3D-гүй үед: дарахаас өмнө тэр хэмжээний poster-ийг татаж эхэлнэ.
                  onPointerEnter={() => {
                    if (!show3d) new Image().src = viewportPosterUrl(size);
                  }}
                >
                  <input
                    type="radio"
                    name={groupId}
                    value={size}
                    checked={ml === size}
                    onChange={() => {
                      setMl(size);
                      wake();
                    }}
                    className="peer sr-only"
                  />
                  <span
                    className={cn(
                      "flex h-11 cursor-pointer items-center justify-center rounded-full px-1 text-sm font-semibold whitespace-nowrap tabular-nums transition-colors sm:min-w-12 sm:px-3",
                      "bg-secondary text-secondary-foreground hover:bg-accent",
                      // Сонгогдсон товч hover дээр өнгөө солихгүй.
                      "peer-checked:bg-foreground peer-checked:text-background peer-checked:hover:bg-foreground",
                      "peer-focus-visible:ring-ring peer-focus-visible:ring-offset-background peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2",
                    )}
                  >
                    {size}мл
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <p aria-live="polite" className="text-foreground max-md:w-full">
            <span className="text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">
              ≈ {sprays}
            </span>{" "}
            <span className="text-muted-foreground text-base">шүршилт</span>
          </p>
        </div>

        <div className="flex gap-3 max-md:mx-auto max-md:grid max-md:w-full max-md:max-w-sm max-md:grid-cols-2">
          <Button
            asChild
            size="lg"
            className="bg-cta text-cta-foreground hover:bg-cta/90"
          >
            <Link href="/catalog">Каталог үзэх</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="secondary"
            className="in-[.black]:bg-white/10 in-[.black]:text-white in-[.black]:hover:bg-white/20"
          >
            <Link href="/collections/build">Багц үүсгэх</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Poster ба 3D канвас яг ижил хүрээтэй — хайрцгаас том: эргэх/урагшлахад сав,
 * сүүдэр тасрахгүй. Утсан дээр доор нь текст тул бага; md+ дээр зүүн тал нь
 * grid-ийн gap-д л орно. `scripts/hero-posters.ts` энэ хүрээг screenshot хийнэ.
 */
const STAGE =
  "absolute -inset-x-4 -top-4 -bottom-5 duration-700 md:-top-6 md:-right-8 md:-bottom-16 md:-left-6";
const POSTER_FADE_MS = 700;

function posterVars(ml: MlSize) {
  const vars: Record<string, string> = {};
  for (const t of POSTER_THEMES)
    for (const l of ["sm", "md"] as const)
      vars[`--poster-${t}-${l}`] = `url(${posterUrl(t, l, ml)})`;
  return vars as React.CSSProperties;
}

/** Одоогийн theme × дэлгэцийн өргөнд таарах poster-ийн URL. */
function viewportPosterUrl(ml: MlSize) {
  const cls = document.documentElement.className;
  const theme: PosterTheme = /\bblack\b/.test(cls)
    ? "black"
    : /\bpink\b/.test(cls)
      ? "pink"
      : "light";
  const layout = window.matchMedia("(min-width: 48rem)").matches ? "md" : "sm";
  return posterUrl(theme, layout, ml);
}

/**
 * 3D-ийн өөрийнх нь рендер (scripts/hero-posters.ts) — 3D ачаалагдтал, мөн
 * reduced-motion / WebGL-гүй үед байнга. Theme × layout-ийг CSS сонгоно
 * (JS-ээр theme уншвал hydration-ы дараа анивчина): background-image нь
 * зөвхөн тохирсон нэг зургийг татна — нуусан `<img>` бүгд татагддаг.
 */
function VialPoster({ ml, className }: { ml: MlSize; className?: string }) {
  return (
    <div
      style={posterVars(ml)}
      className={cn(
        "bg-cover bg-center bg-no-repeat",
        "bg-(image:--poster-light-sm) in-[.black]:bg-(image:--poster-black-sm) in-[.pink]:bg-(image:--poster-pink-sm)",
        "md:bg-(image:--poster-light-md) md:in-[.black]:bg-(image:--poster-black-md) md:in-[.pink]:bg-(image:--poster-pink-md)",
        className,
      )}
    />
  );
}
