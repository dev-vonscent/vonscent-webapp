import {
  SALE_EVENT_DEFAULT_BADGE,
  SALE_EVENT_LIMITS as L,
  SALE_EVENT_MAX_PCT,
  SITE,
} from "@/lib/constants";
import {
  dayEndIso,
  isoEndToDay,
  isoToDay,
} from "@/features/admin/lib/date-range";
import { UB_TIMEZONE } from "@/lib/time";
import { slugify } from "@/features/collections/slug";
import type { SaleEventAdminRow, SaleEventPhase } from "../../types";

/**
 * Арга хэмжээний студийн (docs/campaigns/studio-ux.md) цэвэр хэсэг: ноорог ↔
 * серверийн оролт, хадгалалтын горим, товчны нэр, хугацааны өгүүлбэр, «Юу
 * болох вэ» шугам. React, сүлжээ байхгүй — vitest-ээр шалгагдана.
 */

/** Нэг барааны хувь — бичиж байх үеийн мөр (хоосон = хувьгүй). */
export interface StudioItem {
  productId: string;
  pcts: Record<number, string>;
}

/** Бичиж байх үеийн утга. */
export interface StudioDraft {
  name: string;
  slug: string;
  /** Админ холбоосыг гараар өөрчилсөн бол нэрээс дахин үүсгэхгүй. */
  slugTouched: boolean;
  badgeLabel: string;
  headline: string;
  description: string;
  startsOn: string;
  endsOn: string;
  showCountdown: boolean;
  items: StudioItem[];
}

export const STUDIO_STEPS = [
  "basics",
  "products",
  "catalog",
  "banner",
  "review",
] as const;
export type StudioStep = (typeof STUDIO_STEPS)[number];

export const STUDIO_STEP_LABEL: Record<StudioStep, string> = {
  basics: "Үндсэн",
  products: "Бараа, хямдрал",
  catalog: "Каталогт харагдах",
  banner: "Нүүрний баннер",
  review: "Шалгаад нийтлэх",
};

/** Алхам бүрийн эхний нэг өгүүлбэр (§4.2). */
/** Нийтэлсний дараа ⑤ нь тойм хуудас (§5.5). */
export const REVIEW_HINT_PUBLISHED = "Арга хэмжээний тойм — юу болж байгаа, юу болох.";

export const STUDIO_STEP_HINT: Record<StudioStep, string> = {
  basics: "Арга хэмжээгээ нэрлээд хэзээ явахыг сонгоно.",
  products: "Аль бараа, аль хэмжээ хэдэн хувиар хямдрахыг сонгоно.",
  catalog: "Каталогийн хуудсанд харагдах текстээ харагдац дээр нь засна — хоосон орхиж болно.",
  banner: "Арга хэмжээний үеэр нүүр хуудсанд гарах баннер.",
  review: "Юу болохыг нэг уншаад нийтэлнэ.",
};

/** `hero_admin` туг хаалттай бол ④-р алхам гарахгүй (§5.4). */
export function visibleSteps(bannerEnabled: boolean): StudioStep[] {
  return STUDIO_STEPS.filter((s) => bannerEnabled || s !== "banner");
}

export function parseStep(
  raw: string | null | undefined,
  steps: readonly StudioStep[],
): StudioStep | null {
  return steps.find((s) => s === raw) ?? null;
}

export function emptyDraft(): StudioDraft {
  return {
    name: "",
    slug: "",
    slugTouched: false,
    badgeLabel: "",
    headline: "",
    description: "",
    startsOn: "",
    endsOn: "",
    showCountdown: true,
    items: [],
  };
}

/** Мөр → ноорог. Хуулахад огноо хоосон (Цагаан сар жил бүр өөр өдөр). */
export function draftFromRow(
  r: SaleEventAdminRow,
  opts: { copy?: boolean } = {},
): StudioDraft {
  return {
    name: r.name,
    slug: r.slug,
    slugTouched: true,
    badgeLabel: r.badgeLabel ?? "",
    headline: r.headline ?? "",
    description: r.description ?? "",
    startsOn: opts.copy ? "" : isoToDay(r.startsAt),
    endsOn: opts.copy ? "" : isoEndToDay(r.endsAt),
    showCountdown: r.showCountdown,
    items: r.items.map((i) => ({
      productId: i.productId,
      pcts: Object.fromEntries(
        Object.entries(i.pcts).map(([ml, pct]) => [Number(ml), String(pct)]),
      ),
    })),
  };
}

