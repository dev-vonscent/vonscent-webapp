import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { CACHE_TAG_CATALOG } from "@/lib/cache-tags";
import * as Sentry from "@sentry/nextjs";
import type {
  CatalogFilters,
  CatalogResult,
  ProductDetail,
  ProductListItem,
} from "@/lib/types";
import type { ScentFamily, Season, TagKind } from "@/db/types";
import { SEED_PRODUCTS } from "./seed";
import { isSupabaseConfigured } from "@/lib/env";
import { matchesSearch, searchTerms } from "@/lib/search";
import { callRpc } from "@/lib/supabase/rpc";
import type { SupabaseClient } from "@supabase/supabase-js";
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
  /** Үндсэн үнэ. */
  price: number;
  /** Хямдарсан үнэ, эсвэл null (0054). */
  sale_price: number | null;
  is_active: boolean;
}
interface DbImage {
  url: string;
  alt: string | null;
  sort_order: number;
  /** 0049 — the admin's storefront selection within the gallery. */
  is_visible: boolean;
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
  is_featured: boolean | null;
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
  rating_avg, rating_count, is_featured, created_at,
  product_images ( url, alt, sort_order, is_visible ),
  product_variants ( id, ml, price, sale_price, is_active ),
  inventory ( on_hand_ml, reserved_ml, is_sold_out ),
  product_tags ( tags ( slug, kind ) )
`;

function mapProduct(row: DbProduct): ProductDetail {
  // The gallery holds every picture the admin has for this product; only the
  // ones they ticked reach the shop (0049).
  const images = [...row.product_images]
    .filter((i) => i.is_visible !== false)
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
      // Хямдарсан үнэ байвал БОДИТООР төлөх дүн нь тэр (0054). Сагс, захиалга,
      // тайлан бүгд `price`-аар явдаг тул хямдрал энэ нэг мөрөөр бүх урсгалд
      // хүчин төгөлдөр болно; үндсэн үнэ нь зөвхөн зураастай харагдана.
      price: v.sale_price ?? v.price,
      basePrice: v.price,
      isActive: v.is_active,
      inStock: !inv?.is_sold_out && availableMl >= v.ml,
    }));

  // "From" price quotes the cheapest size a customer can actually buy today.
  const sellable = variants.filter((v) => v.isActive && v.inStock);
  const quotable = sellable.length
    ? sellable
    : variants.filter((v) => v.isActive);
  // Хамгийн хямд хэмжээ — түүний ҮНДСЭН үнэ нь картан дээрх зураастай дүн.
  const cheapest = quotable.length
    ? quotable.reduce((a, b) => (a.price <= b.price ? a : b))
    : null;
  const startingPrice = cheapest?.price ?? 0;
  const startingBasePrice = cheapest?.basePrice ?? 0;

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
    startingBasePrice,
    tags,
    isFeatured: row.is_featured === true,
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
    customTagSlugs: [],
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
  await attachCustomTags(supabase, products);
  return products;
});

/**
 * Нэмэлт тагуудыг барааны мөрүүд дээр нөхөж бичнэ.
 *
 * ТУСДАА хүсэлтээр явж байгаа нь санаатай (audit R2): `SELECT`-д embed хийвэл
 * 0035_custom_tags.sql хэрэгжээгүй сан дээр каталог БҮХЭЛДЭЭ уншигдахгүй
 * болно. Энд унах нь зөвхөн тагаар хайх боломжийг алдана — дэлгүүр хоосорохгүй.
 */
async function attachCustomTags(
  supabase: SupabaseClient,
  products: ProductDetail[],
): Promise<void> {
  if (!products.length) return;
  let query = supabase
    .from("product_custom_tags")
    .select("product_id, custom_tags ( name, slug )");
  // Бүх каталогийг уншиж байгаа үед (fetchProducts) шүүлт нэмэх нь илүү; цөөн
  // бараа уншиж байвал зөвхөн тэднийх нь хэрэгтэй.
  if (products.length <= CUSTOM_TAG_FILTER_MAX) {
    query = query.in(
      "product_id",
      products.map((p) => p.id),
    );
  }
  const { data: tagRows } = await query;
  if (!tagRows) return;

  const byProduct = new Map<string, { names: string[]; slugs: string[] }>();
  for (const r of tagRows as unknown as {
    product_id: string;
    custom_tags:
      | { name: string; slug: string }
      | { name: string; slug: string }[]
      | null;
  }[]) {
    const tag = Array.isArray(r.custom_tags) ? r.custom_tags[0] : r.custom_tags;
    if (!tag?.name) continue;
    const entry = byProduct.get(r.product_id) ?? { names: [], slugs: [] };
    entry.names.push(tag.name);
    if (tag.slug) entry.slugs.push(tag.slug);
    byProduct.set(r.product_id, entry);
  }
  for (const p of products) {
    const entry = byProduct.get(p.id);
    p.customTags = entry?.names ?? [];
    p.customTagSlugs = entry?.slugs ?? [];
  }
}

/** `in(...)` шүүлт нь URL-д багтах ёстой — түүнээс олон бол бүгдийг уншина. */
const CUSTOM_TAG_FILTER_MAX = 100;

/**
 * Нэг барааг ӨӨРИЙГ НЬ уншина (slug эсвэл id-аар).
 *
 * Өмнө нь дэлгэрэнгүй хуудас `fetchProducts()`-оор бүх каталогийг татаж аваад
 * JS дотор `find()` хийдэг байв — хамгийн их хандалттай хуудас каталогийн
 * хэмжээнээс шууд хамаарч удаашрах бүтэц (backlog H2). Одоо нэг мөр л ирнэ.
 *
 * Request-д давхардвал нэг л удаа явна (React `cache`): нэг хүсэлт дээр
 * `generateMetadata`, хуудас өөрөө, OG зураг гурав ижил slug-ийг дууддаг.
 */
const fetchProductBy = cache(
  async (
    column: "slug" | "id",
    value: string,
  ): Promise<ProductDetail | null> => {
    if (!isSupabaseConfigured) {
      return SEED_PRODUCTS.find((p) => p[column] === value) ?? null;
    }
    const supabase = createPublicClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from("products")
      .select(SELECT)
      .eq(column, value)
      .eq("is_active", true)
      .maybeSingle();
    if (error || !data) return null;

    const product = mapProduct(data as unknown as DbProduct);
    await attachCustomTags(supabase, [product]);
    return product;
  },
);

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
    startingBasePrice: p.startingBasePrice,
    tags: p.tags,
    isFeatured: p.isFeatured,
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
    case "featured":
      // Дууссан нь ард, дотор нь шинэ нь түрүүлж.
      return copy.sort(
        (a, b) =>
          Number(a.soldOut) - Number(b.soldOut) ||
          b.createdAt.localeCompare(a.createdAt),
      );
    case "new":
    default:
      return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

/** `catalog_search()`-ийн нэг мөр (0058_catalog_query.sql). */
interface CatalogRow {
  total: number;
  id: string;
  slug: string;
  name: string;
  brand: string;
  gender: ProductListItem["gender"];
  concentration: ProductListItem["concentration"];
  scent_families: ScentFamily[] | null;
  seasons: Season[] | null;
  image_url: string | null;
  image_alt: string | null;
  starting_price: number;
  starting_base_price: number;
  tags: TagKind[] | null;
  is_featured: boolean;
  sold_out: boolean;
  rating_avg: number;
  rating_count: number;
  created_at: string;
}

function fromCatalogRow(r: Omit<CatalogRow, "total">): ProductListItem {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    brand: r.brand,
    gender: r.gender,
    concentration: r.concentration,
    scentFamilies: r.scent_families ?? [],
    seasons: r.seasons ?? [],
    image: r.image_url
      ? { url: r.image_url, alt: r.image_alt ?? r.name }
      : null,
    startingPrice: r.starting_price,
    startingBasePrice: r.starting_base_price,
    tags: r.tags ?? [],
    isFeatured: r.is_featured,
    soldOut: r.sold_out,
    ratingAvg: Number(r.rating_avg),
    ratingCount: r.rating_count,
    createdAt: r.created_at,
  };
}

/** Хоосон массивыг «шүүлтгүй» гэж SQL талд ойлгуулна. */
function orNull<T>(list: T[] | undefined): T[] | null {
  return list && list.length > 0 ? list : null;
}

/**
 * Каталогийн нэг хуудас.
 *
 * Шүүлт, эрэмбэ, хуудаслалт нь `catalog_search()` RPC дотор — хуудас бүрд
 * зөвхөн харагдах 12 бараа сүлжээгээр ирнэ (backlog H2). Өмнө нь энэ функц
 * бүх каталогийг санах ойд ачаалж JS дотор шүүдэг байсан бөгөөд бараа
 * нэмэгдэх тусам шууд удаашрах бүтэцтэй байв.
 *
 * RPC ажиллахгүй бол (0058 хараахан хэрэгжээгүй сан, эсвэл demo горим) хуучин
 * санах ойн замаар уншина — дэлгүүр хоосорч харагдахаас сэргийлнэ.
 */
/**
 * `catalog_search` per filter combination, held for a minute.
 *
 * The page is dynamic (it reads searchParams), so its `revalidate = 60` never
 * applied to a filtered view and every chip click paid for a fresh query
 * against the database — cheap next to a local Postgres, ~a second away from a
 * hosted one. The arguments are part of the cache key, so re-picking a filter
 * (or a second visitor picking the same one) is served from cache, and admin
 * writes purge the tag rather than waiting the window out.
 *
 * Errors are rethrown, not returned: a thrown error isn't cached, so a blip
 * doesn't pin an empty catalogue in place for a minute.
 */
const catalogSearch = unstable_cache(
  async (params: Record<string, unknown>): Promise<CatalogRow[]> => {
    const supabase = createPublicClient();
    if (!supabase) throw new Error("catalog_search: no supabase client");
    const { data, error } = await callRpc<CatalogRow[]>(
      supabase,
      "catalog_search",
      params,
    );
    if (error || !data) {
      throw new Error(`catalog_search failed: ${error?.message ?? "no rows"}`);
    }
    return data;
  },
  ["catalog-search"],
  { revalidate: 60, tags: [CACHE_TAG_CATALOG] },
);

/**
 * A gender filter also answers with unisex scents.
 *
 * «Эрэгтэй» on this shop means "a scent a man would wear", not "a scent
 * labelled male" — and a unisex bottle is exactly that. Filtering it out hid
 * a large part of the catalogue behind a choice nobody makes expecting to
 * narrow it that hard; it is the same reasoning that already lets a season of
 * "all" answer every season filter.
 *
 * Picking unisex on its own still means unisex on its own: that is a
 * deliberately narrower question.
 */
export function expandGenders(
  gender: CatalogFilters["gender"],
): CatalogFilters["gender"] {
  if (!gender?.length) return gender;
  if (!gender.some((g) => g === "male" || g === "female")) return gender;
  return gender.includes("unisex") ? gender : [...gender, "unisex"];
}

export async function getCatalog(
  input: CatalogFilters = {},
): Promise<CatalogResult> {
  // Widened once, here, so the SQL path and the in-memory fallback below can
  // never drift on the rule.
  const filters: CatalogFilters = {
    ...input,
    gender: expandGenders(input.gender),
  };
  const { sort = "new", page = 1, perPage = DEFAULT_PER_PAGE } = filters;

  if (isSupabaseConfigured) {
    try {
      const data = await catalogSearch({
        p_terms: filters.search ? searchTerms(filters.search) : null,
        p_ids: orNull(filters.ids),
        p_brands: orNull(filters.brand),
        p_genders: orNull(filters.gender),
        p_families: orNull(filters.family),
        p_seasons: orNull(filters.season),
        p_tags: orNull(filters.tags),
        p_featured: filters.featured ? true : null,
        p_mls: orNull(filters.ml),
        p_min_price: filters.minPrice ?? null,
        p_max_price: filters.maxPrice ?? null,
        p_sort: sort,
        p_page: page,
        p_per_page: perPage,
      });
      return {
        items: data.map(fromCatalogRow),
        // `total` нь мөр болгонд давтагдаж ирдэг; илэрцгүй бол 0.
        total: data[0] ? Number(data[0].total) : 0,
        page,
        perPage,
      };
    } catch (err) {
      Sentry.captureException(err);
    }
  }

  return memoryCatalog(filters);
}

/**
 * Санах ойн зам — seed каталог (demo) ба RPC унасан үеийн нөөц. Дүрмүүд нь
 * `catalog_search()`-тэй нэг мөр байх ёстой.
 */
async function memoryCatalog(filters: CatalogFilters): Promise<CatalogResult> {
  const {
    brand,
    gender,
    family,
    season,
    tags,
    featured,
    ids,
    ml,
    minPrice,
    maxPrice,
    search,
    sort = "new",
    page = 1,
    perPage = DEFAULT_PER_PAGE,
  } = filters;

  const all = await fetchProducts();

  const idSet = ids?.length ? new Set(ids) : null;
  let items = all.filter((p) => {
    if (idSet && !idSet.has(p.id)) return false;
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
    if (featured && !p.isFeatured) return false;
    // "ml боломж" means sizes you can actually order right now.
    if (
      ml?.length &&
      !p.variants.some((v) => ml.includes(v.ml) && v.isActive && v.inStock)
    )
      return false;
    if (minPrice != null && p.startingPrice < minPrice) return false;
    if (maxPrice != null && p.startingPrice > maxPrice) return false;
    if (search) {
      // Free-form internal tags count as search text (A2 «Нэмэлт Tag») —
      // e.g. "оффис" surfaces every perfume the admin tagged so. Matching is
      // transliteration-aware, so "диор" finds Dior (lib/search.ts).
      const haystack = `${p.name} ${p.brand} ${p.customTags.join(" ")}`;
      if (!matchesSearch(haystack, search)) return false;
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
  return fetchProductBy("slug", slug);
}

export async function getProductById(
  id: string,
): Promise<ProductDetail | null> {
  return fetchProductBy("id", id);
}

export async function getProductsByIds(
  ids: string[],
): Promise<ProductListItem[]> {
  if (!ids.length) return [];
  const { items } = await getCatalog({ ids, perPage: ids.length });
  return items;
}

/**
 * Full detail shape (with variants) for several ids — used by bulk actions.
 * Зөвхөн асуусан мөрүүд ирнэ (өмнө нь бүх каталогийг уншиж шүүдэг байв).
 */
export async function getProductDetailsByIds(
  ids: string[],
): Promise<ProductDetail[]> {
  if (!ids.length) return [];
  if (!isSupabaseConfigured) {
    const set = new Set(ids);
    return SEED_PRODUCTS.filter((p) => set.has(p.id));
  }
  const supabase = createPublicClient();
  if (!supabase) return [];

  // `in()` нь GET-ийн URL дотор явдаг тул id бүр ~40 тэмдэгт нэмнэ; хэсэгчилж
  // зэрэг явуулбал урт хязгаарт мөргөхгүй бөгөөд нэг л удаагийн хүлээлт болно.
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    chunks.push(ids.slice(i, i + ID_CHUNK));
  }
  const results = await Promise.all(
    chunks.map((chunk) =>
      supabase
        .from("products")
        .select(SELECT)
        .in("id", chunk)
        .eq("is_active", true),
    ),
  );
  const rows = results.flatMap((r) =>
    r.error ? [] : ((r.data ?? []) as unknown as DbProduct[]),
  );
  if (!rows.length) return [];

  const products = rows.map(mapProduct);
  await attachCustomTags(supabase, products);
  return products;
}

/** Нэг `in()` шүүлтэд багтаах id-ийн тоо. */
const ID_CHUNK = 100;

/**
 * Related products, ranked by how many attributes they share with the current
 * one (requirement_fb.md: "аль болох олон таг нь таарсан уснууд байх").
 * Scent family and brand weigh heaviest; gender / season / concentration and
 * marketing tags break the ties.
 *
 * Оноо нь `related_products()` дотор SQL дээр бодогдоно (0059) — өмнө нь энэ
 * нь бүх каталогийг санах ойд ачаалж гүйдэг байсан бөгөөд дэлгэрэнгүй хуудсыг
 * дангаараа удаашруулж байв (backlog H2). RPC унасан үед доорх санах ойн зам
 * нөөцөд үлдэнэ — дүрэм нь SQL-тэй мөр мөрөөрөө ижил.
 */
export async function getRelated(
  slug: string,
  limit = 4,
): Promise<ProductListItem[]> {
  const supabase = createPublicClient();
  if (supabase) {
    const { data, error } = await callRpc<Omit<CatalogRow, "total">[]>(
      supabase,
      "related_products",
      { p_slug: slug, p_limit: limit },
    );
    if (!error && data) return data.map(fromCatalogRow);
    Sentry.captureException(
      new Error(`related_products failed: ${error?.message ?? "no rows"}`),
    );
  }
  return memoryRelated(slug, limit);
}

/** Санах ойн зам — seed каталог (demo) ба RPC унасан үеийн нөөц. */
async function memoryRelated(
  slug: string,
  limit: number,
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
    // Admin-curated custom tags (0044) describe use-case and character —
    // requirement_final.md §3: «аль болох олон таг нь таарсан уснууд».
    n +=
      2 *
      p.customTagSlugs.filter((t) => product!.customTagSlugs.includes(t))
        .length;
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

/**
 * «Онцлох» гэж тэмдэглэсэн бараа (backlog C2) — нүүрийн 'featured' төрлийн
 * хэсэг эндээс уншина. Хамгийн сүүлд нэмэгдсэн нь түрүүлж, дууссан нь хойно.
 */
export async function getFeaturedProducts(
  limit = 8,
): Promise<ProductListItem[]> {
  const { items } = await getCatalog({
    featured: true,
    sort: "featured",
    perPage: limit,
  });
  return items;
}

export async function getNewArrivals(limit = 8): Promise<ProductListItem[]> {
  const { items } = await getCatalog({ sort: "new", perPage: limit });
  return items;
}

/** Everything carrying a marketing tag, newest first (home rails, B7). */
export async function getProductsByTag(
  tag: TagKind,
  limit = 8,
): Promise<ProductListItem[]> {
  const { items } = await getCatalog({
    tags: [tag],
    sort: "new",
    perPage: limit,
  });
  return items;
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
      // Зөвхөн эрэмбэлэгдсэн id-уудыг уншиж, борлуулалтын дарааллаар нь
      // эргүүлэн засна (SQL нь id-ийн дарааллыг хадгалахгүй).
      const found = await getProductsByIds(ranked.map((r) => r.product_id));
      const byId = new Map(found.map((p) => [p.id, p]));
      const items = ranked
        .map((r) => byId.get(r.product_id))
        .filter((p): p is ProductListItem => Boolean(p))
        .slice(0, limit);
      if (items.length > 0) return items;
    }
  }
  return getProductsByTag("hot", limit);
}

export async function getOnSale(limit = 8): Promise<ProductListItem[]> {
  return getProductsByTag("sale", limit);
}

/**
 * Каталогийн шүүлтийн хажуугийн утгууд — бараатай брэндүүд ба үнийн муж.
 *
 * Хоёулаа нэг SQL дуудлагаас гарна (`catalog_facets()`), request-д нэг удаа
 * (React `cache`). Өмнө нь тус тусдаа бүх каталогийг ачаалж боддог байв.
 */
/**
 * Brand list and price bounds don't depend on the filters, yet the catalog
 * re-rendered them on every chip click — four extra database round trips per
 * filter change, which is most of the wait on a deployment that isn't next to
 * its database. `cache()` alone only dedupes within one request, so the result
 * is held across requests too and purged by tag on admin writes.
 */
const fetchFacetsUncached = async (): Promise<{
  brands: string[];
  min: number;
  max: number;
}> => {
  const supabase = createPublicClient();
  if (supabase) {
    const { data, error } = await callRpc<
      { brands: string[]; min_price: number; max_price: number }[]
    >(supabase, "catalog_facets", {});
    const row = data?.[0];
    if (!error && row) {
      return {
        brands: row.brands ?? [],
        min: row.min_price ?? 0,
        max: row.max_price ?? 0,
      };
    }
  }
  const all = await fetchProducts();
  const prices = all.map((p) => p.startingPrice).filter((n) => n > 0);
  return {
    brands: [...new Set(all.map((p) => p.brand))].sort(),
    min: prices.length ? Math.min(...prices) : 0,
    max: prices.length ? Math.max(...prices) : 0,
  };
};

const fetchFacets = cache(
  unstable_cache(fetchFacetsUncached, ["catalog-facets"], {
    revalidate: 300,
    tags: [CACHE_TAG_CATALOG],
  }),
);

export async function getBrands(): Promise<string[]> {
  return (await fetchFacets()).brands;
}

/** Lowest and highest starting price across the catalogue (for the price slider). */
export async function getPriceBounds(): Promise<{ min: number; max: number }> {
  const { min, max } = await fetchFacets();
  return { min, max };
}

/** Full product list (detail shape) — used by admin server pages. */
export async function getAllProducts(): Promise<ProductDetail[]> {
  return fetchProducts();
}
