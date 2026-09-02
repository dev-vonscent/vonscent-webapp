import "server-only";
import { getProductById, fetchProducts } from "@/features/products/api";
import {
  BUNDLE_ML_SIZES,
  GIFT_SAMPLE_ML,
  SHIPPING_ZONES,
} from "@/lib/constants";
import { giftAllowanceFor } from "@/lib/gift";
import { getGiftSettings, getShippingSettings } from "@/features/content/api";
import {
  getCollectionSettings,
  getCollectionOrderInfo,
} from "@/features/collections/api";
import { bundlePrice, discountForMl } from "@/features/collections/pricing";
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
  /** Copies of bundles in the order (Σ qty) — drives the gift allowance. */
  bundleQty: number;
}

/**
 * Recompute every line's price from authoritative product data — never trust
 * prices sent by the client (development.md §7.5).
 *
 * A line whose product or size is gone (deleted, deactivated) is reported in
 * `missing` rather than dropped in silence: the browser's cart is persisted in
 * localStorage and can easily outlive the catalogue, and quietly charging for
 * whatever survived would ship an order nobody placed.
 */
export async function priceLines(
  items: OrderItemInput[],
): Promise<{ lines: PricedLine[]; missing: OrderItemInput[] }> {
  const lines: PricedLine[] = [];
  const missing: OrderItemInput[] = [];
  for (const item of items) {
    const product = await getProductById(item.productId);
    if (!product) {
      missing.push(item);
      continue;
    }
    const variant = product.variants.find((v) => v.id === item.variantId);
    if (!variant || !variant.isActive) {
      missing.push(item);
      continue;
    }
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
  return { lines, missing };
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
): Promise<{ lines: PricedLine[]; pricedBundles: number; bundleQty: number }> {
  if (!cols.length) return { lines: [], pricedBundles: 0, bundleQty: 0 };
  const [products, settings] = await Promise.all([
    fetchProducts(),
    getCollectionSettings(),
  ]);
  const variantIndex = new Map<
    string,
    {
      product: (typeof products)[number];
      price: number;
      ml: number;
      active: boolean;
    }
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
  let pricedBundles = 0;
  let bundleQty = 0;
  for (const col of cols) {
    // A bundle prices over the sizes the shop sells.
    if (!(BUNDLE_ML_SIZES as readonly number[]).includes(col.ml)) continue;
    // Duplicated member variants would double-charge one product's discount
    // weighting — a tampered payload, not something the builder produces.
    if (new Set(col.memberVariantIds).size !== col.memberVariantIds.length)
      continue;

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
      // The order's member set must BE the collection's roster — otherwise a
      // client could put any product under the collection's discount.
      const roster = new Set(info.memberProductIds);
      const ordered = new Set(members.map((m) => m.product.id));
      if (
        roster.size === 0 ||
        ordered.size !== roster.size ||
        [...ordered].some((id) => !roster.has(id))
      )
        continue;
      // Priced at the size actually ordered: a bundle may discount 20ml harder
      // than 2ml (0051), so taking the bundle default here would charge the
      // wrong total for every overridden size.
      discountPct = discountForMl(col.ml, info.discountPct, info.mlDiscounts);
      name = info.name;
      giftMl = info.giftMl ?? settings.giftMl;
    } else {
      // Custom bundles obey the shop-wide builder rules even when the payload
      // bypasses the UI.
      if (!settings.customEnabled) continue;
      if (members.length < settings.minItems) continue;
      if (settings.maxItems != null && members.length > settings.maxItems)
        continue;
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

    // Free gift: a product not already in the bundle, with enough stock for
    // EVERY copy of the bundle (giftMl × qty — the line reserves that much).
    if (col.giftProductId && settings.giftEnabled) {
      const gift = products.find((p) => p.id === col.giftProductId);
      const inBundle = members.some((m) => m.product.id === col.giftProductId);
      if (
        gift &&
        !inBundle &&
        gift.availableMl >= giftMl * col.qty &&
        !gift.soldOut
      ) {
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
    pricedBundles += 1;
    bundleQty += col.qty;
  }
  return { lines: out, pricedBundles, bundleQty };
}

/**
 * Validate the buyer's monthly gift-sample picks (questions.md №2–3) and turn
 * them into 0₮ 1ml lines. `goodsAfterDiscount` is subtotal − coupon discount
 * (shipping excluded); the allowance also counts bundles — see
 * giftAllowanceFor() in src/lib/gift.ts. Picks outside the admin's
 * pool, duplicates, or picks beyond the allowance are silently dropped — the
 * order still goes through, just without the invalid gift.
 */
export async function priceGiftLines(
  giftProductIds: string[],
  goodsAfterDiscount: number,
  bundleQty = 0,
): Promise<PricedLine[]> {
  if (!giftProductIds.length) return [];
  const allowance = giftAllowanceFor(goodsAfterDiscount, bundleQty);
  if (allowance <= 0) return [];

  const settings = await getGiftSettings();
  if (!settings.enabled || settings.productIds.length === 0) return [];
  const pool = new Set(settings.productIds);

  const products = await fetchProducts();
  const out: PricedLine[] = [];
  const seen = new Set<string>();
  for (const id of giftProductIds) {
    if (out.length >= allowance) break;
    if (seen.has(id) || !pool.has(id)) continue;
    seen.add(id);
    const p = products.find((x) => x.id === id);
    if (!p || p.soldOut || p.availableMl < GIFT_SAMPLE_ML) continue;
    out.push({
      productId: p.id,
      variantId: "",
      name: p.name,
      brand: p.brand,
      ml: GIFT_SAMPLE_ML,
      qty: 1,
      unitPrice: 0,
      lineTotal: 0,
      collectionId: null,
      collectionName: undefined,
      isGift: true,
    });
  }
  return out;
}

/**
 * One or more cart lines point at a product/size the catalogue no longer has.
 * Carries the variant ids so the browser can strip exactly those lines.
 */
export class ItemsUnavailableError extends Error {
  constructor(readonly variantIds: string[]) {
    super("Cart contains items that no longer exist");
    this.name = "ItemsUnavailableError";
  }
}

/** A cart bundle no longer prices (deactivated / member missing / tampered). */
export class BundleUnavailableError extends Error {
  constructor() {
    super("Bundle can no longer be ordered");
    this.name = "BundleUnavailableError";
  }
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
): Promise<{ zone: string; fee: number }> {
  const settings = await getShippingSettings();
  const zones = settings.zones?.length ? settings.zones : [...SHIPPING_ZONES];

  const mapped = resolveZone(zones, {
    city: address.shipCity,
    district: address.shipDistrict,
    khoroo: address.shipKhoroo,
  });
  // A countryside address with no explicit rule always prices as the rural
  // zone — the customer's dropdown pick must not undercut it with a city fee.
  const ruralFallback =
    address.shipCity && address.shipCity !== "Улаанбаатар"
      ? zones.find((z) => z.remote && z.deliverable !== false)
      : undefined;
  const zone =
    mapped ?? (ruralFallback ? zoneKey(ruralFallback) : address.shipZone);

  // Match on the stable code so a renamed zone still prices correctly; older
  // orders/clients that send a zone name are still found through zoneKey().
  const found = zones.find((z) => zoneKey(z) === zone);
  if (found && found.deliverable === false) {
    throw new UndeliverableZoneError(zone);
  }
  // Every order pays its delivery fee — the free-shipping tier was removed on
  // the client's instruction (questions.md «Борлуулалт бодох арга»).
  // Unknown zone (stale client, renamed setting) falls back to the first
  // deliverable zone rather than to free shipping.
  const fallback = zones.find((z) => z.deliverable !== false);
  return { zone, fee: found?.fee ?? fallback?.fee ?? 0 };
}

export async function computeSummary(
  input: Pick<CheckoutInput, "items" | "collections"> & ShippingAddress,
): Promise<OrderSummary> {
  const requestedBundles = input.collections ?? [];
  const [itemResult, bundleResult] = await Promise.all([
    priceLines(input.items),
    priceCollectionLines(requestedBundles),
  ]);
  // Same rule as a vanished bundle below: fail loudly, naming the lines the
  // customer has to drop, instead of pricing an order they never assembled.
  if (itemResult.missing.length > 0) {
    throw new ItemsUnavailableError(itemResult.missing.map((i) => i.variantId));
  }
  // A bundle that failed re-validation (deactivated, member gone, tampered)
  // must fail the order loudly — silently charging for the rest would ship an
  // order the customer didn't ask for.
  if (bundleResult.pricedBundles < requestedBundles.length) {
    throw new BundleUnavailableError();
  }
  const lines = [...itemResult.lines, ...bundleResult.lines];
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const { zone, fee: shippingFee } = await resolveShipping(input);
  // The coupon discount is applied inside place_order, which re-validates the
  // code against the buyer; this preview stays at 0.
  const discount = 0;
  const total = Math.max(subtotal + shippingFee - discount, 0);
  return {
    lines,
    subtotal,
    shipZone: zone,
    shippingFee,
    discount,
    total,
    bundleQty: bundleResult.bundleQty,
  };
}

export interface PlacedOrder {
  orderNo: string;
  total: number;
  paymentMethod: CheckoutInput["paymentMethod"];
}
