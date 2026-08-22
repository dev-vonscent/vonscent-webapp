"use client";

/**
 * E-commerce event tracking (todo №25): one call fans out to GA4 and Meta
 * Pixel. Both scripts are optional (env-gated in Analytics), so every call is
 * guarded — with neither configured this is a no-op.
 */

interface TrackedItem {
  id: string;
  name: string;
  brand?: string;
  price: number;
  quantity?: number;
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

function ga(event: string, params: Record<string, unknown>) {
  window.gtag?.("event", event, params);
}

function pixel(event: string, params: Record<string, unknown>) {
  window.fbq?.("track", event, params);
}

const CURRENCY = "MNT";

function gaItems(items: TrackedItem[]) {
  return items.map((i) => ({
    item_id: i.id,
    item_name: i.name,
    item_brand: i.brand,
    price: i.price,
    quantity: i.quantity ?? 1,
  }));
}

export function trackViewItem(item: TrackedItem) {
  ga("view_item", {
    currency: CURRENCY,
    value: item.price,
    items: gaItems([item]),
  });
  pixel("ViewContent", {
    content_ids: [item.id],
    content_name: item.name,
    content_type: "product",
    value: item.price,
    currency: CURRENCY,
  });
}

export function trackAddToCart(item: TrackedItem) {
  const value = item.price * (item.quantity ?? 1);
  ga("add_to_cart", { currency: CURRENCY, value, items: gaItems([item]) });
  pixel("AddToCart", {
    content_ids: [item.id],
    content_name: item.name,
    content_type: "product",
    value,
    currency: CURRENCY,
  });
}

export function trackBeginCheckout(items: TrackedItem[], value: number) {
  ga("begin_checkout", { currency: CURRENCY, value, items: gaItems(items) });
  pixel("InitiateCheckout", {
    content_ids: items.map((i) => i.id),
    num_items: items.reduce((n, i) => n + (i.quantity ?? 1), 0),
    value,
    currency: CURRENCY,
  });
}

export function trackPurchase(
  orderNo: string,
  items: TrackedItem[],
  value: number,
) {
  ga("purchase", {
    transaction_id: orderNo,
    currency: CURRENCY,
    value,
    items: gaItems(items),
  });
  pixel("Purchase", {
    content_ids: items.map((i) => i.id),
    content_type: "product",
    value,
    currency: CURRENCY,
  });
}
