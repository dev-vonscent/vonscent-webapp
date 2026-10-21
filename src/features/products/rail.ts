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

/**
 * Эхлээд `ranked`-ээс (эрэмбээрээ) `count` хүртэл, дутуугаа `pool`-ийн
 * үлдсэнээс санамсаргүй нөхнө — «Эрэлттэй» rail-д 3 багц заавал байх ёстой,
 * нэг л багц зарагдсан байсан ч (клиент, 2026-10).
 */
export function topUpRandom<T extends { id: string }>(
  ranked: readonly T[],
  pool: readonly T[],
  count: number,
  random = Math.random,
): T[] {
  const picked = ranked.slice(0, count);
  const taken = new Set(picked.map((x) => x.id));
  const rest = shuffle(
    pool.filter((x) => !taken.has(x.id)),
    random,
  );
  return [...picked, ...rest.slice(0, Math.max(count - picked.length, 0))];
}

/** «Эрэлттэй» rail-ийн эхний багц орох хамгийн хойд байр (0-ээс) — 4 дэх нүд. */
const LEAD_COLLECTION_MAX = 3;

/**
 * Ус эрэмбээрээ (эрэлтээр) үлдэж, багц устай эрэлтээр өрсөлдөхгүй (клиент,
 * 2026-10):
 *  - эхний нүд үргэлж хамгийн эрэлттэй ус;
 *  - нэг багц заавал 2, 3, 4 дэх нүдний аль нэгэнд (санамсаргүй);
 *  - үлдсэн багцууд түүнээс хойш санамсаргүй байранд.
 */
export function scatterCollections(
  products: readonly ProductListItem[],
  collections: readonly Collection[],
  random = Math.random,
): RailItem[] {
  if (!products.length || !collections.length) {
    return [...products.map(productItem), ...collections.map(collectionItem)];
  }
  const n = products.length + collections.length;
  // Үлдсэн багцуудад хойно нь байр үлдэх ёстой — ус цөөн үед хязгаарлана.
  const leadMax = Math.min(LEAD_COLLECTION_MAX, n - collections.length);
  const lead = 1 + Math.floor(random() * leadMax);
  const after = Array.from({ length: n - lead - 1 }, (_, i) => lead + 1 + i);
  const slots = new Set([
    lead,
    ...shuffle(after, random).slice(0, collections.length - 1),
  ]);
  const out: RailItem[] = [];
  let p = 0;
  let c = 0;
  for (let i = 0; i < n; i++) {
    if (slots.has(i)) out.push(collectionItem(collections[c++]));
    else out.push(productItem(products[p++]));
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
