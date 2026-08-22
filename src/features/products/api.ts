import "server-only";
import { cache } from "react";
import type {
  CatalogFilters,
  CatalogResult,
  ProductDetail,
  ProductListItem,
} from "@/lib/types";
import type { ScentFamily, Season, TagKind } from "@/db/types";
import { SEED_PRODUCTS } from "./seed";
import { isSupabaseConfigured } from "@/lib/env";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * Product data access (development.md §3 — features domain api).
 *
 * Reads live data from Supabase. When Supabase isn't configured it falls back
 * to the seed catalogue so the project still runs in demo mode.
 */

// ── DB row shapes (supabase client is untyped here; we map explicitly) ──────
interface DbVariant {
  id: string;
  ml: number;
  price: number;
  is_active: boolean;
}
interface DbImage {
  url: string;
  alt: string | null;
  sort_order: number;
}
interface DbInventory {
  on_hand_ml: number;
  reserved_ml: number;
  is_sold_out: boolean;
}
interface DbProduct {
  id: string;
  slug: string;
  name: string;
  brand: string;
  description: string;
  notes_description: string | null;
  usage_description: string | null;
  short_description: string | null;
  notes_top: string[];
  notes_heart: string[];
  notes_base: string[];
  gender: ProductDetail["gender"];
  concentration: ProductDetail["concentration"];
  scent_families: ScentFamily[] | null;
  seasons: Season[] | null;
  origin_country: string | null;
  release_year: number | null;
  bottle_ml: number;
  rating_avg: number;
  rating_count: number;
  created_at: string;
  product_images: DbImage[];
  product_variants: DbVariant[];
  inventory: DbInventory | DbInventory[] | null;
  product_tags: {
    tags:
      | { slug: string; kind: TagKind }
      | { slug: string; kind: TagKind }[]
      | null;
  }[];
}

const SELECT = `
  id, slug, name, brand,
  description, notes_description, usage_description, short_description,
  notes_top, notes_heart, notes_base,
  gender, concentration, scent_families, seasons,
  origin_country, release_year, bottle_ml,
  rating_avg, rating_count, created_at,
  product_images ( url, alt, sort_order ),
  product_variants ( id, ml, price, is_active ),
  inventory ( on_hand_ml, reserved_ml, is_sold_out ),
  product_tags ( tags ( slug, kind ) )
`;

function mapProduct(row: DbProduct): ProductDetail {
  const images = [...row.product_images]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((i) => ({ url: i.url, alt: i.alt ?? row.name }));

  const inv = Array.isArray(row.inventory) ? row.inventory[0] : row.inventory;
  const availableMl = inv ? inv.on_hand_ml - inv.reserved_ml : 0;

  // A size is buyable only when the admin left it active AND the remaining
  // source ml can still fill it (requirement_fb.md: a sold-out 20ml turns
  // itself off while 5ml keeps selling).
  const variants = [...row.product_variants]
    .sort((a, b) => a.ml - b.ml)
    .map((v) => ({
      id: v.id,
      ml: v.ml,
      price: v.price,
      isActive: v.is_active,
      inStock: !inv?.is_sold_out && availableMl >= v.ml,
    }));

  // "From" price quotes the cheapest size a customer can actually buy today.
  const sellable = variants.filter((v) => v.isActive && v.inStock);
  const priced = (
    sellable.length ? sellable : variants.filter((v) => v.isActive)
  ).map((v) => v.price);
  const startingPrice = priced.length ? Math.min(...priced) : 0;

  const tags = row.product_tags
    .map((pt) => (Array.isArray(pt.tags) ? pt.tags[0] : pt.tags)?.kind)
    .filter((k): k is TagKind => Boolean(k));

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    brand: row.brand,
    gender: row.gender,
    concentration: row.concentration,
    scentFamilies: row.scent_families ?? [],
    seasons: row.seasons ?? [],
    image: images[0] ?? null,
    images,
    startingPrice,
    tags,
    // Sold out only once *every* size is unbuyable — a bottle with 8ml left
    // still sells 5ml, so it must not be greyed out in the grid.
    soldOut: sellable.length === 0,
    ratingAvg: row.rating_avg,
    ratingCount: row.rating_count,
    createdAt: row.created_at,
    description: row.description,
    notesDescription: row.notes_description ?? "",
    usageDescription: row.usage_description ?? "",
    shortDescription: row.short_description ?? "",
    notesTop: row.notes_top,
    notesHeart: row.notes_heart,
    notesBase: row.notes_base,
    originCountry: row.origin_country,
    releaseYear: row.release_year,
    variants,
    availableMl,
    bottleMl: row.bottle_ml,
    // Filled in by fetchProducts' separate custom-tags query (audit R2).
    customTags: [],
  };
}

