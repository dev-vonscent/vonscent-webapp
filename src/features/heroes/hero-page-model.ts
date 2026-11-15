import { SEASON_LABEL, type HeroSeason } from "@/lib/constants";
import { canvasFromHero, heroCanvasComplete, type HeroCanvasDraft } from "./canvas-model";
import { defaultSeasonCopy } from "./default-copy";
import type { HeroAdminRow } from "./types";

/**
 * «Нүүрний баннер» хуудасны засвар (studio-ux.md §7): улирлын ба тусгай өдрийн
 * баннерын ноорог ↔ серверийн оролт (`heroInputSchema`). Цэвэр функц.
 */
export interface SeasonPageDraft {
  kind: "season";
  season: HeroSeason;
  startMd: string;
  canvas: HeroCanvasDraft;
}

export interface SpecialPageDraft {
  kind: "special";
  name: string;
  startsOn: string;
  endsOn: string;
  canvas: HeroCanvasDraft;
}

export type HeroPageDraft = SeasonPageDraft | SpecialPageDraft;

const EMPTY_IMAGES = { desktopImage: null, mobileImage: null, imageAlt: "", dark: false };

export function seasonPageDraft(
  season: HeroSeason,
  row: HeroAdminRow | null,
  defaultMd: string,
): SeasonPageDraft {
  return {
    kind: "season",
    season,
    startMd: row?.seasonStartMd ?? defaultMd,
    canvas: row ? canvasFromHero(row) : { ...defaultSeasonCopy(season), ...EMPTY_IMAGES },
  };
}

export function specialPageDraft(
  row: HeroAdminRow | null,
  toDay: (iso: string | null) => string,
  toEndDay: (iso: string | null) => string,
): SpecialPageDraft {
  return {
    kind: "special",
    name: row?.name ?? "",
    startsOn: toDay(row?.startsAt ?? null),
    endsOn: toEndDay(row?.endsAt ?? null),
    canvas: row
      ? canvasFromHero(row)
      : {
          eyebrow: "",
          title: "",
          description: "",
          mobileDescription: "",
          primaryLabel: "Үнэртэн үзэх",
          primaryTarget: { type: "path", href: "/catalog" },
          secondaryLabel: "",
          secondaryTarget: null,
          ...EMPTY_IMAGES,
        },
  };
}

/** Серверийн оролт. Улирлын баннер бүрэн бол л идэвхтэй (тусдаа «нийтлэх» байхгүй, D6). */
export function heroPagePayload(
  d: HeroPageDraft,
  opts: { publish?: boolean; productIds?: string[] } = {},
): Record<string, unknown> {
  const c = d.canvas;
  const common = {
    priority: 0,
    saleEventId: null,
    eyebrow: c.eyebrow,
    title: c.title,
    description: c.description,
    mobileDescription: c.mobileDescription,
    primaryLabel: c.primaryLabel,
    primaryTarget: c.primaryTarget,
    secondaryLabel: c.secondaryLabel,
    secondaryTarget: c.secondaryLabel.trim() ? c.secondaryTarget : null,
    desktopImage: c.desktopImage,
    mobileImage: c.mobileImage,
    dark: c.dark,
    productIds: opts.productIds ?? [],
  };
  if (d.kind === "season") {
    const label = SEASON_LABEL[d.season];
    return {
      ...common,
      name: `${label} — улирлын баннер`,
      season: d.season,
      seasonStartMd: d.startMd,
      startsOn: null,
      endsOn: null,
      isActive: heroCanvasComplete(c),
      imageAlt: c.imageAlt.trim() || `${label} — нүүрний баннер`,
    };
  }
  return {
    ...common,
    name: d.name,
    season: null,
    seasonStartMd: null,
    startsOn: d.startsOn || null,
    endsOn: d.endsOn || null,
    isActive: Boolean(opts.publish),
    imageAlt: c.imageAlt.trim() || `${d.name.trim() || "Баннер"} — нүүрний баннер`,
  };
}

/** Сар → тэр сард байх өдрийн тоо (2-р сар 28 — 02-29 хориотой, 0185). */
export function daysInMonth(month: number): number {
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 31;
}

export function toMd(month: number, day: number): string {
  const d = Math.min(day, daysInMonth(month));
  return `${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