/** Ноорог → `saleEventInputSchema`-ийн оролт (шалгалтыг Zod хийнэ). */
export function draftToInput(d: StudioDraft, isActive: boolean): unknown {
  return {
    name: d.name,
    slug: d.slug,
    badgeLabel: d.badgeLabel,
    headline: d.headline,
    description: d.description,
    startsOn: d.startsOn,
    endsOn: d.endsOn,
    isActive,
    showCountdown: d.showCountdown,
    items: d.items.map((i) => ({
      productId: i.productId,
      pcts: Object.fromEntries(
        Object.entries(i.pcts)
          .filter(([, v]) => v.trim() !== "")
          // Хоосон биш бол тоо — буруу утгыг Zod барина (чимээгүй алгасахгүй).
          .map(([ml, v]) => [ml, Number(v)]),
      ),
    })),
  };
}

/** Нэр солиход холбоос дагана — гараар өөрчлөөгүй л бол (D5). */
export function withName(d: StudioDraft, name: string): StudioDraft {
  return {
    ...d,
    name,
    slug: d.slugTouched ? d.slug : slugify(name).slice(0, L.slugMax),
  };
}

export function withSlug(d: StudioDraft, slug: string): StudioDraft {
  return { ...d, slug: slug.toLowerCase(), slugTouched: true };
}

/** Харагдах ба хуулах холбоос. Slug хоосон бол «…». */
export function saleLink(slug: string): { display: string; url: string } {
  const s = slug || "…";
  return {
    display: `${SITE.domain}/sale/${s}`,
    url: `${SITE.url}/sale/${slug}`,
  };
}

// ── Хадгалалт (D7) ────────────────────────────────────────────────────────

/**
 * `create` — мөр хараахан алга (①-ийн «Үргэлжлүүлэх» үүсгэнэ);
 * `auto` — ноорог, дэлгүүрт нөлөөгүй тул автоматаар;
 * `manual` — товлосон / явж буй: зөвхөн «Хадгалах» дээр;
 * `locked` — дууссан: засахгүй (fixes.md F1).
 */
export type SaveMode = "create" | "auto" | "manual" | "locked";

export function saveMode(phase: SaleEventPhase | null): SaveMode {
  if (phase === null) return "create";
  if (phase === "draft") return "auto";
  if (phase === "ended") return "locked";
  return "manual";
}

/** Нийтлэх товч юу хийхийг хэлнэ (D8): эхлэх өдөр ирээдүйд бол товлоно. */
export type PublishAction = "schedule" | "start";

export function publishAction(startsOn: string, today: string): PublishAction {
  return !startsOn || startsOn > today ? "schedule" : "start";
}

export const PUBLISH_LABEL: Record<PublishAction, string> = {
  schedule: "Товлох",
  start: "Одоо эхлүүлэх",
};

// ── Бараа, хувь ───────────────────────────────────────────────────────────

export function isValidPct(raw: string | number): boolean {
  if (typeof raw === "string" && raw.trim() === "") return false;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= SALE_EVENT_MAX_PCT;
}

export interface DiscountRange {
  /** Нийт бараа. */
  count: number;
  /** Дор хаяж нэг хүчинтэй хувьтай бараа. */
  withPct: number;
  /** Хоосон биш мөртлөө буруу хувьтай бараа. */
  invalid: number;
  min: number | null;
  max: number | null;
}

/** Ноорог (мөр утга) ба хадгалсан мөр (тоо) хоёуланд. */
export function discountRange(
  items: readonly { pcts: Record<string | number, string | number> }[],
): DiscountRange {
  let withPct = 0;
  let invalid = 0;
  let min: number | null = null;
  let max: number | null = null;
  for (const item of items) {
    const filled = Object.values(item.pcts).filter(
      (v) => typeof v === "number" || v.trim() !== "",
    );
    const valid = filled.filter(isValidPct).map(Number);
    if (valid.length < filled.length) invalid++;
    if (valid.length) withPct++;
    for (const n of valid) {
      min = min === null ? n : Math.min(min, n);
      max = max === null ? n : Math.max(max, n);
    }
  }
  return { count: items.length, withPct, invalid, min, max };
}