/**
 * Fetch all active products (deduped per request via React cache). Falls back
 * to the seed catalogue when Supabase isn't configured.
 */
export const fetchProducts = cache(async (): Promise<ProductDetail[]> => {
  if (!isSupabaseConfigured) return SEED_PRODUCTS;
  const supabase = createPublicClient();
  if (!supabase) return SEED_PRODUCTS;

  const { data, error } = await supabase
    .from("products")
    .select(SELECT)
    .eq("is_active", true);

  if (error || !data) return [];
  const products = (data as unknown as DbProduct[]).map(mapProduct);

  // Custom tags ride a SEPARATE query on purpose (audit R2): embedding them
  // in SELECT would make the whole catalogue vanish on a database where
  // 0035_custom_tags.sql hasn't run yet. A failure here just means no
  // tag-based search matches — never an empty shop.
  const { data: tagRows } = await supabase
    .from("product_custom_tags")
    .select("product_id, custom_tags ( name )");
  if (tagRows) {
    const byProduct = new Map<string, string[]>();
    for (const r of tagRows as unknown as {
      product_id: string;
      custom_tags: { name: string } | { name: string }[] | null;
    }[]) {
      const name = (
        Array.isArray(r.custom_tags) ? r.custom_tags[0] : r.custom_tags
      )?.name;
      if (!name) continue;
      const list = byProduct.get(r.product_id) ?? [];
      list.push(name);
      byProduct.set(r.product_id, list);
    }
    for (const p of products) {
      p.customTags = byProduct.get(p.id) ?? [];
    }
  }
  return products;
});

function toListItem(p: ProductDetail): ProductListItem {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    gender: p.gender,
    concentration: p.concentration,
    scentFamilies: p.scentFamilies,
    seasons: p.seasons,
    image: p.image,
    startingPrice: p.startingPrice,
    tags: p.tags,
    soldOut: p.soldOut,
    ratingAvg: p.ratingAvg,
    ratingCount: p.ratingCount,
    createdAt: p.createdAt,
  };
}

const DEFAULT_PER_PAGE = 12;

