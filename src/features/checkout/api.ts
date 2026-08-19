import "server-only";
import { getProductById } from "@/features/products/api";
import { SHIPPING_ZONES, FREE_SHIP_OVER } from "@/lib/constants";
import { getShippingSettings } from "@/features/content/api";
import { resolveZone, zoneKey } from "@/lib/geo/zone";
import type { CheckoutInput, OrderItemInput } from "@/lib/validators/order";

export interface PricedLine {
  productId: string;
  variantId: string;
  name: string;
  brand: string;
  ml: number;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderSummary {
  lines: PricedLine[];
  subtotal: number;
  /** The zone actually charged — derived from the address where a rule covers it. */
  shipZone: string;
  shippingFee: number;
  discount: number;
  total: number;
}

/**
 * Recompute every line's price from authoritative product data — never trust
 * prices sent by the client (development.md §7.5). Unknown items are skipped.
 */
export async function priceLines(
  items: OrderItemInput[],
): Promise<PricedLine[]> {
  const lines: PricedLine[] = [];
  for (const item of items) {
    const product = await getProductById(item.productId);
    if (!product) continue;
    const variant = product.variants.find((v) => v.id === item.variantId);
    if (!variant || !variant.isActive) continue;
    const unitPrice = variant.price;
    lines.push({
      productId: item.productId,
      variantId: item.variantId,
      name: product.name,
      brand: product.brand,
      ml: variant.ml,
      qty: item.qty,
      unitPrice,
      lineTotal: unitPrice * item.qty,
    });
  }
  return lines;
}

export class UndeliverableZoneError extends Error {
  constructor(zone: string) {
    super(`Zone is not served: ${zone}`);
    this.name = "UndeliverableZoneError";
  }
}

/** What the shipping calculation needs from the checkout form. */
export type ShippingAddress = Pick<
  CheckoutInput,
  "shipZone" | "shipCity" | "shipDistrict" | "shipKhoroo"
>;

/**
 * Authoritative shipping zone + fee. Reads the admin's zone table (A10) — the
 * browser only ever *displays* a fee, it never gets to decide one.
 *
 * Where the admin has mapped the customer's хороо / сум to a zone (B5b), that
 * mapping wins over the dropdown, so nobody pays А-бүс rates for a Б-бүс
 * address. Throws for zones we don't serve so an undeliverable order can't
 * slip through with fee 0.
 */
export async function resolveShipping(
  address: ShippingAddress,
  subtotal: number,
): Promise<{ zone: string; fee: number }> {
  const settings = await getShippingSettings();
  const zones = settings.zones?.length ? settings.zones : [...SHIPPING_ZONES];

  const mapped = resolveZone(zones, {
    city: address.shipCity,
    district: address.shipDistrict,
    khoroo: address.shipKhoroo,
  });
  const zone = mapped ?? address.shipZone;

  // Match on the stable code so a renamed zone still prices correctly; older
  // orders/clients that send a zone name are still found through zoneKey().
  const found = zones.find((z) => zoneKey(z) === zone);
  if (found && found.deliverable === false) {
    throw new UndeliverableZoneError(zone);
  }
  const freeOver = settings.freeOver ?? FREE_SHIP_OVER;
  if (freeOver > 0 && subtotal >= freeOver) return { zone, fee: 0 };
  // Unknown zone (stale client, renamed setting) falls back to the first
  // deliverable zone rather than to free shipping.
  const fallback = zones.find((z) => z.deliverable !== false);
  return { zone, fee: found?.fee ?? fallback?.fee ?? 0 };
}

export async function computeSummary(
  input: Pick<CheckoutInput, "items"> & ShippingAddress,
): Promise<OrderSummary> {
  const lines = await priceLines(input.items);
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const { zone, fee: shippingFee } = await resolveShipping(input, subtotal);
  // The coupon discount is applied inside place_order, which re-validates the
  // code against the buyer; this preview stays at 0.
  const discount = 0;
  const total = Math.max(subtotal + shippingFee - discount, 0);
  return { lines, subtotal, shipZone: zone, shippingFee, discount, total };
}

export interface PlacedOrder {
  orderNo: string;
  total: number;
  paymentMethod: CheckoutInput["paymentMethod"];
}
