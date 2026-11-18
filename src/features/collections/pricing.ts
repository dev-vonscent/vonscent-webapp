import { BUNDLE_ML_SIZES } from "@/lib/constants";
import type {
  CollectionEvent,
  CollectionMember,
  CollectionPriceAtMl,
} from "./types";

/** Round to the nearest `step` (₮). step ≤ 1 rounds to the nearest whole ₮. */
export function roundTo(value: number, step: number): number {
  if (step <= 1) return Math.round(value);
  return Math.round(value / step) * step;
}

/**
 * Per-size discount overrides, keyed by ml. A size absent from the map is
 * charged the bundle's default `discount_pct` (0051) — that is what keeps every
 * bundle created before per-size pricing behaving as it always did.
 */
export type MlDiscounts = Record<number, number>;

/** The discount that applies at one size: the override, else the default. */
export function discountForMl(
  ml: number,
  defaultPct: number,
  overrides: MlDiscounts = {},
): number {
  const own = overrides[ml];
  return Number.isFinite(own) ? (own as number) : defaultPct;
}

/**
 * Арга хэмжээний хувь (task 16.7, 0190): багцын хэмжээ бүрийн LIVE event
 * хувь, ml → %. Туг хаалттай / event-гүй бол хоосон.
 */
export type EventPcts = Record<number, number>;

/**
 * Event-ийн хувийг суурь хувийн ОРОНД тавина (нэмэгдэхгүй), гэхдээ
 * `greatest(суурь, event)` — суурь хувийг админ дараа нь өсгөсөн ч арга
 * хэмжээний үеэр багц хэзээ ч үнэтэй болохгүй. Буцаасан map нь
 * `memberPrices`/`discountForMl`-ийн `overrides` болно.
 *
 * Жишээ: суурь 5%, Black Friday 10% → 10%; суурь 15%, event 10% → 15%.
 */
export function withEventPcts(
  defaultPct: number,
  overrides: MlDiscounts = {},
  eventPcts: EventPcts = {},
): MlDiscounts {
  const out: MlDiscounts = { ...overrides };
  for (const [key, pct] of Object.entries(eventPcts)) {
    const ml = Number(key);
    if (!Number.isFinite(pct)) continue;
    out[ml] = Math.max(discountForMl(ml, defaultPct, overrides), pct);
  }
  return out;
}

/**
 * Event-ийн нэмэлт хэмнэлт (₮, 1 ширхэг): суурь хувиар бодсон үнэ − бодит
 * үнэ. SQL `order_bundle_event_rows` (0190)-тэй ижил томьёо — задаргаанд
 * «Багцын хямдрал» (суурь хэсэг) ба «<Event нэр>» (энэ) мөр болж хуваагдана.
 */
export function bundleEventSaving(
  memberSum: number,
  basePct: number,
  price: number,
  step = 100,
): number {
  return Math.max(0, bundlePrice(memberSum, basePct, step) - price);
}

/**
 * Багцын эцсийн үнийг гишүүдэд үндсэн үнийн жингээр хуваарилна; сүүлийн
 * гишүүн тэгшлэлтийн үлдэгдлийг авч нийлбэр нь яг `total` болно.
 * `priceCollectionLines`-ийн `unit_price` — SQL задаргаа (0190) ба
 * integration тест (scripts/test-event-bundles.ts) ижил дүрмээр.
 */
export function spreadBundleTotal(
  memberUnits: readonly number[],
  total: number,
): number[] {
  const memberSum = memberUnits.reduce((s, u) => s + u, 0);
  let assigned = 0;
  return memberUnits.map((u, i) => {
    if (i === memberUnits.length - 1) return Math.max(0, total - assigned);
    const unit = memberSum > 0 ? Math.round((u / memberSum) * total) : 0;
    assigned += unit;
    return unit;
  });
}

/**
 * Bundle price at a given member sum: apply the % discount, then round.
 * Discount is % only (client decision §14.7).
 */
export function bundlePrice(
  memberSum: number,
  discountPct: number,
  step = 100,
): number {
  const discounted = memberSum * (1 - discountPct / 100);
  return Math.max(0, roundTo(discounted, step));
}

/**
 * Багцын гишүүний нэг хэмжээний үнэ — ҮРГЭЛЖ ҮНДСЭН үнэ.
 *
 * Бэлэн багц (Тайлан11.11 сл.2, plan §5.3) ба хэрэглэгчийн угсарсан багц
 * (task 8.2, клиентийн шийдвэр 2026-11-17) хоёулаа гишүүдийн ҮНДСЭН үнийн
 * нийлбэрээс багцын хувийг хасна. Гишүүн бараа түр хямдарсан (гар хямдрал,
 * арга хэмжээ) ч багцын үнэ өөрчлөгдөхгүй, хямдрал давхарлахгүй.
 *
 * ⚠ Өмнөх B5 шийдвэр («угсарсан багц хямдарсан үнээс дахин хувь хасна —
 * давхарлана») ЦУЦЛАГДСАН. `basePrice` байхгүй (хуучин өгөгдөл) бол `price`.
 */
export function memberUnitPrice(v: {
  price: number;
  basePrice?: number;
}): number {
  return v.basePrice ?? v.price;
}

/**
 * Compute the bundle price for every ml the shop sells. A size is `available`
 * only when *every* member has an active, in-stock variant of it (§3.2).
 *
 * Хувь нь `discountForMl(ml, default, overrides)`-оор шийдэгдэнэ — override
 * нь суурь хувийг ОРЛОНО (нэмэгдэхгүй). Арга хэмжээнд орсон багц (16.7)
 * `withEventPcts(default, mlDiscounts, eventPcts)`-ийг `overrides` болгон
 * дамжуулна: «100,000₮, суурь 5% → Black Friday 10% = 90,000₮».
 */