function sortProducts(
  items: ProductDetail[],
  sort: NonNullable<CatalogFilters["sort"]>,
): ProductDetail[] {
  const copy = [...items];
  switch (sort) {
    case "price_asc":
      return copy.sort((a, b) => a.startingPrice - b.startingPrice);
    case "price_desc":
      return copy.sort((a, b) => b.startingPrice - a.startingPrice);
    case "name":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case "popular":
      return copy.sort((a, b) => b.ratingCount - a.ratingCount);
    case "new":
    default:
      return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

export async function getCatalog(
  filters: CatalogFilters = {},
): Promise<CatalogResult> {
  const {
    brand,
    gender,
    family,
    season,
    tags,
    ml,
    minPrice,
    maxPrice,
    search,
    sort = "new",
    page = 1,
    perPage = DEFAULT_PER_PAGE,
  } = filters;

  const all = await fetchProducts();

  let items = all.filter((p) => {
    if (brand?.length && !brand.includes(p.brand)) return false;
    if (gender?.length && !gender.includes(p.gender)) return false;
    // Multi-value tags: a product matches when it carries *any* of the picked
    // families / seasons. "all" means the scent works year-round, so it
    // answers every season filter.
    if (family?.length && !family.some((f) => p.scentFamilies.includes(f)))
      return false;
    if (
      season?.length &&
      !(p.seasons.includes("all") || season.some((s) => p.seasons.includes(s)))
    )
      return false;
    if (tags?.length && !tags.some((t) => p.tags.includes(t))) return false;
    // "ml боломж" means sizes you can actually order right now.
    if (
      ml?.length &&
      !p.variants.some((v) => ml.includes(v.ml) && v.isActive && v.inStock)
    )
      return false;
    if (minPrice != null && p.startingPrice < minPrice) return false;
    if (maxPrice != null && p.startingPrice > maxPrice) return false;
    if (search) {
      const q = search.toLowerCase();
      // Free-form internal tags count as search text (A2 «Нэмэлт Tag») —
      // e.g. "оффис" surfaces every perfume the admin tagged so.
      const haystack = `${p.name} ${p.brand} ${p.customTags.join(" ")}`;
      if (!haystack.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  items = sortProducts(items, sort);

  const total = items.length;
  const start = (page - 1) * perPage;
  const pageItems = items.slice(start, start + perPage).map(toListItem);

  return { items: pageItems, total, page, perPage };
}

export async function getProductBySlug(
  slug: string,
): Promise<ProductDetail | null> {
  const all = await fetchProducts();
  return all.find((p) => p.slug === slug) ?? null;
}

export async function getProductById(
  id: string,
): Promise<ProductDetail | null> {
  const all = await fetchProducts();
  return all.find((p) => p.id === id) ?? null;
}

export async function getProductsByIds(
  ids: string[],
): Promise<ProductListItem[]> {
  if (!ids.length) return [];
  const all = await fetchProducts();
  const set = new Set(ids);
  return all.filter((p) => set.has(p.id)).map(toListItem);
}

/** Full detail shape (with variants) for several ids — used by bulk actions. */
export async function getProductDetailsByIds(
  ids: string[],
): Promise<ProductDetail[]> {
  if (!ids.length) return [];
  const all = await fetchProducts();
  const set = new Set(ids);
  return all.filter((p) => set.has(p.id));
}

/**
 * Related products, ranked by how many attributes they share with the current
 * one (requirement_fb.md: "аль болох олон таг нь таарсан уснууд байх").
 * Scent family and brand weigh heaviest; gender / season / concentration and
 * marketing tags break the ties.
 */
export async function getRelated(
  slug: string,
  limit = 4,
): Promise<ProductListItem[]> {
  const all = await fetchProducts();
  const product = all.find((p) => p.slug === slug);
  if (!product) return [];

  function score(p: ProductDetail): number {
    let n = 0;
    // Each shared family/season counts, so a scent matching two of three
    // families outranks one that only matches a single family.
    n +=
      4 *
      p.scentFamilies.filter((f) => product!.scentFamilies.includes(f)).length;
    if (p.brand === product!.brand) n += 3;
    if (p.gender === product!.gender) n += 2;
    n += 2 * p.seasons.filter((s) => product!.seasons.includes(s)).length;
    if (p.concentration === product!.concentration) n += 1;
    n += p.tags.filter((t) => product!.tags.includes(t)).length;
    return n;
  }

  return all
    .filter((p) => p.slug !== slug)
    .map((p) => ({ p, s: score(p) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.p.name.localeCompare(b.p.name))
    .slice(0, limit)
    .map((x) => toListItem(x.p));
}

export async function getNewArrivals(limit = 8): Promise<ProductListItem[]> {
  const all = await fetchProducts();
  return sortProducts(all, "new").slice(0, limit).map(toListItem);
}

/** Everything carrying a marketing tag, newest first (home rails, B7). */
export async function getProductsByTag(
  tag: TagKind,
  limit = 8,
): Promise<ProductListItem[]> {
  const all = await fetchProducts();
  return sortProducts(
    all.filter((p) => p.tags.includes(tag)),
    "new",
  )
    .slice(0, limit)
    .map(toListItem);
}

/**
 * Best sellers by actual paid sales volume (top_seller_products, security
 * definer). Falls back to the hot tag while there are no sales yet — a fresh
 * store still gets a filled rail.
 */
export async function getBestSellers(limit = 8): Promise<ProductListItem[]> {
  const supabase = createPublicClient();
  if (supabase) {
    const { data } = await supabase.rpc("top_seller_products", {
      p_limit: limit * 3,
    });
    const ranked =
      (data as { product_id: string; sold_qty: number }[] | null) ?? [];
    if (ranked.length > 0) {
      const all = await fetchProducts();
      const byId = new Map(all.map((p) => [p.id, p]));
      const items = ranked
        .map((r) => byId.get(r.product_id))
        .filter((p): p is ProductDetail => Boolean(p))
        .slice(0, limit)
        .map(toListItem);
      if (items.length > 0) return items;
    }
  }
  return getProductsByTag("hot", limit);
}

export async function getOnSale(limit = 8): Promise<ProductListItem[]> {
  return getProductsByTag("sale", limit);
}

export async function getBrands(): Promise<string[]> {
  const all = await fetchProducts();
  return [...new Set(all.map((p) => p.brand))].sort();
}

/** Lowest and highest starting price across the catalogue (for the price slider). */
export async function getPriceBounds(): Promise<{ min: number; max: number }> {
  const all = await fetchProducts();
  const prices = all.map((p) => p.startingPrice).filter((n) => n > 0);
  if (!prices.length) return { min: 0, max: 0 };
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

/** Full product list (detail shape) — used by admin server pages. */
export async function getAllProducts(): Promise<ProductDetail[]> {
  return fetchProducts();
}
