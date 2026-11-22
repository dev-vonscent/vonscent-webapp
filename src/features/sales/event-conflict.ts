import "server-only";
import { NextResponse } from "next/server";

/** `SALE_CONFLICT`-ийн нэг мөр — бараа ба түүнийг эзэмшиж буй хямдрал. */
export interface SaleConflictRow {
  productId: string;
  sale: string;
}

/**
 * 0200: гар хямдрал бичих үед тухайн бараа хугацаа давхцсан арга хэмжээнд
 * байвал `product_variants`-ийн trigger `SALE_CONFLICT`-ийг `hint = 'EVENT'`
 * -тай шиднэ (`save_sale`-ийн өөр гар хямдралын давхцлаас ялгахын тулд).
 */
export function isEventSaleConflict(error: {
  message: string;
  hint?: string | null;
}): boolean {
  return /SALE_CONFLICT/.test(error.message) && error.hint === "EVENT";
}

export function parseSaleConflicts(
  detail: string | null | undefined,
): SaleConflictRow[] {
  try {
    const v: unknown = JSON.parse(detail ?? "[]");
    return Array.isArray(v)
      ? v.filter(
          (r): r is SaleConflictRow =>
            typeof r === "object" &&
            r != null &&
            typeof (r as SaleConflictRow).productId === "string" &&
            typeof (r as SaleConflictRow).sale === "string",
        )
      : [];
  } catch {
    return [];
  }
}

/** «Black Friday», «Цагаан сар» — давхардалгүй нэрс. */
export function eventConflictMessage(rows: readonly SaleConflictRow[]): string {
  const names = [...new Set(rows.map((r) => `«${r.sale}»`))];
  const which = names.length ? ` (${names.join(", ")})` : "";
  return `Зарим бараа хугацаа давхцсан арга хэмжээнд${which} орсон байна. Нэг бараа гар хямдрал ба арга хэмжээнд зэрэг орохгүй — барааг хасах эсвэл арга хэмжээ дууссаны дараах хугацаа сонгоно уу.`;
}

/** Route-уудын нийтлэг 409 хариу; арга хэмжээний давхцал биш бол null. */
export function eventSaleConflictResponse(
  error: {
    message: string;
    details?: string | null;
    hint?: string | null;
  },
  opts: { suffix?: string } = {},
): NextResponse | null {
  if (!isEventSaleConflict(error)) return null;
  const conflicts = parseSaleConflicts(error.details);
  return NextResponse.json(
    { error: eventConflictMessage(conflicts) + (opts.suffix ?? ""), conflicts },
    { status: 409 },
  );
}
