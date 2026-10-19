import type { OmittedGift } from "@/db/types";

/**
 * `place_order` (0149)-ийн хариу ба алдааг HTTP хариу болгох НЭГ газар.
 * Route ба `request_id`-ийн давхар илгээлт хоёулаа сангаас уншсан хураангуйг
 * (`order_summary`) энэ хэлбэрээр буцаана — TS-ийн урьдчилсан тооцоог биш.
 */

/** SQL `order_summary()`-ийн мөр. */
export interface OrderSummaryRow {
  order_id: string;
  order_no: string;
  subtotal: number;
  discount: number;
  loyalty_used: number;
  shipping_fee: number;
  total: number;
  omitted_gifts: OmittedGift[];
  lines: {
    id: string;
    line_kind: "perfume" | "extra";
    product_id: string | null;
    variant_id: string | null;
    extra_variant_id: string | null;
    name: string;
    brand: string;
    variant_label: string | null;
    ml: number | null;
    qty: number;
    unit_price: number;
    list_price: number | null;
    line_total: number;
    is_gift: boolean;
    collection_name: string | null;
  }[];
}

export interface PlacedSummary {
  orderId: string;
  orderNo: string;
  subtotal: number;
  discount: number;
  loyaltyUsed: number;
  shippingFee: number;
  total: number;
  omittedGifts: OmittedGift[];
  lines: {
    kind: "perfume" | "extra";
    name: string;
    brand: string;
    variantLabel: string | null;
    ml: number | null;
    qty: number;
    unitPrice: number;
    lineTotal: number;
    isGift: boolean;
  }[];
}

export function toPlacedSummary(r: OrderSummaryRow): PlacedSummary {
  return {
    orderId: r.order_id,
    orderNo: r.order_no,
    subtotal: r.subtotal,
    discount: r.discount,
    loyaltyUsed: r.loyalty_used,
    shippingFee: r.shipping_fee,
    total: r.total,
    omittedGifts: r.omitted_gifts ?? [],
    lines: (r.lines ?? []).map((l) => ({
      kind: l.line_kind,
      name: l.name,
      brand: l.brand,
      variantLabel: l.variant_label,
      ml: l.ml,
      qty: l.qty,
      unitPrice: l.unit_price,
      lineTotal: l.line_total,
      isGift: l.is_gift,
    })),
  };
}

/** Серверийн дахин бодсон дүн — клиент тоймоо үүгээр шинэчилж дахин батлуулна. */
export interface ServerTotals {
  subtotal: number;
  discount: number;
  loyaltyUsed: number;
  shippingFee: number;
  total: number;
}

export type PlaceOrderError =
  | { error: "ITEMS_UNAVAILABLE"; variantIds: string[] }
  | { error: "OUT_OF_STOCK"; productId: string }
  | { error: "BOTTLE_UNAVAILABLE" }
  | {
      error: "VIAL_UNAVAILABLE";
      productId: string | null;
      extraVariantId: string | null;
      ml: number | null;
    }
  | { error: "LOYALTY_CHANGED"; available: number }
  | {
      error: "COUPON_CHANGED" | "SHIPPING_CHANGED" | "TOTAL_CHANGED";
      totals: ServerTotals;
    }
  | { error: "EXTRA_PRICE_CHANGED"; prices: Record<string, number> }
  | {
      error: "EXTRA_QTY_UNAVAILABLE";
      extraVariantId: string;
      available: number;
      requested: number;
    }
  | {
      error: "EXTRA_UNAVAILABLE" | "LEFTOVER_ALREADY_SOLD";
      extraVariantId: string;
    }
  | { error: "EXTRAS_DISABLED" | "ORDER_TOO_LARGE" };