export function memberPrices(
  members: CollectionMember[],
  defaultDiscountPct: number,
  step = 100,
  overrides: MlDiscounts = {},
): CollectionPriceAtMl[] {
  return BUNDLE_ML_SIZES.map((ml) => {
    const rows = members.map((m) => m.variantByMl[ml]);
    const available =
      members.length > 0 && rows.every((r) => r != null && r.inStock);
    // Гишүүдийн ҮНДСЭН үнийн нийлбэр — хямдрал дамжихгүй (task 8.1, 8.2).
    const memberSum = rows.reduce(
      (sum, r) => sum + (r ? memberUnitPrice(r) : 0),
      0,
    );
    // «Тогтмол үнэ» (0054, B6) хасагдсан (task 17, 2026-11-17): бэлэн багц
    // гишүүдийн ҮНДСЭН үнээр бодогддог тул гишүүний хямдрал багцын үнийг
    // хөдөлгөхгүй — тогтмол үнийн шалтгаан алга. Багана (`price`) санд
    // үлдсэн ч тооцоонд орохгүй.
    const nominalPct = discountForMl(ml, defaultDiscountPct, overrides);
    const price = bundlePrice(memberSum, nominalPct, step);
    // Харуулах хувь нь бодит үнээс (100₮-т тэгшлэсний дараах).
    const discountPct =
      memberSum > 0
        ? Math.max(0, Math.round(((memberSum - price) / memberSum) * 100))
        : 0;
    // Зар сурталчилгаанд ашиглах хувь: admin-ий амласан хувь өөрөө, ₮-т
    // тэгшлэхээс гарах 1пп-ийн зөрүүгүйгээр (`nominalDiscountPct`, types.ts).
    const nominalDiscountPct = nominalPct;
    return {
      ml,
      memberSum,
      price,
      discountPct,
      nominalDiscountPct,
      saved: Math.max(0, memberSum - price),
      available,
    };
  });
}

/**
 * The span of discounts to advertise, e.g. «5-10%».
 *
 * Measured over the sizes the bundle can actually be bought at, so a badge
 * never promises a rate that is only available on a sold-out size. When
 * nothing is buyable there is no honest subset left, so it falls back to the
 * full table rather than reporting nothing.
 */
export function discountRange(
  prices: Pick<CollectionPriceAtMl, "ml" | "nominalDiscountPct">[],
  availableMls: number[] = [],
): { min: number; max: number } {
  const scope = availableMls.length
    ? prices.filter((p) => availableMls.includes(p.ml))
    : prices;
  if (!scope.length) return { min: 0, max: 0 };
  // `nominalDiscountPct`-ийг ашиглана, `discountPct`-г БИШ: сүүлийнх нь ₮-т
  // 100-д тэгшлэхэд ml болгонд бага зэрэг өөр гарч, badge дээр «-4-5%» мэт
  // худал range үүсгэдэг байсан (жинхэнэ ялгаа биш, зөвхөн тэгшлэлтийн шуугиан).
  const pcts = scope.map((p) => p.nominalDiscountPct);
  return { min: Math.min(...pcts), max: Math.max(...pcts) };
}

/**
 * «10%» when every size takes the same cut, «10% хүртэл» when they differ.
 * Empty when there is none.
 *
 * Зөвхөн дээд хувийг «хүртэл»-тэй хэлнэ, «5-10%» биш: гишүүд нь хямдралд
 * орсон тогтмол үнэтэй хэмжээ 0% болж badge «−0-5%» гэж гардаг байв.
 * «5% хүртэл» нь 0%-тэй хэмжээ байсан ч үнэн хэвээр.
 */
export function formatDiscountRange({
  min,
  max,
}: {
  min: number;
  max: number;
}): string {
  if (max <= 0) return "";
  return min === max ? `${max}%` : `${max}% хүртэл`;
}

/**
 * Багцын хэмжээ бүрийн үнэ + LIVE арга хэмжээ (16.7). Event-ийн хувь суурь
 * хувийг орлоно (`withEventPcts`, greatest); хэмжээ бүрийн нэмэлт хэмнэлт
 * `eventSaving`. Event нь ядаж нэг хэмжээнд хэмнэлт өгч байвал л буцна —
 * event хувь ≤ суурь хувь бол үйлчлэхгүй тул null (тэмдэг, тоолуур гарахгүй).
 */
export function priceWithBundleEvent(
  members: CollectionMember[],
  defaultPct: number,
  mlDiscounts: MlDiscounts,
  step: number,
  event: CollectionEvent | null,
): { prices: CollectionPriceAtMl[]; event: CollectionEvent | null } {
  const prices = memberPrices(
    members,
    defaultPct,
    step,
    event ? withEventPcts(defaultPct, mlDiscounts, event.pcts) : mlDiscounts,
  ).map((p) => {
    if (!event) return p;
    const eventSaving = bundleEventSaving(
      p.memberSum,
      discountForMl(p.ml, defaultPct, mlDiscounts),
      p.price,
      step,
    );
    return eventSaving > 0 ? { ...p, eventSaving } : p;
  });
  return {
    prices,
    event: event && prices.some((p) => p.eventSaving) ? event : null,
  };
}

/**
 * Багцын картын хямдрал дуусах мөч (task 2.2): ЗӨВХӨН хэмнэлт өгч буй LIVE
 * арга хэмжээнийх. Суурь хувь (анхдагч 5%, `collection_ml_discounts`)
 * хугацаагүй тул null.
 */
export function bundleSaleEndsAt(c: {
  event?: Pick<CollectionEvent, "endsAt"> | null;
}): string | null {
  return c.event?.endsAt ?? null;
}
