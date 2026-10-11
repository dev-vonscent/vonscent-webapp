import type { CatalogFilters, ProductListItem } from "@/lib/types";
import type { Collection } from "@/features/collections/types";
import { catalogPrice } from "@/features/collections/catalog-filter";

/**
 * Нүүрний rail-ийн нэг нүд — ус эсвэл багц. «Эрэлттэй», «Онцлох», «Шинээр
 * ирсэн» гурав хоёуланг нь хольж харуулна (клиент, 2026-10).
 */
export type RailItem =
  | { kind: "product"; product: ProductListItem }
  | { kind: "collection"; collection: Collection };

export const productItem = (product: ProductListItem): RailItem => ({
  kind: "product",
  product,
});
export const collectionItem = (collection: Collection): RailItem => ({
  kind: "collection",
  collection,
});

/** Fisher–Yates, оролтыг өөрчлөхгүй. `random` нь тестэд зориулагдсан. */
export function shuffle<T>(xs: readonly T[], random = Math.random): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * `size` нүдтэй rail: багц `maxCollections` хүртэл, үлдсэнийг ус нөхнө —
 * 3 багц л байвал 9 ус + 3 багц. Ус дутвал rail богино гарна.
 */
export function fillRail(
  products: readonly ProductListItem[],
  collections: readonly Collection[],
  size: number,
  maxCollections: number,
): { products: ProductListItem[]; collections: Collection[] } {
  const picked = collections.slice(0, Math.min(maxCollections, size));
  return {
    products: products.slice(0, size - picked.length),
    collections: picked,
  };
}

/**
 * Эрэмбэ хадгалан ээлжлүүлнэ: ус₁, багц₁, ус₂, багц₂… Нэг нь дуусвал
 * нөгөөгийнх нь үлдсэн хэсэг араас нь орно.
 */
export function interleave(
  products: readonly ProductListItem[],
  collections: readonly Collection[],
): RailItem[] {
  const out: RailItem[] = [];
  for (let i = 0; i < Math.max(products.length, collections.length); i++) {
    if (i < products.length) out.push(productItem(products[i]));
    if (i < collections.length) out.push(collectionItem(collections[i]));
  }
  return out;
}

/** Ус, багцыг санамсаргүй дарааллаар холино. */
export function mixRandom(
  products: readonly ProductListItem[],
  collections: readonly Collection[],
  random = Math.random,
): RailItem[] {
  return shuffle(
    [...products.map(productItem), ...collections.map(collectionItem)],
    random,
  );
}

type CatalogSort = CatalogFilters["sort"];

/** Эрэмбэ нь утгаар тодорхойлогддог эрэмбүүд — багц байрандаа шигдэнэ. */
function sortKey(sort: CatalogSort) {
  switch (sort) {
    case "price_asc":
      return (a: RailItem, b: RailItem) => price(a) - price(b);
    case "price_desc":
      return (a: RailItem, b: RailItem) => price(b) - price(a);
    case "name":
      return (a: RailItem, b: RailItem) => name(a).localeCompare(name(b));
    default:
      return null;
  }
}
const price = (it: RailItem) =>
  it.kind === "product"
    ? it.product.startingPrice
    : catalogPrice(it.collection);
const name = (it: RailItem) =>
  it.kind === "product" ? it.product.name : it.collection.name;

/**
 * Каталогийн холимог жагсаалт. Үнэ/нэрээр эрэмбэлсэн бол багц бүр
 * эрэмбэн дэх байрандаа орно; ачаалагдаагүй хуудас үлдсэн үед (`complete`
 * false) сүүлийн усны цаана орох багцууд дараагийн хуудсыг хүлээнэ —
 * эс бөгөөс 24 дэх усны дараа үнэтэй багц гараад, дараагийн хуудсанд
 * хямд ус ирж эрэмбэ эвдэрнэ. Бусад эрэмбэд (санал болгох, шинэ…) эхний
 * мөрүүдэд ээлжилнэ.
 */
export function mixCatalog(
  products: readonly ProductListItem[],
  collections: readonly Collection[],
  sort: CatalogSort,
  complete: boolean,
): RailItem[] {
  const cmp = sortKey(sort);
  if (!cmp) return interleave(products, collections);

  const ps = products.map(productItem);
  const last = ps[ps.length - 1];
  const cs = collections
    .map(collectionItem)
    .filter((c) => complete || !last || cmp(c, last) <= 0);
  const out: RailItem[] = [];
  let i = 0;
  let j = 0;
  while (i < ps.length || j < cs.length) {
    // Тэнцвэл ус түрүүлнэ — тогтвортой.
    if (j >= cs.length || (i < ps.length && cmp(ps[i], cs[j]) <= 0))
      out.push(ps[i++]);
    else out.push(cs[j++]);
  }
  return out;
}
