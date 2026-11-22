/**
 * Хямдралын (арга хэмжээ / гар хямдрал) задаргаа — нэг эх сурвалж.
 *
 * Мөрийн үнэ (`unitPrice`) нь `variant_price()`-ийн бодсон БОДИТ үнэ; үндсэн
 * үнээс хасагдсан хэсэг нь хямдрал. Задаргаанд эх сурвалжаар нь бүлэглэнэ:
 *   · арга хэмжээ (`sale_events`) — нэрээрээ тусдаа мөр: `Black Friday`;
 *   · гар хямдрал (нэртэй ч, нэргүй ч) — нэг «Хямдрал» мөр. Нэртэй
 *     хямдралын нэр (`sales.name`) зөвхөн админд — энд хэзээ ч ирэхгүй.
 *
 * SQL-ийн `order_apply_price_breakdown` (0189)-тэй ижил дүрэм: багцын мөр
 * хамаарахгүй (багц үндсэн үнээр бодогддог), дараалал нь арга хэмжээ эхэнд
 * (дүнгээр их → бага), «Хямдрал» сүүлд.
 */

/** Гар хямдралын нэгдсэн шошго. */
export const MANUAL_SALE_LABEL = "Хямдрал";

export interface SaleRow {
  label: string;
  /** Хасагдсан дүн, ₮ (эерэг). */
  amount: number;
}

export interface SaleLineInput {
  unitPrice: number;
  qty: number;
  /** Үндсэн үнэ; мэдэгдэхгүй бол хямдралгүй гэж үзнэ. */
  basePrice?: number | null;
  /** Арга хэмжээний нэр; null/хоосон бол гар хямдрал. */
  saleLabel?: string | null;
}

/** Мөрүүдийн хямдралыг эх сурвалжаар бүлэглэнэ. */
export function saleBreakdownOf(lines: readonly SaleLineInput[]): SaleRow[] {
  const byLabel = new Map<string, number>();
  for (const l of lines) {
    const base = l.basePrice ?? l.unitPrice;
    const off = (base - l.unitPrice) * l.qty;
    if (!(off > 0)) continue;
    const label = l.saleLabel?.trim() || MANUAL_SALE_LABEL;
    byLabel.set(label, (byLabel.get(label) ?? 0) + off);
  }
  return [...byLabel]
    .map(([label, amount]) => ({ label, amount }))
    .sort((a, b) => {
      const am = a.label === MANUAL_SALE_LABEL ? 1 : 0;
      const bm = b.label === MANUAL_SALE_LABEL ? 1 : 0;
      return am - bm || b.amount - a.amount || a.label.localeCompare(b.label);
    });
}

/** Задаргааны нийт хямдрал. */
export function saleTotalOf(
  rows: readonly SaleRow[] | null | undefined,
): number {
  return (rows ?? []).reduce((s, r) => s + r.amount, 0);
}

/**
 * `orders.sale_breakdown` (jsonb)-ийг найдвартай уншина. Хуучин захиалгад
 * null → null (уншигч өмнөх шигээ харуулна).
 */
export function parseSaleBreakdown(raw: unknown): SaleRow[] | null {
  if (!Array.isArray(raw)) return null;
  return raw
    .map((r) => {
      const row = (r ?? {}) as { label?: unknown; amount?: unknown };
      const amount = Number(row.amount);
      return typeof row.label === "string" &&
        Number.isFinite(amount) &&
        amount > 0
        ? { label: row.label, amount: Math.round(amount) }
        : null;
    })
    .filter((r): r is SaleRow => r != null);
}