/** `CODE:{json}` хэлбэрийн мессежийн json хэсэг. */
function jsonAfter(
  message: string,
  code: string,
): Record<string, unknown> | null {
  const at = message.indexOf(`${code}:`);
  if (at < 0) return null;
  const rest = message.slice(at + code.length + 1).trim();
  const start = rest.indexOf("{");
  if (start !== 0) return null;
  try {
    return JSON.parse(rest) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function totalsOf(j: Record<string, unknown>): ServerTotals {
  return {
    subtotal: Number(j.subtotal ?? 0),
    discount: Number(j.discount ?? 0),
    loyaltyUsed: Number(j.loyalty_used ?? 0),
    shippingFee: Number(j.shipping_fee ?? 0),
    total: Number(j.total ?? 0),
  };
}

/**
 * `place_order`-ийн алдааны мессежийг клиентийн хариу болгоно. Танигдаагүй
 * бол null — route 500 ORDER_FAILED буцаана.
 */
export function placeOrderError(
  message: string | undefined,
): { status: number; body: PlaceOrderError } | null {
  const m = message ?? "";
  const conflict = (body: PlaceOrderError) => ({ status: 409, body });

  const unavailable = /ITEMS_UNAVAILABLE:(\S*)/.exec(m);
  if (unavailable) {
    return conflict({
      error: "ITEMS_UNAVAILABLE",
      variantIds: unavailable[1] ? [unavailable[1]] : [],
    });
  }
  for (const code of [
    "COUPON_CHANGED",
    "SHIPPING_CHANGED",
    "TOTAL_CHANGED",
  ] as const) {
    const j = jsonAfter(m, code);
    if (j) return conflict({ error: code, totals: totalsOf(j) });
  }
  // 0144 ба 0149: `LOYALTY_CHANGED:<боломжтой ₮>`.
  const loyalty = /LOYALTY_CHANGED:(\d+)/.exec(m);
  if (loyalty) {
    return conflict({
      error: "LOYALTY_CHANGED",
      available: Number(loyalty[1]),
    });
  }
  const prices = jsonAfter(m, "EXTRA_PRICE_CHANGED");
  if (prices) {
    const list =
      (prices.prices as { extra_variant_id: string; unit_price: number }[]) ??
      [];
    return conflict({
      error: "EXTRA_PRICE_CHANGED",
      prices: Object.fromEntries(
        list.map((p) => [p.extra_variant_id, p.unit_price]),
      ),
    });
  }
  const qty = jsonAfter(m, "EXTRA_QTY_UNAVAILABLE");
  if (qty) {
    return conflict({
      error: "EXTRA_QTY_UNAVAILABLE",
      extraVariantId: String(qty.extra_variant_id ?? ""),
      available: Number(qty.available ?? 0),
      requested: Number(qty.requested ?? 0),
    });
  }
  for (const code of ["EXTRA_UNAVAILABLE", "LEFTOVER_ALREADY_SOLD"] as const) {
    const j = jsonAfter(m, code);
    if (j) {
      return conflict({
        error: code,
        extraVariantId: String(j.extra_variant_id ?? ""),
      });
    }
  }
  const vial = jsonAfter(m, "VIAL_UNAVAILABLE");
  if (vial) {
    return conflict({
      error: "VIAL_UNAVAILABLE",
      productId: (vial.product_id as string | null) ?? null,
      extraVariantId: (vial.extra_variant_id as string | null) ?? null,
      ml: vial.ml == null ? null : Number(vial.ml),
    });
  }
  if (m.includes("BOTTLE_UNAVAILABLE"))
    return conflict({ error: "BOTTLE_UNAVAILABLE" });
  if (m.includes("EXTRAS_DISABLED"))
    return conflict({ error: "EXTRAS_DISABLED" });
  if (m.includes("ORDER_TOO_LARGE")) {
    return { status: 400, body: { error: "ORDER_TOO_LARGE" } };
  }
  const stock = /INSUFFICIENT_STOCK:(\S+)/.exec(m);
  if (stock) return conflict({ error: "OUT_OF_STOCK", productId: stock[1] });
  return null;
}
