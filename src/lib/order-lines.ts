import { BOTTLE_STYLE_LABEL, type BottleStyle } from "@/lib/constants";
import { formatMl } from "@/lib/format";

/**
 * Захиалгын мөрийг харуулах НЭГ дүрэм (extras-shop-plan §11) — Telegram,
 * имэйл, админ, хэрэглэгчийн захиалга, нэхэмжлэх бүгд эндээс.
 *
 *   perfume → `10ml × 2`
 *   extra   → `Хар × 2`  (хувилбаргүй бол `× 2`)
 *
 * Нэр/брэнд нь дуудагч талдаа — газар бүр өөр байрлалтай.
 */
export interface OrderLineLike {
  line_kind?: "perfume" | "extra" | null;
  ml: number | null;
  qty: number;
  variant_label?: string | null;
}

export function isExtraLine(line: Pick<OrderLineLike, "line_kind">): boolean {
  return line.line_kind === "extra";
}

/** Хэмжээ эсвэл хувилбар — тоогүй: `10ml`, `Хар`, эсвэл хоосон. */
export function orderLineVariant(line: OrderLineLike): string {
  if (isExtraLine(line)) return line.variant_label?.trim() ?? "";
  return line.ml != null ? formatMl(line.ml) : "";
}

/** `10ml × 2`, `Хар × 2`, `× 2`. */
export function orderLineMeta(line: OrderLineLike): string {
  const variant = orderLineVariant(line);
  return variant ? `${variant} × ${line.qty}` : `× ${line.qty}`;
}

/** Нэр + хувилбар нэг мөрөнд: `Aventus · 10ml`, `Бэлгийн хайрцаг — Хар`. */
export function orderLineTitle(
  line: OrderLineLike & { product_name: string },
): string {
  const variant = orderLineVariant(line);
  if (!variant) return line.product_name;
  return isExtraLine(line)
    ? `${line.product_name} — ${variant}`
    : `${line.product_name} · ${variant}`;
}

/** Цутгах савны шошго админд: `Хар сав`, 2ml-д `2ml сав`. */
export function vialLabel(vial: {
  style: BottleStyle | null;
  ml: number;
}): string {
  return vial.style
    ? BOTTLE_STYLE_LABEL[vial.style]
    : `${formatMl(vial.ml)} сав`;
}
