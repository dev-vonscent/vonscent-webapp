"use client";

import * as React from "react";
import Image from "next/image";
import type { UserTierKey } from "@/lib/constants";
import { cn } from "@/lib/utils";

/*
 * Түвшний жижиг тэмдэг (badge, жагсаалт) — хүрээний доод дугуй.
 *
 * Standard / Gold / Platinum: хүрээ зургийн доод медальоныг тайрсан
 * (`public/tiers/badge-<tier>.v<N>.webp`).
 * Sapphire / Ruby: хүрээн дээрх чулуу нь дугуй биш тул дээрээс харсан
 * дугуй brilliant огтлолтой талстыг SVG-ээр зурна — гялалзсан өнгөтэй.
 */

const MEDALLIONS: Partial<Record<UserTierKey, string>> = {
  standard: "/tiers/badge-standard.v1.webp",
  gold: "/tiers/badge-gold.v1.webp",
  platinum: "/tiers/badge-platinum.v1.webp",
};

interface GemPalette {
  dark: string;
  mid: string;
  light: string;
  shine: string;
  /** Чулууг барьсан металл хүрээ. */
  setting: readonly [string, string, string];
}

const GEMS: Partial<Record<UserTierKey, GemPalette>> = {
  sapphire: {
    dark: "#061649",
    mid: "#1d4fd8",
    light: "#78adff",
    shine: "#eaf3ff",
    setting: ["#f4f6f8", "#9aa3ad", "#dfe3e8"],
  },
  ruby: {
    dark: "#3d000c",
    mid: "#b8062c",
    light: "#ff2f57",
    shine: "#ffd9e1",
    setting: ["#fff1b8", "#b07a17", "#f2c95a"],
  },
};

/* ── Дээрээс харсан brilliant огтлол (r = 44) ─────────────────────── */

const R_TABLE = 20;
const R_STAR = 31;
const R_GIRDLE = 44;

function pt(deg: number, r: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [
    Math.round(r * Math.cos(a) * 100) / 100,
    Math.round(r * Math.sin(a) * 100) / 100,
  ];
}

const poly = (pts: [number, number][]) =>
  pts.map(([x, y]) => `${x},${y}`).join(" ");

interface Facet {
  points: string;
  /** Гэрлийн чиглэл (зүүн дээд) рүү хэр харсан: 0…1. */
  light: number;
}

/** Гэрэл зүүн дээдээс — facet-ийн төвийн өнцгөөр гэрэлтэлт. */
function lightAt(deg: number, alternate: number) {
  const LIGHT = -45;
  const base = 0.5 + 0.5 * Math.cos(((deg - LIGHT) * Math.PI) / 180);
  // Хөрш facet-ууд ээлжлэн бараан/цайвар — бодит чулууны «гялбаа».
  return Math.min(Math.max(base * 0.75 + alternate * 0.25, 0), 1);
}

const FACETS: Facet[] = (() => {
  const out: Facet[] = [];
  for (let k = 0; k < 8; k++) {
    const a = k * 45;
    const t0 = pt(a, R_TABLE);
    const t1 = pt(a + 45, R_TABLE);
    const s = pt(a + 22.5, R_STAR);
    const sPrev = pt(a - 22.5, R_STAR);
    // Од facet: хүснэгтийн ирмэг → од цэг.
    out.push({ points: poly([t0, t1, s]), light: lightAt(a + 22.5, k % 2) });
    // Бэзел (kite): хүснэгтийн орой → бүсэлхий.
    out.push({
      points: poly([t0, s, pt(a, R_GIRDLE), sPrev]),
      light: lightAt(a, (k + 1) % 2),
    });
    // Дээд бүсэлхийн хоёр гурвалжин.
    out.push({
      points: poly([s, pt(a, R_GIRDLE), pt(a + 22.5, R_GIRDLE)]),
      light: lightAt(a + 11, k % 2),
    });
    out.push({
      points: poly([s, pt(a + 22.5, R_GIRDLE), pt(a + 45, R_GIRDLE)]),
      light: lightAt(a + 34, (k + 1) % 2),
    });
  }
  return out;
})();

const TABLE = poly(Array.from({ length: 8 }, (_, k) => pt(k * 45, R_TABLE)));

function mix(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(" ")})`;
}

function facetColor(p: GemPalette, light: number) {
  return light < 0.5
    ? mix(p.dark, p.mid, light * 2)
    : mix(p.mid, p.light, (light - 0.5) * 2);
}

function GemIcon({
  palette,
  className,
}: {
  palette: GemPalette;
  className?: string;
}) {
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg
      viewBox="-50 -50 100 100"
      aria-hidden
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient id={`${uid}set`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={palette.setting[0]} />
          <stop offset="0.55" stopColor={palette.setting[1]} />
          <stop offset="1" stopColor={palette.setting[2]} />
        </linearGradient>
        <radialGradient id={`${uid}table`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor={palette.shine} />
          <stop offset="0.45" stopColor={palette.light} />
          <stop offset="1" stopColor={palette.mid} />
        </radialGradient>
        <radialGradient id={`${uid}gloss`} cx="0.3" cy="0.25" r="0.6">
          <stop offset="0" stopColor="#fff" stopOpacity="0.4" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Металл хүрээ */}
      <circle r="49" fill={`url(#${uid}set)`} />
      <circle r="45.5" fill={palette.dark} />
      {/* Талстууд */}
      {FACETS.map((f, i) => (
        <polygon
          key={i}
          points={f.points}
          fill={facetColor(palette, f.light)}
          stroke={palette.shine}
          strokeOpacity="0.35"
          strokeWidth="0.6"
          strokeLinejoin="round"
        />
      ))}
      <polygon
        points={TABLE}
        fill={`url(#${uid}table)`}
        stroke={palette.shine}
        strokeOpacity="0.6"
        strokeWidth="0.8"
      />
      {/* Гялгар ойлт ба гялбаа */}
      <circle r="44" fill={`url(#${uid}gloss)`} />
      <path d="M-12 -8 L-4 -16 L2 -14 L-8 -4 Z" fill="#fff" opacity="0.75" />
      <path
        d="M-22 -22 C-21.4 -19 -20 -17.6 -17 -17 C-20 -16.4 -21.4 -15 -22 -12 C-22.6 -15 -24 -16.4 -27 -17 C-24 -17.6 -22.6 -19 -22 -22 Z"
        fill="#fff"
      />
    </svg>
  );
}

/** Түвшний жижиг тэмдэг (badge, жагсаалт). */
export function TierGem({
  tier,
  className,
}: {
  tier: UserTierKey;
  className?: string;
}) {
  const gem = GEMS[tier];
  const size = cn("size-4.5", className);
  if (gem) return <GemIcon palette={gem} className={size} />;
  return (
    <Image
      src={MEDALLIONS[tier] ?? MEDALLIONS.standard!}
      alt=""
      aria-hidden
      width={48}
      height={48}
      className={cn("shrink-0 rounded-full select-none", size)}
    />
  );
}
