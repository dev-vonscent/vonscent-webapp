/**
 * Нэртэй энгийн хямдрал (0188, туг `named_sales`, task 16.2–16.6) — цэвэр
 * функцууд. Сервер (`api.ts`) мөрүүдийг уншиж энд бүлэглэнэ; маягт (editor)
 * 16.3 / 16.5-ын дүрмийг ЭНД шалгана — SQL `save_sale` мөн адил дахин шалгана.
 */
import { ML_SIZES } from "@/lib/constants";
import { isoEndToDay, isoToDay } from "@/features/admin/lib/date-range";
import { salePhase, type SalePhase } from "@/features/products/sale";
import type { Gender } from "@/db/types";

/** «Нэргүй» бүлгийн id — URL `/admin/sales/unnamed`. */
export const UNNAMED_SALE_ID = "unnamed";
export const UNNAMED_SALE_NAME = "Нэргүй";

export type SalePcts = Partial<Record<string, number>>;

export interface SaleVariantRow {
  ml: number;
  price: number;
  salePrice: number | null;
  saleStartsAt: string | null;
  saleEndsAt: string | null;
  isActive: boolean;
  saleId: string | null;
}

export interface SaleProductRow {
  id: string;
  name: string;
  brand: string;
  gender: Gender;
  variants: SaleVariantRow[];
}

export interface SaleRecord {
  id: string;
  name: string;
  pcts: SalePcts;
  startsAt: string | null;
  endsAt: string;
}

/** Жагсаалтын нэг мөр — нэрт хямдрал эсвэл «Нэргүй» бүлэг. */
export interface SaleSummary {
  id: string;
  name: string;
  unnamed: boolean;
  phase: SalePhase;
  startsAt: string | null;
  endsAt: string | null;
  pcts: SalePcts;
  productCount: number;
}

/** Хямдралын өөрийн хугацаагаар төлөв (variant-ийн `salePhase`-тай ижил дүрэм). */
export function periodPhase(
  startsAt: string | null,
  endsAt: string | null,
  now: number,
): SalePhase {
  if (startsAt && Date.parse(startsAt) > now) return "scheduled";
  if (endsAt && Date.parse(endsAt) <= now) return "ended";
  return "active";
}

function variantPhase(v: SaleVariantRow, now: number): SalePhase | null {
  return salePhase(
    {
      price: v.price,
      sale_price: v.salePrice,
      sale_starts_at: v.saleStartsAt,
      sale_ends_at: v.saleEndsAt,
    },
    new Date(now),
  );
}

/** Нэргүй (хуучин, 0166) хямдралын хэмжээ — `sale_id`-гүй `sale_price`. */
function isUnnamed(v: SaleVariantRow): boolean {
  return v.saleId == null && v.salePrice != null && v.salePrice < v.price;
}

/** Дуусаагүй (хүчинтэй эсвэл эхлээгүй) хямдралын хэмжээ. */
function isOpen(v: SaleVariantRow, now: number): boolean {
  const phase = variantPhase(v, now);
  return phase === "active" || phase === "scheduled";
}

const PHASE_ORDER: Record<SalePhase, number> = {
  active: 0,
  scheduled: 1,
  ended: 2,
};

/**
 * Жагсаалт (16.3): нэрт хямдралууд + хуучин нэргүй хэмжээнүүд байвал нэг
 * «Нэргүй» мөр (16.6). Эрэмбэ: хүчинтэй → эхлээгүй → дууссан, дотроо
 * дуусах хугацаагаар.
 */
export function summarizeSales(
  sales: SaleRecord[],
  products: SaleProductRow[],
  now: number,
): SaleSummary[] {
  const counts = new Map<string, Set<string>>();
  const unnamed: { product: string; v: SaleVariantRow }[] = [];
  for (const p of products) {
    for (const v of p.variants) {
      if (v.saleId) {
        const set = counts.get(v.saleId) ?? new Set<string>();
        set.add(p.id);
        counts.set(v.saleId, set);
      } else if (isUnnamed(v)) unnamed.push({ product: p.id, v });
    }
  }

  const rows: SaleSummary[] = sales.map((s) => ({
    id: s.id,
    name: s.name,
    unnamed: false,
    phase: periodPhase(s.startsAt, s.endsAt, now),
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    pcts: s.pcts,
    productCount: counts.get(s.id)?.size ?? 0,
  }));

  if (unnamed.length > 0) {
    const phases = unnamed.map(({ v }) => variantPhase(v, now));
    const phase: SalePhase = phases.includes("active")
      ? "active"
      : phases.includes("scheduled")
        ? "scheduled"
        : "ended";
    const period = commonPeriod(unnamed.map(({ v }) => v));
    rows.push({
      id: UNNAMED_SALE_ID,
      name: UNNAMED_SALE_NAME,
      unnamed: true,
      phase,
      startsAt: period.startsAt,
      endsAt: period.endsAt,
      pcts: derivePcts(unnamed.map(({ v }) => v)),
      productCount: new Set(unnamed.map((u) => u.product)).size,
    });
  }

  return rows.sort(
    (a, b) =>
      PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase] ||
      (Date.parse(b.endsAt ?? "") || Infinity) -
        (Date.parse(a.endsAt ?? "") || Infinity) ||
      a.name.localeCompare(b.name),
  );
}

/**
 * Хэмжээнүүдийн нийтлэг хугацаа — бүгд ижил бол тэр, эс бөгөөс хамгийн эрт
 * эхлэл / хамгийн хожуу төгсгөл (нэргүй бүлэгт ойролцоо харуулахад).
 */
