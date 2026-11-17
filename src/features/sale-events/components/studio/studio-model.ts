import { periodSentence as sharedPeriodSentence } from "@/features/admin/lib/period";
import {
  SALE_EVENT_DEFAULT_BADGE,
  SALE_EVENT_LIMITS as L,
  SALE_EVENT_MAX_PCT,
  SITE,
  type SaleEventTickerTheme,
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
  /** Дээд гүйдэг зурвасын өнгө; null → өгөгдмөл (navy). */
  tickerTheme: SaleEventTickerTheme | null;
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

/** Гол үйлдлийн товч — хар theme-д `bg-primary` бараг харагддаггүй (CLAUDE.md). */
export const STUDIO_CTA = "bg-cta text-cta-foreground hover:bg-cta/90";

export const STUDIO_STEP_LABEL: Record<StudioStep, string> = {
  basics: "Үндсэн",
  products: "Бараа, хямдрал",
  catalog: "Каталогт харагдах",
  banner: "Нүүрний баннер",
  review: "Шалгаад нийтлэх",
};

/** Алхам бүрийн эхний нэг өгүүлбэр (§4.2). */
/** Нийтэлсний дараа ⑤ нь тойм хуудас (§5.5). */
export const REVIEW_HINT_PUBLISHED = "Юу болж байгаа, юу болох.";

export const STUDIO_STEP_HINT: Record<StudioStep, string> = {
  basics: "Нэр, хугацаа, холбоос.",
  products: "Аль бараа, аль хэмжээ хэдэн хувиар хямдрах вэ.",
  catalog: "Харагдац дээр текстээ шууд засна.",
  banner: "Арга хэмжээний үеэр нүүрэнд гарах баннер.",
  review: "Гол мэдээллээ шалгаад нийтэлнэ.",
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
    tickerTheme: null,
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
    tickerTheme: r.tickerTheme,
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
    tickerTheme: d.tickerTheme,
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
  /**
   * Нэг ч хэмжээнд хувь бичээгүй бараа. Сонгосон бараа бүр дор хаяж нэг
   * хэмжээнд хямдрах ёстой — нийтлэхийг хориглоно (checklist, Zod).
   */
  noPct: number;
  min: number | null;
  max: number | null;
}

/** Ноорог (мөр утга) ба хадгалсан мөр (тоо) хоёуланд. */
export function discountRange(
  items: readonly { pcts: Record<string | number, string | number> }[],
): DiscountRange {
  let withPct = 0;
  let invalid = 0;
  let noPct = 0;
  let min: number | null = null;
  let max: number | null = null;
  for (const item of items) {
    const filled = Object.values(item.pcts).filter(
      (v) => typeof v === "number" || v.trim() !== "",
    );
    const valid = filled.filter(isValidPct).map(Number);
    if (valid.length < filled.length) invalid++;
    if (valid.length) withPct++;
    if (filled.length === 0) noPct++;
    for (const n of valid) {
      min = min === null ? n : Math.min(min, n);
      max = max === null ? n : Math.max(max, n);
    }
  }
  return { count: items.length, withPct, invalid, noPct, min, max };
}

/**
 * ②-оос цааш явахыг хориглох шалтгаан (шинэ ноорог): сонгосон бараа бүр дор
 * хаяж нэг хэмжээнд хүчинтэй хувьтай байх ёстой. Бүгд зөв бол null.
 */
export function productsStepBlock(
  items: readonly { pcts: Record<string | number, string | number> }[],
): string | null {
  const r = discountRange(items);
  if (r.invalid > 0) {
    return `${r.invalid} барааны хувь буруу — 1–${SALE_EVENT_MAX_PCT} бүхэл тоо.`;
  }
  if (r.noPct > 0) {
    return `${r.noPct} бараанд хувь өгөөгүй — бараа бүр дор хаяж нэг хэмжээнд хямдрах ёстой.`;
  }
  return null;
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

export { dayGenitive, daysInclusive } from "@/features/admin/lib/period";

/**
 * «11-р сарын 23-ны 00:00-оос 11-р сарын 30-ны 23:59 хүртэл — 8 хоног
 * (Улаанбаатарын цагаар)». Арга хэмжээнд хоёр өдөр хоёулаа заавал тул дутуу /
 * буруу дараалалтай бол null. Бие нь админы дундын `periodSentence` (task 7).
 */
export function periodSentence(startsOn: string, endsOn: string): string | null {
  if (!DAY_RE.test(startsOn) || !DAY_RE.test(endsOn)) return null;
  return sharedPeriodSentence(startsOn, endsOn);
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
  live: "Идэвхтэй — хямдрал дэлгүүрт үйлчилж байна.",
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
  start.push(
    `Сайтын дээд талд «${d.headline.trim() || name}» гүйдэг зурвас гарна.`,
  );
  if (bannerReady) start.push("Нүүр хуудасны баннер солигдоно.");

  const end = [
    r.withPct > 0
      ? "Үнэ буцна; зурвас, шүүлтүүр, тэмдэг алга болно."
      : badge
        ? "Зурвас, шүүлтүүр, тэмдэг алга болно."
        : "Зурвас, шүүлтүүр алга болно.",
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
