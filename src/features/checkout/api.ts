import "server-only";
import { getProductById, fetchProducts } from "@/features/products/api";
import { SHIPPING_ZONES, FREE_SHIP_OVER } from "@/lib/constants";
import { getShippingSettings } from "@/features/content/api";
import {
  getCollectionSettings,
  getCollectionOrderInfo,
} from "@/features/collections/api";
import { bundlePrice } from "@/features/collections/pricing";
import { resolveZone, zoneKey } from "@/lib/geo/zone";
import type {
  CheckoutInput,
  OrderItemInput,
  CollectionOrderInput,
} from "@/lib/validators/order";

export interface PricedLine {
  productId: string;
  variantId: string;
  name: string;
  brand: string;
  ml: number;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  /** Set on bundle lines so the order route persists the grouping. */
  collectionId?: string | null;
  collectionName?: string;
  isGift?: boolean;
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

/**
 * Re-price every bundle from authoritative product data. A base bundle's
 * discount comes from its `collections` row; a custom one uses the shop-wide
 * custom rate. The discount is spread across member lines (each keeps a
 * discounted unit_price) and the free gift is added as a 0₮ line so inventory
 * still reserves its ml. Never trust prices sent by the client.
 */
export async function priceCollectionLines(
  cols: CollectionOrderInput[],
): Promise<PricedLine[]> {
  if (!cols.length) return [];
  const [products, settings] = await Promise.all([
    fetchProducts(),
    getCollectionSettings(),
  ]);
  const variantIndex = new Map<
    string,
    { product: (typeof products)[number]; price: number; ml: number; active: boolean }
  >();
  for (const p of products) {
    for (const v of p.variants) {
      variantIndex.set(v.id, {
        product: p,
        price: v.price,
        ml: v.ml,
        active: v.isActive,
      });
    }
  }

  const out: PricedLine[] = [];
  for (const col of cols) {
    const members = col.memberVariantIds
      .map((id) => {
        const e = variantIndex.get(id);
        return e ? { ...e, variantId: id } : null;
      })
      .filter((m): m is NonNullable<typeof m> => Boolean(m));
    // Reject a tampered bundle (missing / inactive / wrong-size member).
    if (members.length !== col.memberVariantIds.length) continue;
    if (members.some((m) => !m.active || m.ml !== col.ml)) continue;

    let discountPct = settings.customDiscountPct;
    let name = "Миний багц";
    let giftMl = settings.giftMl;
    if (col.type === "base" && col.collectionId) {
      const info = await getCollectionOrderInfo(col.collectionId);
      if (!info) continue; // base bundle vanished — drop it
      discountPct = info.discountPct;
      name = info.name;
      giftMl = info.giftMl ?? settings.giftMl;
    }

    const memberSum = members.reduce((s, m) => s + m.price, 0);
    const total = bundlePrice(memberSum, discountPct, settings.roundTo);

    // Spread the discounted total across members; the last line absorbs the
    // rounding remainder so the parts sum exactly to `total`.
    let assigned = 0;
    members.forEach((m, i) => {
      const last = i === members.length - 1;
      const unit = last
        ? Math.max(0, total - assigned)
        : memberSum > 0
          ? Math.round((m.price / memberSum) * total)
          : 0;
      if (!last) assigned += unit;
      out.push({
        productId: m.product.id,
        variantId: m.variantId,
        name: m.product.name,
        brand: m.product.brand,
        ml: col.ml,
        qty: col.qty,
        unitPrice: unit,
        lineTotal: unit * col.qty,
        collectionId: col.collectionId,
        collectionName: name,
        isGift: false,
      });
    });

    // Free gift: a product not already in the bundle, with stock for the size.
    if (col.giftProductId) {
      const gift = products.find((p) => p.id === col.giftProductId);
      const inBundle = members.some((m) => m.product.id === col.giftProductId);
      if (gift && !inBundle && gift.availableMl >= giftMl && !gift.soldOut) {
        out.push({
          productId: gift.id,
          variantId: "",
          name: gift.name,
          brand: gift.brand,
          ml: giftMl,
          qty: col.qty,
          unitPrice: 0,
          lineTotal: 0,
          collectionId: col.collectionId,
          collectionName: name,
          isGift: true,
        });
      }
    }
  }
  return out;
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
  input: Pick<CheckoutInput, "items" | "collections"> & ShippingAddress,
): Promise<OrderSummary> {
  const [itemLines, bundleLines] = await Promise.all([
    priceLines(input.items),
    priceCollectionLines(input.collections ?? []),
  ]);
  const lines = [...itemLines, ...bundleLines];
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