export function commonPeriod(vs: SaleVariantRow[]): {
  startsAt: string | null;
  endsAt: string | null;
} {
  const starts = vs.map((v) => v.saleStartsAt);
  const ends = vs.map((v) => v.saleEndsAt);
  const startsAt = starts.some((s) => s == null)
    ? null
    : (starts as string[]).reduce<string | null>(
        (a, b) => (a == null || Date.parse(b) < Date.parse(a) ? b : a),
        null,
      );
  const endsAt = ends.some((e) => e == null)
    ? null
    : (ends as string[]).reduce<string | null>(
        (a, b) => (a == null || Date.parse(b) > Date.parse(a) ? b : a),
        null,
      );
  return { startsAt, endsAt };
}

/**
 * Хэмжээ бүрийн хувийг `sale_price`-аас буцааж олно (16.6 — «Нэргүй»-д
 * хадгалсан хувь байхгүй). 100₮-ийн тоймлолтоос болж яг таарахгүй тул
 * бүхэл хувь руу тоймлоод хэмжээ бүрт хамгийн олон давтагдсаныг авна.
 */
export function derivePcts(vs: SaleVariantRow[]): SalePcts {
  const byMl = new Map<number, Map<number, number>>();
  for (const v of vs) {
    if (v.salePrice == null || v.price <= 0 || v.salePrice >= v.price) continue;
    const pct = Math.round(100 - (v.salePrice * 100) / v.price);
    if (pct < 1) continue;
    const m = byMl.get(v.ml) ?? new Map<number, number>();
    m.set(pct, (m.get(pct) ?? 0) + 1);
    byMl.set(v.ml, m);
  }
  const out: SalePcts = {};
  for (const [ml, m] of byMl) {
    const [best] = [...m.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    out[String(ml)] = best[0];
  }
  return out;
}

/** Хямдралд орсон барааны id (`saleId === id`, эсвэл «Нэргүй»-д нэргүй мөр). */
export function memberIds(
  products: SaleProductRow[],
  saleId: string,
): string[] {
  return products
    .filter((p) =>
      p.variants.some((v) =>
        saleId === UNNAMED_SALE_ID ? isUnnamed(v) : v.saleId === saleId,
      ),
    )
    .map((p) => p.id);
}

/**
 * 16.3: өөр ДУУСААГҮЙ хямдралд байгаа бараа → тэр хямдралын нэр. Энэ
 * маягтын хямдрал (`currentId`) өөрөө тооцогдохгүй; «Нэргүй»-г засаж байх
 * үед нэргүй мөрүүд ч саад биш (нэрлэхэд шилжинэ).
 */
export function busyProducts(
  products: SaleProductRow[],
  sales: Pick<SaleRecord, "id" | "name">[],
  currentId: string | null,
  now: number,
): Map<string, string> {
  const names = new Map(sales.map((s) => [s.id, s.name]));
  const busy = new Map<string, string>();
  for (const p of products) {
    for (const v of p.variants) {
      if (!isOpen(v, now)) continue;
      if (v.saleId) {
        if (v.saleId === currentId) continue;
        busy.set(p.id, names.get(v.saleId) ?? UNNAMED_SALE_NAME);
      } else if (isUnnamed(v) && currentId !== UNNAMED_SALE_ID) {
        busy.set(p.id, UNNAMED_SALE_NAME);
      }
    }
  }
  return busy;
}

/** Хувь оруулсан хэмжээнүүд (1..max бүхэл тоо). */
export function validPcts(raw: Record<string, string>, max: number): SalePcts {
  const out: SalePcts = {};
  for (const ml of ML_SIZES) {
    const n = Number(raw[String(ml)]);
    if (raw[String(ml)]?.trim() && Number.isInteger(n) && n >= 1 && n <= max)
      out[String(ml)] = n;
  }
  return out;
}

/**
 * 16.5: сонгосон бараанаас аль нь хувь өгсөн хэмжээнүүдийн АЛЬ НЬ Ч дээр
 * хямдрахгүй (тэр хэмжээ зарагдахгүй / үнэгүй) — тэдгээрийг буцаана.
 * SQL `save_sale`-ийн `PRODUCT_WITHOUT_DISCOUNT`-ийн толь.
 */
export function productsWithoutDiscount(
  products: SaleProductRow[],
  selected: Iterable<string>,
  pcts: SalePcts,
): SaleProductRow[] {
  const ids = new Set(selected);
  return products.filter(
    (p) =>
      ids.has(p.id) &&
      !p.variants.some(
        (v) => v.isActive && v.price > 0 && pcts[String(v.ml)] != null,
      ),
  );
}

/** «2026.11.13 – 11.21» / «2026.11.21 хүртэл» / «Хугацаагүй» (УБ өдрөөр). */
export function formatSalePeriod(
  startsAt: string | null,
  endsAt: string | null,
): string {
  const from = isoToDay(startsAt).replaceAll("-", ".");
  const to = isoEndToDay(endsAt).replaceAll("-", ".");
  if (!from && !to) return "Хугацаагүй";
  if (!from) return `${to} хүртэл`;
  if (!to) return `${from}-с хугацаагүй`;
  return from.slice(0, 4) === to.slice(0, 4)
    ? `${from} – ${to.slice(5)}`
    : `${from} – ${to}`;
}

/** «2ml 10% · 5ml 15%». */
export function formatPcts(pcts: SalePcts): string {
  const parts = ML_SIZES.filter((ml) => pcts[String(ml)] != null).map(
    (ml) => `${ml}ml ${pcts[String(ml)]}%`,
  );
  return parts.length ? parts.join(" · ") : "Хувьгүй";
}
