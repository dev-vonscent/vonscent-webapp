import { ML_SIZES, SALE_EVENT_MAX_PCT } from "@/lib/constants";
import { bundlePrice } from "@/features/collections/pricing";

/**
 * Арга хэмжээнд бэлэн багц оруулах (task 16.7, 0190, туг
 * `sale_event_bundles`) — студи (client) ба route (server) хоёулаа ашиглах
 * цэвэр дүрмүүд. SQL `save_sale_event` ижил дүрмийг дахин шалгана.
 */

/** Студийн сонгогчийн нэг багц (хуудас серверээс өгнө). */
/**
 * Одоо худалдаж авч болох эсэх (SQL `collection_sellable`, 0191): дууссан /
 * идэвхгүй багцыг ШИНЭЭР нэмэхгүй; аль хэдийн event-д байгаа бол үлдэнэ.
 */
export type BundleStatus = "available" | "sold_out" | "inactive";

export const BUNDLE_STATUS_LABEL: Record<
  Exclude<BundleStatus, "available">,
  string
> = {
  sold_out: "Дууссан",
  inactive: "Идэвхгүй",
};

export interface SaleEventBundleOption {
  id: string;
  name: string;
  status: BundleStatus;
  image: string | null;
  /** ml → багцын ОДООГИЙН (суурь) хувь — `discountForMl`. */
  basePcts: Record<number, number>;
  /** ml → гишүүдийн үндсэн үнийн нийлбэр (бүх гишүүнд тэр хэмжээ байвал). */
  memberSums: Record<number, number>;
  /** Энэ багцыг агуулсан БУСАД арга хэмжээ (16.3). */
  events: SaleEventBundleMembership[];
}

export interface SaleEventBundleMembership {
  eventId: string;
  name: string;
  /** Нийтэлсэн (товлосон / live / дууссан); false = ноорог. */
  isActive: boolean;
  startsAt: string;
  /** Exclusive хил. */
  endsAt: string;
}

/** Студийн ноорог дахь нэг багц — хоосон = тэр хэмжээ event-гүй. */
export interface StudioBundle {
  collectionId: string;
  pcts: Record<number, string>;
}

/**
 * 16.3 — барааны дүрэмтэй ЯГ ижил (0181 `sale_event_check_overlap`):
 * нийтэлсэн хоёр арга хэмжээний хугацаа давхцвал нэг багц хоёуланд орохгүй;
 * ноорог түгжихгүй. Студид:
 *   · `locked` — хугацаа давхцсан нийтэлсэн event (огноо сонгоогүй бол
 *     дуусаагүй нийтэлсэн event бүр) → disabled «— «Black Friday»»;
 *   · `drafts` — ноорогт орсон нэрс → мэдээлэл «ноорог: <нэр>».
 */
export function bundleLock(
  option: Pick<SaleEventBundleOption, "events">,
  ctx: {
    eventId: string | null;
    /** Энэ ноорогийн хугацаа (ISO, exclusive end); сонгоогүй бол null. */
    startsAt: string | null;
    endsAt: string | null;
    now: number;
  },
): { locked: SaleEventBundleMembership | null; drafts: string[] } {
  const others = option.events.filter((e) => e.eventId !== ctx.eventId);
  const locked =
    others.find((e) => {
      if (!e.isActive) return false;
      if (ctx.startsAt && ctx.endsAt) {
        return (
          Date.parse(e.startsAt) < Date.parse(ctx.endsAt) &&
          Date.parse(ctx.startsAt) < Date.parse(e.endsAt)
        );
      }
      return Date.parse(e.endsAt) > ctx.now;
    }) ?? null;
  return {
    locked,
    drafts: others.filter((e) => !e.isActive).map((e) => e.name),
  };
}

function validPct(raw: string | number): boolean {
  if (typeof raw === "string" && raw.trim() === "") return false;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= SALE_EVENT_MAX_PCT;
}

/** Хоосон биш хэмжээнүүд → тоо. */
export function filledPcts(
  pcts: Record<string | number, string | number>,
): Record<number, number> {
  const out: Record<number, number> = {};
  for (const [ml, v] of Object.entries(pcts)) {
    if (typeof v === "string" && v.trim() === "") continue;
    if (v == null) continue;
    out[Number(ml)] = Number(v);
  }
  return out;
}

/** «2ml-д 5%» — алдааны мессежийн хэсэг. */
const atMl = (ml: number, pct: number) => `${ml}ml-д ${pct}%`;

/**
 * Event хувь > одоогийн суурь хувь (орлох тул бага/тэнцүү бол багц хямдрахгүй
 * эсвэл үнэтэй болно). Монгол мессеж, одоогийн хувийг дурдана. Хүчинтэй бол
 * null. Route (server) ба студи (client) хоёулаа.
 */
export function bundlePctLowMessage(
  name: string,
  pcts: Record<number, number>,
  basePcts: Record<number, number>,
): string | null {
  const low = ML_SIZES.filter(
    (ml) => pcts[ml] != null && pcts[ml] <= (basePcts[ml] ?? 0),
  );
  if (!low.length) return null;
  const parts = low.map((ml) => atMl(ml, basePcts[ml] ?? 0)).join(", ");
  return `«${name}» багцын хувь одоогийнхоос их байх ёстой — одоо ${parts} хямдралтай.`;
}

/**
 * Багц бүрийн асуудал (студийн мөр, checklist): 16.5 хувьгүй, буруу хувь,
 * суурь хувиас бага. Хүчинтэй бол null.
 */
export function bundleIssue(
  bundle: StudioBundle,
  option: Pick<SaleEventBundleOption, "name" | "basePcts"> | undefined,
): string | null {
  const values = Object.values(bundle.pcts).filter((v) => v.trim() !== "");
  if (values.length === 0) return "Дор хаяж нэг хэмжээнд хувь бичнэ үү";
  if (values.some((v) => !validPct(v)))
    return `Хувь 1–${SALE_EVENT_MAX_PCT} бүхэл тоо`;
  if (!option) return null;
  const low = ML_SIZES.filter((ml) => {
    const raw = bundle.pcts[ml];
    return (
      raw != null &&
      raw.trim() !== "" &&
      Number(raw) <= (option.basePcts[ml] ?? 0)
    );
  });
  if (low.length) {
    return `Одоогийн хувиас их байх ёстой (${low
      .map((ml) => atMl(ml, option.basePcts[ml] ?? 0))
      .join(", ")})`;
  }
  return null;
}

/** Нэг хэмжээний урьдчилсан харагдац: одоогийн ба event-ийн үнэ. */
export function bundleSizePreview(
  option: Pick<SaleEventBundleOption, "basePcts" | "memberSums">,
  ml: number,
  raw: string,
  step: number,
): { memberSum: number; current: number; next: number | null } | null {
  const memberSum = option.memberSums[ml];
  if (memberSum == null) return null;
  const base = option.basePcts[ml] ?? 0;
  const current = bundlePrice(memberSum, base, step);
  const pct = validPct(raw) ? Number(raw) : null;
  // greatest — ажиллах үеийн хамгаалалттай ижил (0190).
  const next =
    pct == null ? null : bundlePrice(memberSum, Math.max(base, pct), step);
  return { memberSum, current, next };
}
