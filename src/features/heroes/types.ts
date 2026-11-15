import type { HeroSeason } from "@/lib/constants";

/** Товчны холбоос (0182 `hero_target_valid`, plan §7.3). */
export type HeroTarget =
  | { type: "event"; slug: string }
  | { type: "season"; value: "spring" | "summer" | "autumn" | "winter" }
  | { type: "catalog"; query: string }
  | { type: "path"; href: string };

/**
 * Desktop зураг: `${base}-${w}.webp` (w ∈ widths), 2.8:1. `height1600` —
 * 1600 өргөний өндөр (<img> width/height, CLS).
 */
export interface HeroDesktopImage {
  base: string;
  widths: number[];
  height1600: number;
}

export interface HeroMobileImage {
  src: string;
  width: number;
  height: number;
}

/** `live_hero()`-ийн нэг мөр — дэлгүүрт гарах hero. */
export interface LiveHero {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  mobileDescription: string | null;
  primaryLabel: string;
  primaryTarget: HeroTarget;
  secondaryLabel: string | null;
  secondaryTarget: HeroTarget | null;
  desktopImage: HeroDesktopImage;
  mobileImage: HeroMobileImage;
  imageAlt: string;
  dark: boolean;
}

/** Админы жагсаалт / маягтын нэг мөр. */
export interface HeroAdminRow
  extends Omit<LiveHero, "desktopImage" | "mobileImage"> {
  name: string;
  saleEventId: string | null;
  startsAt: string | null;
  endsAt: string | null;
  priority: number;
  isActive: boolean;
  desktopImage: HeroDesktopImage | null;
  mobileImage: HeroMobileImage | null;
  updatedAt: string;
  /** Улирлын баннер (0185) — null бол арга хэмжээ / тусгай өдрийн. */
  season: HeroSeason | null;
  /** Улирлын эхлэх өдөр 'MM-DD' (УБ). */
  seasonStartMd: string | null;
  /** Зурган дээрх үнэртнүүд (ихдээ 3). */
  productIds: string[];
}

/** Hero-той холбож болох арга хэмжээ (админы сонголт). */
export interface HeroEventOption {
  id: string;
  slug: string;
  name: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}