/** «20%» / «20–30%»; хувьгүй бол null. */
export function pctSpan(r: DiscountRange): string | null {
  if (r.min === null || r.max === null) return null;
  return r.min === r.max ? `${r.max}%` : `${r.min}–${r.max}%`;
}

/** ②-ын дээрх тойм: «12 бараа сонгосон · хямдрал 20–30%». */
export function itemsSummary(items: StudioDraft["items"]): string {
  const r = discountRange(items);
  if (r.count === 0) return "Бараа сонгоогүй";
  const span = pctSpan(r);
  return `${r.count} бараа сонгосон · ${span ? `хямдрал ${span}` : "хувьгүй"}`;
}

// ── Огноо ─────────────────────────────────────────────────────────────────

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/u;

/** `YYYY-MM-DD` → UTC үд (хуанлийн тооцоонд цагийн бүс оролцохгүй). */
function keyDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

/** «23-ны», «1-ний» — тооны дуудлагын эгшиг зохицол (нэг, дөрөв, ес → -ний). */
export function dayGenitive(day: number): string {
  const last = day % 10;
  const soft = day % 10 !== 0 && (last === 1 || last === 4 || last === 9);
  return `${day}-${soft ? "ний" : "ны"}`;
}

/** Хоёр өдрийг оролцуулаад хэд хоног. */
export function daysInclusive(startsOn: string, endsOn: string): number {
  return (
    Math.round(
      (keyDate(endsOn).getTime() - keyDate(startsOn).getTime()) / 86_400_000,
    ) + 1
  );
}

/**
 * «11-р сарын 23-ны 00:00-оос 11-р сарын 30-ны 23:59 хүртэл — 8 хоног
 * (Улаанбаатарын цагаар)». Огноо дутуу / буруу дараалалтай бол null.
 */
export function periodSentence(startsOn: string, endsOn: string): string | null {
  if (!DAY_RE.test(startsOn) || !DAY_RE.test(endsOn) || endsOn < startsOn) {
    return null;
  }
  const part = (key: string) => {
    const [, m, d] = key.split("-").map(Number);
    return `${m}-р сарын ${dayGenitive(d)}`;
  };
  return `${part(startsOn)} 00:00-оос ${part(endsOn)} 23:59 хүртэл — ${daysInclusive(
    startsOn,
    endsOn,
  )} хоног (Улаанбаатарын цагаар)`;
}

const WEEKDAYS = ["Ням", "Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба"];

/** «11/23». */
export function shortDay(key: string): string {
  const [, m, d] = key.split("-").map(Number);
  return `${m}/${d}`;
}

/** «11/23 (Даваа)». */
export function dayWithWeekday(key: string): string {
  return `${shortDay(key)} (${WEEKDAYS[keyDate(key).getUTCDay()]})`;
}

/**
 * `ends_at` нь `endsOn` өдрийн төгсгөл (дараах 00:00 УБ) биш бол — өөрөөр
 * хэлбэл «Зогсоох»-оор тасарсан бол — зогссон цаг «14:05»; эс бөгөөс null.
 */
function stoppedClock(endsOn: string, endsAt?: string | null): string | null {
  if (!endsAt || endsAt === "") return null;
  const t = Date.parse(endsAt);
  if (Number.isNaN(t) || t === Date.parse(dayEndIso(endsOn) ?? "")) return null;
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: UB_TIMEZONE,
  }).format(new Date(t));
}

// ── ⑤ «Юу болох вэ» (§5.5) ───────────────────────────────────────────────

export interface TimelineNode {
  key: "now" | "start" | "end";
  when: string;
  lines: string[];
  /** Одоо хаана яваа — нэг л зангилаа. */
  current: boolean;
  /** Баннерын жижиг зураг (эхлэх мөчид солигдох баннер). */
  image?: string | null;
}

const NOW_LINE: Record<SaleEventPhase, string> = {
  draft: "Ноорог — дэлгүүрт юу ч өөрчлөгдөхгүй.",
  scheduled: "Товлосон — эхлэх өдрөө хүлээж байна.",
  live: "Явж байна — хямдрал дэлгүүрт үйлчилж байна.",
  ended: "Дууссан — үнэ, каталог өмнөх байдалдаа буцсан.",
};

