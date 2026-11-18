import type { BuyNowLine, CartCollection, CartItem } from "./store";

/**
 * Сагсан дахь үнийг ОДООГИЙН үнээр шинэчлэх (task 16.1-ийн үлдэгдэл, D7).
 *
 * Сагс `localStorage`-д сагсанд нэмсэн мөчийн үнийг хадгалдаг. Хямдрал
 * (арга хэмжээ, гар хямдрал) дууссаны дараа ч хуучин хямд үнэ харагдаж,
 * checkout дээр сервер дахин бодоод `TOTAL_CHANGED` буцаадаг байв. Сагс нээх
 * болон төлбөрийн хуудсанд серверээс авсан үнээр мөрүүдийг шинэчилнэ.
 *
 * Цэвэр функцууд — өөрчлөгдөөгүй мөрийн лавлагаа хэвээр (zustand-ийн
 * селекторууд дахин render хийхгүй), өөрчлөгдсөн мөрийн нэрийг буцаана.
 */

/** Нэг хэмжээний одоогийн үнэ (`/api/products?details=1`-ийн `Variant`). */
export interface LiveVariantPrice {
  /** Бодитоор төлөх үнэ (хямдралтай бол хямдарсан). */
  price: number;
  /** Үндсэн үнэ. */
  basePrice: number;
  /** Арга хэмжээний нэр; гар хямдрал эсвэл хямдралгүй бол null. */
  saleLabel?: string | null;
}

/** Багцын нэг хэмжээний одоогийн үнэ (`/api/collections/quote`). */
export interface LiveBundlePrice {
  price: number;
  discountPct: number;
  members: { variantId: string; price: number }[];
}

export interface LivePrices {
  /** variantId → үнэ. */
  variants?: Record<string, LiveVariantPrice>;
  /** Сагсны багцын түлхүүр → үнэ. */
  collections?: Record<string, LiveBundlePrice>;
}

/** Мөрийн үнийг шинэчилнэ; өөрчлөлтгүй бол ижил лавлагаа. */
export function repriceItem(
  item: CartItem,
  live: LiveVariantPrice | undefined,
): CartItem {
  if (!live) return item;
  const saleLabel = live.saleLabel ?? null;
  if (
    item.unitPrice === live.price &&
    item.basePrice === live.basePrice &&
    (item.saleLabel ?? null) === saleLabel
  )
    return item;
  return {
    ...item,
    unitPrice: live.price,
    basePrice: live.basePrice,
    saleLabel,
  };
}

/** Багцын үнэ, хувь, гишүүдийн үнийг шинэчилнэ; өөрчлөлтгүй бол ижил лавлагаа. */
export function repriceCollection(
  c: CartCollection,
  live: LiveBundlePrice | undefined,
): CartCollection {
  if (!live) return c;
  const priceOf = new Map(live.members.map((m) => [m.variantId, m.price]));
  // Гишүүний бүрэлдэхүүн өөрчлөгдсөн бол (хариу өөр хувилбартай) хөндөхгүй —
  // тэр нь «багц өөрчлөгдсөн» асуудал, сервер checkout дээр барина.
  if (!c.members.every((m) => priceOf.has(m.variantId))) return c;
  const membersChanged = c.members.some(
    (m) => m.price !== priceOf.get(m.variantId),
  );
  if (
    !membersChanged &&
    c.unitPrice === live.price &&
    c.discountPct === live.discountPct
  )
    return c;
  return {
    ...c,
    unitPrice: live.price,
    discountPct: live.discountPct,
    members: membersChanged
      ? c.members.map((m) => ({ ...m, price: priceOf.get(m.variantId)! }))
      : c.members,
  };
}

export interface RepricedCart {
  items: CartItem[];
  collections: CartCollection[];
  buyNow: BuyNowLine | null;
  /** Үнэ нь өөрчлөгдсөн мөрүүдийн нэр («Нэр 10ml») — мэдэгдэлд. */
  changed: string[];
}

/** Сагсны бүх мөр (ба «Захиалах» мөр)-ийг нэг дор шинэчилнэ. */
export function applyLivePrices(
  state: {
    items: CartItem[];
    collections: CartCollection[];
    buyNow: BuyNowLine | null;
  },
  live: LivePrices,
): RepricedCart {
  const changed: string[] = [];
  // Зөвхөн ТӨЛӨХ үнэ өөрчлөгдсөнийг мэдэгдэнэ — анх удаа үндсэн үнэ/шошго
  // нөхөгдөх (хуучин сагс) нь хэрэглэгчид өөрчлөлт биш.
  const item = (i: CartItem) => {
    const next = repriceItem(i, live.variants?.[i.variantId]);
    if (next.unitPrice !== i.unitPrice) changed.push(`${i.name} ${i.ml}ml`);
    return next;
  };
  const collection = (c: CartCollection) => {
    const next = repriceCollection(c, live.collections?.[c.key]);
    if (next.unitPrice !== c.unitPrice) changed.push(`${c.name} ${c.ml}ml`);
    return next;
  };

  const items = state.items.map(item);
  const collections = state.collections.map(collection);
  let buyNow = state.buyNow;
  if (buyNow?.kind === "item") {
    const next = item(buyNow.item);
    if (next !== buyNow.item) buyNow = { ...buyNow, item: next };
  } else if (buyNow?.kind === "collection") {
    const next = collection(buyNow.collection);
    if (next !== buyNow.collection) buyNow = { ...buyNow, collection: next };
  }
  return {
    items: items.every((x, n) => x === state.items[n]) ? state.items : items,
    collections: collections.every((x, n) => x === state.collections[n])
      ? state.collections
      : collections,
    buyNow,
    changed,
  };
}
