import type { MlSize } from "@/lib/constants";
import HERO_ASSETS from "./hero-assets.json";

/**
 * Дэлгүүрийн бодит decant савнууд (см) — барааны 3 дахь зураг
 * (public/bottles/*) дээрх хэмжээсээр. 3D болон SVG шил хоёул эндээс зурна.
 *
 * - 2мл: тунгалаг шилэн vial + хар хөвөөтэй шүршигч, хар таг (өнгө нь
 *   бүх загварт ижил).
 * - 5мл: металл гэр + цагираг + таг (таггүйгээр 8.5см).
 * - 10/20мл: металл гэр + таг, дунд нь гялгар цагираг. Дотор нь шилэн vial.
 */
export interface VialSpec {
  ml: MlSize;
  /** Гаднах диаметр, нийт өндөр. */
  d: number;
  h: number;
  kind: "glass" | "atomizer";
  /** atomizer: гэрийн дээд ирмэг (цагирагийн доод тал). */
  sleeveTop: number;
  /** atomizer: тагтай эсэх. */
  cap: boolean;
}

export const VIAL_SPECS: readonly VialSpec[] = [
  { ml: 2, d: 1.4, h: 5.2, kind: "glass", sleeveTop: 2.55, cap: false },
  { ml: 5, d: 1.9, h: 8.62, kind: "atomizer", sleeveTop: 5.7, cap: true },
  { ml: 10, d: 2.3, h: 9.9, kind: "atomizer", sleeveTop: 6.1, cap: true },
  { ml: 20, d: 2.6, h: 11.4, kind: "atomizer", sleeveTop: 7.0, cap: true },
];

/** Сав хоорондын зай (см). */
export const VIAL_GAP = 1.3;
/** Цагирагийн өндөр (см). */
export const TRIM_H = 0.2;

/** Савнуудын X төв — бүгдийг 0 орчим голлуулна. */
export function vialPositions(): number[] {
  const total =
    VIAL_SPECS.reduce((s, v) => s + v.d, 0) +
    VIAL_GAP * (VIAL_SPECS.length - 1);
  let x = -total / 2;
  return VIAL_SPECS.map((v) => {
    const cx = x + v.d / 2;
    x += v.d + VIAL_GAP;
    return cx;
  });
}

/** Савны өнгөний загвар (BOTTLE_STYLES) — theme-ээс сонгоно. */
export type VialFinish = "black" | "pink" | "silver";

export function finishForTheme(themeClass: string): VialFinish {
  if (/\bpink\b/.test(themeClass)) return "pink";
  if (/\b(white|navy)\b/.test(themeClass)) return "silver";
  return "black";
}

/**
 * Hero poster (3D-ийн урьдчилсан рендер, `scripts/hero-posters.ts`).
 * navy/white хоёул цагаан дэвсгэр + мөнгөлөг сав тул нэг зураг (`light`).
 * Layout: `sm` = утас (< md), `md` = md+ — канвасын харьцаа өөр.
 */
/** Hero анх нээгдэхэд сонгогдсон хэмжээ (poster preload ч үүнийг ашиглана). */
export const HERO_DEFAULT_ML: MlSize = 10;

export const POSTER_THEMES = ["black", "light", "pink"] as const;
export type PosterTheme = (typeof POSTER_THEMES)[number];
export type PosterLayout = "sm" | "md";

export function posterSrc(
  theme: PosterTheme,
  layout: PosterLayout,
  ml: MlSize,
): string {
  return `/hero/vials-${theme}-${layout}-${ml}.avif`;
}

/** Хөтчид татуулах URL — хувилбартай (`heroAsset`). `posterSrc` = файлын зам. */
export function posterUrl(
  theme: PosterTheme,
  layout: PosterLayout,
  ml: MlSize,
): string {
  return heroAsset(posterSrc(theme, layout, ml));
}

/**
 * `public/hero`, `public/models`-ийн файлыг агуулгын hash-тай URL болгоно.
 * Эдгээр замд `Cache-Control: immutable` (next.config.ts) тул файл
 * солигдвол `pnpm hero:assets` заавал ажиллуул (тест барина).
 */
export function heroAsset(file: string): string {
  const v = (HERO_ASSETS as Record<string, string>)[file];
  return v ? `${file}?v=${v}` : file;
}