/**
 * Хугацааны шугам. `bannerReady` — энэ арга хэмжээнд холбоотой, бүрэн
 * баннер байгаа эсэх; байвал л баннерын мөр нэмнэ. `bannerAfter` — дуусах
 * мөчид гарах баннер (`heroAt`): «…» баннер гэсэн хэллэг, null = үндсэн
 * баннер, өгөөгүй бол нэрлэхгүй.
 */
export function studioTimeline(input: {
  draft: StudioDraft;
  /** null = хараахан үүсээгүй — ноорогтой адил. */
  phase: SaleEventPhase | null;
  bannerReady: boolean;
  /**
   * Хадгалагдсан `ends_at` (exclusive). Дууссан арга хэмжээг өдрийн дундуур
   * зогсоосон бол шугам жинхэнэ цагийг нь харуулна (23:59 биш).
   */
  endsAt?: string | null;
  bannerThumb?: string | null;
  bannerAfter?: string | null;
}): TimelineNode[] {
  const { draft: d, bannerReady } = input;
  const phase = input.phase ?? "draft";
  const r = discountRange(d.items);
  const span = pctSpan(r);
  const name = d.name.trim() || "Арга хэмжээ";
  const badge =
    d.badgeLabel.trim() || (r.withPct > 0 ? SALE_EVENT_DEFAULT_BADGE : "");

  const start: string[] = [];
  if (r.count === 0) {
    start.push("Бараа сонгоогүй байна.");
  } else if (r.withPct === 0) {
    start.push(
      `${r.count} бараа арга хэмжээний жагсаалтад орно — үнэ өөрчлөгдөхгүй.`,
    );
  } else {
    start.push(`${r.withPct} барааны үнэ ${span} буурна.`);
    if (r.count > r.withPct) {
      start.push(
        `Хувьгүй ${r.count - r.withPct} бараа үнээрээ үлдэж, жагсаалтад орно.`,
      );
    }
  }
  start.push(
    badge
      ? `Каталогт «${name}» шүүлтүүр, барааны карт дээр «${badge}» тэмдэг гарна.`
      : `Каталогт «${name}» шүүлтүүр гарна.`,
  );
  if (bannerReady) start.push("Нүүр хуудасны баннер солигдоно.");

  const end = [
    r.withPct > 0
      ? "Үнэ буцна, шүүлтүүр, тэмдэг алга болно."
      : badge
        ? "Шүүлтүүр, тэмдэг алга болно."
        : "Шүүлтүүр алга болно.",
  ];
  if (bannerReady) {
    end.push(
      input.bannerAfter === undefined
        ? "Нүүр хуудасны баннер өмнөх рүүгээ буцна."
        : input.bannerAfter === null
          ? "Нүүр хуудсанд үндсэн баннер гарна."
          : `Нүүр хуудсанд ${input.bannerAfter} гарна.`,
    );
  }

  const hasDates = periodSentence(d.startsOn, d.endsOn) !== null;
  const startNode: TimelineNode = {
    key: "start",
    when: hasDates ? `${dayWithWeekday(d.startsOn)} 00:00` : "Эхлэх өдөр",
    lines: start,
    current: false,
    image: bannerReady ? (input.bannerThumb ?? null) : null,
  };
  const stoppedAt =
    phase === "ended" && hasDates ? stoppedClock(d.endsOn, input.endsAt) : null;
  const endNode: TimelineNode = {
    key: "end",
    when: !hasDates
      ? "Дуусах өдөр"
      : stoppedAt
        ? `${dayWithWeekday(d.endsOn)} ${stoppedAt} — зогсоосон`
        : `${dayWithWeekday(d.endsOn)} 23:59`,
    lines: end,
    current: false,
  };
  const nowNode: TimelineNode = {
    key: "now",
    when: "Одоо",
    lines: [NOW_LINE[phase]],
    current: true,
  };
  if (phase === "live") return [startNode, nowNode, endNode];
  if (phase === "ended") return [startNode, endNode, nowNode];
  return [nowNode, startNode, endNode];
}
