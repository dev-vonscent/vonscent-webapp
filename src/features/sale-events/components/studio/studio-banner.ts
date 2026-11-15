import { HERO_EVENT_PRIORITY, HERO_LIMITS } from "@/lib/constants";
import {
  canvasFromHero,
  heroCanvasComplete,
  type HeroCanvasDraft,
} from "@/features/heroes/canvas-model";
import { defaultHeroCopy } from "@/features/heroes/default-copy";
import { rebindEventTarget } from "@/features/heroes/link-presets";
import type { HeroAdminRow } from "@/features/heroes/types";
import type { StudioBanner } from "./studio-checklist";
import { discountRange, type StudioDraft } from "./studio-model";

/**
 * Студийн ④-р алхмын баннерын төлөв (studio-ux.md D6, D7). Цэвэр функцүүд:
 * мөр ↔ canvas, бэлэн текст, серверт явуулах оролт (`heroInputSchema`).
 */
export interface BannerState {
  /** `heroes` мөр — хараахан үүсээгүй бол null. */
  id: string | null;
  /** Зургийн хавтас (`hero/<groupId>/…`): мөрийнх эсвэл шинэ uuid. */
  groupId: string;
  /**
   * Админ ④-т ямар нэг юм өөрчилсөн (эсвэл мөр байгаа) бол canvas. null үед
   * canvas нь арга хэмжээнээс бэлэн текстийг шууд харуулна, юу ч хадгалахгүй.
   */
  draft: HeroCanvasDraft | null;
  /** «Энэ арга хэмжээнд баннер хэрэггүй». */
  skip: boolean;
}

export const canvasFromRow = canvasFromHero;

/**
 * Эхний төлөв. `copy` — өөр арга хэмжээнээс хуулж буй: шинэ мөр, шинэ
 * хавтас, тэр арга хэмжээ рүү заасан товч энэ рүү (`fromSlug` → `toSlug`).
 */
export function initialBannerState(input: {
  row: HeroAdminRow | null;
  newGroupId: string;
  copy?: { fromSlug: string; toSlug: string };
}): BannerState {
  const { row, newGroupId, copy } = input;
  if (!row) return { id: null, groupId: newGroupId, draft: null, skip: false };
  const draft = canvasFromRow(row);
  if (copy) {
    return {
      id: null,
      groupId: newGroupId,
      draft: {
        ...draft,
        primaryTarget: rebindEventTarget(draft.primaryTarget, [copy.fromSlug], copy.toSlug),
        secondaryTarget: rebindEventTarget(draft.secondaryTarget, [copy.fromSlug], copy.toSlug),
      },
      skip: !row.isActive,
    };
  }
  // Идэвхгүй мөр = «баннер хэрэггүй» гэж унтраасан (D6 — устгахгүй).
  return { id: row.id, groupId: row.id, draft, skip: !row.isActive && heroCanvasComplete(draft) };
}

/** Арга хэмжээний ③-ын хамгийн их хувь (бэлэн текстэд). */
function maxPct(d: StudioDraft): number | null {
  return discountRange(d.items).max;
}

/** Canvas-д харагдах утга: админы засвар эсвэл арга хэмжээнээс бэлэн текст. */
export function effectiveCanvas(s: BannerState, event: StudioDraft): HeroCanvasDraft {
  if (s.draft) return s.draft;
  return {
    ...defaultHeroCopy({
      name: event.name,
      headline: event.headline,
      slug: event.slug,
      startsOn: event.startsOn,
      endsOn: event.endsOn,
      maxPct: maxPct(event),
    }),
    desktopImage: null,
    mobileImage: null,
    imageAlt: "",
    dark: false,
  };
}

export function defaultImageAlt(eventName: string): string {
  return `${eventName.trim() || "Арга хэмжээ"} — нүүрний баннер`.slice(0, HERO_LIMITS.imageAlt);
}

/**
 * Серверт явуулах оролт (`heroInputSchema`) — эсвэл явуулах юм байхгүй бол
 * null (мөргүй, засваргүй; эсвэл мөргүй атлаа «хэрэггүй»). Хугацаа нь арга
 * хэмжээнээс (D6); бүрэн бол л идэвхтэй. Энэ арга хэмжээ рүү заасан товч
 * хадгалагдсан холбоосыг дагана (D5).
 */
export function bannerPayload(input: {
  state: BannerState;
  event: StudioDraft;
  eventId: string;
  /** Энэ арга хэмжээний урьд нь хадгалагдсан холбоосууд. */
  knownSlugs: readonly string[];
}): Record<string, unknown> | null {
  const { state: s, event, eventId } = input;
  if (!s.draft) return null;
  if (s.skip && !s.id) return null;
  const d = s.draft;
  const from = [...input.knownSlugs, event.slug];
  const name = (event.name.trim() || "Арга хэмжээ").slice(0, HERO_LIMITS.name);
  return {
    name,
    saleEventId: eventId,
    startsOn: null,
    endsOn: null,
    priority: HERO_EVENT_PRIORITY,
    isActive: !s.skip && heroCanvasComplete(d),
    eyebrow: d.eyebrow,
    title: d.title,
    description: d.description,
    mobileDescription: d.mobileDescription,
    primaryLabel: d.primaryLabel,
    primaryTarget: rebindEventTarget(d.primaryTarget, from, event.slug),
    secondaryLabel: d.secondaryLabel,
    secondaryTarget: d.secondaryLabel.trim()
      ? rebindEventTarget(d.secondaryTarget, from, event.slug)
      : null,
    desktopImage: d.desktopImage,
    mobileImage: d.mobileImage,
    imageAlt: d.imageAlt.trim() || defaultImageAlt(event.name),
    dark: d.dark,
  };
}

/** Checklist / timeline-ийн тойм. Баннер эхлээгүй бол null. */
export function bannerSummary(s: BannerState): StudioBanner | null {
  const d = s.draft;
  if (!d) return null;
  return {
    id: s.id ?? "new",
    thumb: d.desktopImage ? `${d.desktopImage.base}-1600.webp` : null,
    hasDesktop: d.desktopImage !== null,
    hasMobile: d.mobileImage !== null,
    hasTitle: d.title.trim() !== "",
    hasPrimaryLabel: d.primaryLabel.trim() !== "",
    isActive: !s.skip && heroCanvasComplete(d),
    others: 0,
  };
}

/** Арга хэмжээний баннер (D6): хамгийн сүүлд шинэчлэгдсэн мөр + бусдын тоо. */
export function linkedBannerRow(
  heroes: readonly HeroAdminRow[],
  eventId: string,
): { row: HeroAdminRow | null; others: number } {
  const linked = heroes
    .filter((h) => h.saleEventId === eventId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { row: linked[0] ?? null, others: Math.max(0, linked.length - 1) };
}
