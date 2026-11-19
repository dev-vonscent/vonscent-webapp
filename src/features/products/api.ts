import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { CACHE_TAG_CATALOG, CACHE_TAG_STOCK } from "@/lib/cache-tags";
import { BOTTLE_IMAGE_URL_RE, NEW_PRODUCTS_COUNT } from "@/lib/constants";
import type {
  CatalogFilters,
  CatalogResult,
  ProductDetail,
  ProductListItem,
} from "@/lib/types";
import type { ScentFamily, Season, TagKind } from "@/db/types";
import { SEED_COMING_SOON, SEED_PRODUCTS } from "./seed";
import { isSupabaseConfigured } from "@/lib/env";
import { matchesSearch, searchTerms } from "@/lib/search";
import { callRpc } from "@/lib/supabase/rpc";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPublicClient } from "@/lib/supabase/public";
import { variantAvailability } from "./sellable";
import {
  getBottleLocks,
  isBottleLocked,
  NO_BOTTLE_LOCKS,
  type BottleLockState,
} from "./bottle-stock";
import {
  cardSalePrice,
  earliestEnd,
  effectivePrice,
  type CardSalePrice,
  saleEndsAt,
  summarizeSale,
  type SaleSummary,
} from "./sale";
import { getLiveSaleEvents } from "@/features/sale-events/api";
import { matchesTagGroup } from "./tag-group";
import { isFeatureEnabled } from "@/lib/feature-flags";

/**
 * Product data access (development.md §3 — features domain api).
 *
 * Reads live data from Supabase. When Supabase isn't configured it falls back
 * to the seed catalogue so the project still runs in demo mode.
 *
 * Supabase тохируулагдсан үед уншилтын алдааг ШИДНЭ — хоосон жагсаалт, `null`,
 * seed/санах ойн зам руу шилжихгүй. Эдгээр нь ISR хуудсанд (3600с) болон
 * `unstable_cache`-д «зөв» хариу мэт хадгалагдаж, түр зуурын DB алдаа нэг цагийн
 * турш хоосон каталог / 404 болж харагдана. Шидвэл Next нь кэшлэхгүй, ISR өмнөх
 * зөв хуудсаа үлдээнэ. Санах ойн зам зөвхөн DEMO горимд (env хоосон).
 */

// ── DB row shapes (supabase client is untyped here; we map explicitly) ──────
interface DbVariant {
  id: string;
  ml: number;
  /** Үндсэн үнэ. */
  price: number;
  /** Хямдарсан үнэ, эсвэл null (0054). */
  sale_price: number | null;
  /** Хямдралын хугацаа (0166) — null бол тэр талдаа хязгааргүй. */
  sale_starts_at: string | null;
  sale_ends_at: string | null;
  is_active: boolean;
  /**
   * SQL-ийн бодсон бодит үнэ — `variant_price()` computed column (0181).
   * Гар хямдрал (0166) ба арга хэмжээ (0181) хоёуланг агуулна. TS тал үнийг
   * ДАХИН бодохгүй (plan §5.2): энэ нь багцын мөнгөний зам. Байхгүй бол
   * (demo seed, хуучин fixture) `effectivePrice` нөөц.
   */
  variant_price?: number | null;
  /**
   * Одоогийн үнийг тогтоож буй арга хэмжээний нэр — `variant_sale_label()`
   * computed column (0189). Гар хямдрал эсвэл хямдралгүй бол null.
   */
  variant_sale_label?: string | null;
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
export interface DbProduct {
  id: string;
  slug: string;
  name: string;
  brand: string;
  description: string;
  notes_description: string | null;
  usage_description: string | null;
  notes_top: string[];
  notes_heart: string[];
  notes_base: string[];
  gender: ProductDetail["gender"];
  concentration: ProductDetail["concentration"];
  sillage: ProductDetail["sillage"] | null;
  longevity: string | null;
  scent_families: ScentFamily[] | null;
  seasons: Season[] | null;
  origin_country: string | null;
  release_year: number | null;
  bottle_ml: number;
  rating_avg: number;
  rating_count: number;
  is_featured: boolean | null;
  created_at: string;
  /** Анх худалдаанд гарсан мөч (0125); «Тун удахгүй» бараанд null. */
  launched_at: string | null;
  /** 0125 — `getProductPageBySlug` зэрэг нь «Тун удахгүй»-г ч уншина. */
  status: "hidden" | "coming_soon" | "active";
  coming_soon_note: string | null;
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
  description, notes_description, usage_description,
  notes_top, notes_heart, notes_base,
  gender, concentration, sillage, longevity, scent_families, seasons,
  origin_country, release_year, bottle_ml,
  rating_avg, rating_count, is_featured, created_at, launched_at,
  status, coming_soon_note,
  product_images ( url, alt, sort_order, is_visible ),
  product_variants ( id, ml, price, sale_price, sale_starts_at, sale_ends_at, is_active, variant_price, variant_sale_label ),
  inventory ( on_hand_ml, reserved_ml, is_sold_out ),
  product_tags ( tags ( slug, kind ) )
`;

/**
 * Бодит үнэ: SQL-ийн `variant_price` (гар хямдрал + арга хэмжээ, 0181), эс
 * бөгөөс гар хямдралын толь (`effectivePrice`) — demo seed ба хуучин тестийн
 * fixture-д. Үндсэн үнээс давахгүй.
 */
function variantPrice(
  v: Pick<
    DbVariant,
    "price" | "sale_price" | "sale_starts_at" | "sale_ends_at" | "variant_price"
  >,
): number {
  return typeof v.variant_price === "number"
    ? Math.min(v.variant_price, v.price)
    : effectivePrice(v);
}

/** DB мөр → дэлгүүрийн хэлбэр. Тестэд export хийсэн (map-product.test.ts). */
export function mapProduct(
  row: DbProduct,
  locks: BottleLockState = NO_BOTTLE_LOCKS,
): ProductDetail {
  // The gallery holds every picture the admin has for this product; only the
  // ones they ticked reach the shop (0049).
  const images = [...row.product_images]
    .filter((i) => i.is_visible !== false)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((i) => ({
      url: i.url,
      alt: i.alt ?? row.name,
      contain: BOTTLE_IMAGE_URL_RE.test(i.url),
    }));

  const inv = Array.isArray(row.inventory) ? row.inventory[0] : row.inventory;
  const availableMl = inv ? inv.on_hand_ml - inv.reserved_ml : 0;
  // «Тун удахгүй» (0125): үнэ, хэмжээ харагдах ч НЭГ Ч хэмжээ зарагдахгүй.
  // Ус агуулахад ирсэн ч админ гаргаагүй байж болно — үлдэгдлээс үл хамааран
  // хаана. Ингэснээр энэ төлөвийг мэдэхгүй уншигч (сагс, хурдан нэмэх) ч
  // зарагдахгүй бараа гэж үзнэ; харуулах газрууд нь `comingSoon`-оор ялгана.
  const comingSoon = row.status === "coming_soon";

  // A size is buyable only when the admin left it active, the colour of bottle
  // it needs is in stock (0095) AND the remaining source ml can still fill it
  // (requirement_fb.md: a sold-out 20ml turns itself off while 5ml keeps
  // selling). Энэ нь `variant_sellable()` (SQL)-ийн толь — хоёулаа зэрэг
  // өөрчлөгдөх ёстой.
  const variants = [...row.product_variants]
    .sort((a, b) => a.ml - b.ml)
    .map((v) => {
      // Админ энэ бараа/хэмжээг гараар чөлөөлсөн бол түгжээ үйлчлэхгүй —
      // өөр өнгийн саванд цутгахыг зөвшөөрсөн гэсэн үг.
      const bottleLocked = isBottleLocked(locks, row.gender, v.ml, v.id);
      const isActive = v.is_active;
      const inStock = !comingSoon && !inv?.is_sold_out && availableMl >= v.ml;
      return {
        id: v.id,
        ml: v.ml,
        // БОДИТООР төлөх дүн (0054). Сагс, захиалга, багц, тайлан бүгд
        // `price`-аар явдаг тул хямдрал энэ нэг мөрөөр бүх урсгалд хүчин
        // төгөлдөр болно; үндсэн үнэ нь зөвхөн зураастай харагдана.
        price: variantPrice(v),
        basePrice: v.price,
        // Задаргааны мөрийн нэр (0189). Хямдралгүй бол утгагүй.
        saleLabel:
          variantPrice(v) < v.price ? (v.variant_sale_label ?? null) : null,
        isActive,
        inStock,
        bottleLocked,
        ...variantAvailability({ isActive, inStock, bottleLocked }),
      };
    });

  // "From" price quotes the cheapest size a customer can actually buy today.
  const sellable = variants.filter((v) => v.sellable);
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
    // 0078-оос өмнөх сан дээр багана байхгүй байж болно — тэр үед 'medium'.
    sillage: row.sillage ?? "medium",
    // 0083-аас өмнөх сан дээр багана байхгүй — тэр үед хоосон (мөр гарахгүй).
    longevity: row.longevity?.trim() ?? "",
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
    // «Шинэ» эрэмбийн огноо = худалдаанд гарсан мөч (0125) — `catalog_items`-
    // ийн `created_at`-тай ижил дүрэм. Урьдчилан оруулсан ус гарахдаа
    // жагсаалтын эхэнд орно.
    createdAt: row.launched_at ?? row.created_at,
    description: row.description,
    notesDescription: row.notes_description ?? "",
    usageDescription: row.usage_description ?? "",
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
    comingSoon,
    comingSoonNote: comingSoon ? row.coming_soon_note : null,
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

  if (error) throw new Error(`products failed: ${error.message}`);
  const locks = await getBottleLocks();
  const products = ((data ?? []) as unknown as DbProduct[]).map((r) =>
    mapProduct(r, locks),
  );
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
    /**
     * «Тун удахгүй» барааг ч буцаах уу (0125). Зөвхөн ХАРУУЛАХ газар
     * (барааны хуудас, OG зураг) — захиалга, сагс энэ сонголтгүй дуудна.
     */
    includeComingSoon = false,
  ): Promise<ProductDetail | null> => {
    if (!isSupabaseConfigured) {
      const pool = includeComingSoon
        ? [...SEED_PRODUCTS, ...SEED_COMING_SOON]
        : SEED_PRODUCTS;
      return pool.find((p) => p[column] === value) ?? null;
    }
    const supabase = createPublicClient();
    if (!supabase) return null;

    const base = supabase.from("products").select(SELECT).eq(column, value);
    const { data, error } = await (
      includeComingSoon
        ? base.in("status", ["active", "coming_soon"])
        : base.eq("is_active", true)
    ).maybeSingle();
    // Алдаа ≠ «байхгүй»: null нь хуудсанд notFound() болж 404 кэшлэгдэнэ.
    if (error) throw new Error(`product by ${column} failed: ${error.message}`);
    if (!data) return null;

    const row = data as unknown as DbProduct;
    const product = mapProduct(row, await getBottleLocks());
    await Promise.all([
      attachCustomTags(supabase, [product]),
      attachSaleEnds(product, row.product_variants),
    ]);
    return product;
  },
);

/**
 * Барааны дэлгэрэнгүй (task 2.6): хэмжээ бүрийн хямдрал дуусах мөч —
 * сонгосон хэмжээний тоолуур. Дүрэм нь каталогийн картынхтай ижил
 * (`saleEndsAt`: арга хэмжээ давамгайлна, дууссан/эхлээгүй `sale_price`
 * хэзээ ч эх үүсвэр биш). Зөвхөн сангийн ISO мөч — `Date.now()`-оос
 * хамаарсан текст биш тул ISR HTML тогтмол. Туг `sale_display` хаалттай
 * бол юу ч нэмэхгүй (HTML-д огт орохгүй). Алдааг шиднэ (#284).
 */
async function attachSaleEnds(
  product: ProductDetail,
  rows: readonly DbVariant[],
): Promise<void> {
  if (!product.variants.some((v) => v.price < v.basePrice)) return;
  if (!(await isFeatureEnabled("sale_display"))) return;
  const events = await getLiveSaleEvents();
  const eventEnd = earliestEnd(
    events
      .filter((e) => e.productIds.includes(product.id))
      .map((e) => e.endsAt),
  );
  const now = new Date();
  const byId = new Map(rows.map((r) => [r.id, r]));
  product.variants = product.variants.map((v) => {
    const r = byId.get(v.id);
    return r ? { ...v, saleEndsAt: saleEndsAt(r, eventEnd, now) ?? null } : v;
  });
}

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
    ...(p.comingSoon && { comingSoon: true }),
    ...saleOf(p),
  };
}

/**
 * Санах ойн зам (DEMO): хувийг хэмжээнүүдээс шууд. Дуусах мөч seed-д
 * хэрэггүй — тоолуур гарахгүй.
 */
function saleOf(p: ProductDetail): {
  sale?: SaleSummary;
  cardPrice?: CardSalePrice;
} {
  if (!p.tags.includes("sale")) return {};
  const sale = summarizeSale(
    p.variants
      .filter((v) => v.isActive)
      .map((v) => ({ basePrice: v.basePrice, price: v.price })),
  );
  if (!sale) return {};
  const card = cardSalePrice(p.variants);
  return card ? { sale, cardPrice: card } : { sale };
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
    case "discount":
      // `catalog_search`-ийн толь (0193): хамгийн их хувь, дараа нь шинэ нь.
      return copy.sort(
        (a, b) =>
          (saleOf(b).sale?.maxPct ?? 0) - (saleOf(a).sale?.maxPct ?? 0) ||
          b.createdAt.localeCompare(a.createdAt),
      );
    case "popular":
      // Борлуулалтын тоо энд байхгүй (SQL нь `top_seller_products()`-оор
      // эрэмбэлнэ, 0115) — борлуулалтаар тавигддаг `hot` таг нь хамгийн ойр.
      return copy.sort(
        (a, b) =>
          Number(b.tags.includes("hot")) - Number(a.tags.includes("hot")) ||
          b.createdAt.localeCompare(a.createdAt),
      );
    case "recommended": {
      // `catalog_search()` (0115)-ийн толь: дууссан нь ард, дараа нь
      // Эрэлттэй → Шинэ → Онцлох → бусад, бүлэг дотроо нэрээр (SQL дээр
      // Эрэлттэй нь борлуулалтаар).
      const tier = (p: ProductDetail) =>
        p.tags.includes("hot")
          ? 0
          : p.tags.includes("new")
            ? 1
            : p.isFeatured
              ? 2
              : 3;
      return copy.sort(
        (a, b) =>
          Number(a.soldOut) - Number(b.soldOut) ||
          tier(a) - tier(b) ||
          a.name.localeCompare(b.name),
      );
    }
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
 * doesn't pin an empty catalogue in place for the whole cache window.
 */
/**
 * `CACHE_TAG_CATALOG`-тай кэшүүдийн хугацаа (сек). Үнэ, үлдэгдэл агуулдаг ч
 * хугацаа дуусахыг хүлээдэггүй: админы бичилт (revalidatePublic), захиалга
 * (revalidateStock), хямдралын хил (`/api/cron/midnight-revalidate`) tag-аар
 * шууд цэвэрлэнэ. Нүүр эдгээрийг уншдаг тул энэ хугацаа нүүрний ISR-ийн дээд
 * хязгаар болно — 60 байвал нүүр 1 минут тутам дахин бичигдэнэ.
 */
const CATALOG_REVALIDATE = 3600;

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
  {
    revalidate: CATALOG_REVALIDATE,
    tags: [CACHE_TAG_CATALOG, CACHE_TAG_STOCK],
  },
);

// ── Хямдралын товч: картын хувь, тоолуур (task 2.2, 2.4) ──────────────────

type SaleVariantRow = Pick<
  DbVariant,
  | "id"
  | "ml"
  | "price"
  | "sale_price"
  | "sale_starts_at"
  | "sale_ends_at"
  | "is_active"
  | "variant_price"
  | "variant_sale_label"
>;

/**
 * `sale` тагтай (гар хямдрал эсвэл арга хэмжээ — `variant_sale_active`, 0181)
 * идэвхтэй барааны хэмжээнүүд. Нэг query, бүх хямдралтай бараанд нэг кэш —
 * каталогийн хуудас бүрт дахин асуухгүй.
 *
 * Tag: `catalog` — хямдрал бичих (админ) → `revalidatePublic()`, хугацааны
 * хил (УБ 00:00) → `/api/cron/midnight-revalidate` (гар хямдралд
 * `revalidateStock()` — scope-гүй тул `catalog`-ийг ч цэвэрлэнэ, арга
 * хэмжээнд `revalidatePublic()`). `stock` — картын үнийн хэмжээ (2.5) аль
 * хэмжээ зарагдахаас хамаарна; `catalog_search` ч мөн адил хоёр tag-тай.
 * Алдааг шиднэ — хоосон кэшлэгдэхгүй (#284).
 */
interface SaleRow {
  id: string;
  gender: ProductListItem["gender"];
  inventory: DbInventory | DbInventory[] | null;
  variants: SaleVariantRow[];
}
const fetchSaleRows = unstable_cache(
  async (): Promise<SaleRow[]> => {
    const supabase = createPublicClient();
    if (!supabase) throw new Error("sale rows: no supabase client");
    const { data, error } = await supabase
      .from("products")
      .select(
        "id, gender, inventory ( on_hand_ml, reserved_ml, is_sold_out ), product_variants ( id, ml, price, sale_price, sale_starts_at, sale_ends_at, is_active, variant_price, variant_sale_label ), product_tags!inner ( tags!inner ( kind ) )",
      )
      .eq("is_active", true)
      .eq("product_tags.tags.kind", "sale");
    if (error) throw new Error(`sale rows failed: ${error.message}`);
    return (
      (data as unknown as
        | (Omit<SaleRow, "variants"> & { product_variants: SaleVariantRow[] })[]
        | null) ?? []
    ).map((r) => ({
      id: r.id,
      gender: r.gender,
      inventory: r.inventory,
      variants: r.product_variants ?? [],
    }));
  },
  ["sale-rows-v2"],
  {
    revalidate: CATALOG_REVALIDATE,
    tags: [CACHE_TAG_CATALOG, CACHE_TAG_STOCK],
  },
);

/**
 * Картын үнийн хэмжээ (2.5) — `mapProduct`-ийн зарагдах дүрмээр (идэвхтэй,
 * сав түгжээгүй, эх савны ml хүрэлцэнэ).
 */
function saleRowCardPrice(row: SaleRow, locks: BottleLockState) {
  const inv = Array.isArray(row.inventory) ? row.inventory[0] : row.inventory;
  const availableMl = inv ? inv.on_hand_ml - inv.reserved_ml : 0;
  return cardSalePrice(
    row.variants.map((v) => ({
      ml: v.ml,
      price: variantPrice(v),
      basePrice: v.price,
      sellable:
        v.is_active &&
        !inv?.is_sold_out &&
        availableMl >= v.ml &&
        !isBottleLocked(locks, row.gender, v.ml, v.id),
    })),
  );
}

/**
 * productId → хямдралын товч. Хувь нь идэвхтэй хэмжээнүүдийн `variant_price`-
 * аас (`summarizeSale`), дуусах мөч нь хэмжээ бүрийн одоогийн хямдралын эх
 * үүсвэрээс (`saleEndsAt`) хамгийн ойр нь. Дуусах мөч зөвхөн туг
 * `sale_display` нээлттэй үед — хаалттай бол HTML-д огт орохгүй.
 *
 * Гаралт нь зөвхөн сангийн утгаас (ISO огноо, хувь) — `Date.now()`-оос
 * хамаарсан текст биш тул ISR-ийн дахин үүсгэлт бүрт HTML өөрчлөгдөхгүй.
 */
export const getSaleSummaries = cache(
  async (): Promise<ReadonlyMap<string, SaleSummary>> => {
    const out = new Map<string, SaleSummary>();
    if (!isSupabaseConfigured) return out;
    const [rows, events, showEnds, locks] = await Promise.all([
      fetchSaleRows(),
      getLiveSaleEvents(),
      isFeatureEnabled("sale_display"),
      getBottleLocks(),
    ]);
    // Бараа давхцсан хоёр LIVE арга хэмжээнд орохгүй (0181 trigger) — ойрыг нь.
    const eventEnds = new Map<string, string>();
    for (const e of events) {
      for (const id of e.productIds) {
        eventEnds.set(id, earliestEnd([eventEnds.get(id), e.endsAt]) as string);
      }
    }
    const now = new Date();
    for (const row of rows) {
      const active = row.variants.filter((v) => v.is_active);
      const summary = summarizeSale(
        active.map((v) => ({ basePrice: v.price, price: variantPrice(v) })),
      );
      if (!summary) continue;
      const card = saleRowCardPrice(row, locks);
      const base = card ? { ...summary, card } : summary;
      out.set(
        row.id,
        showEnds
          ? {
              ...base,
              // Өнгөрсөн мөч (хоцорсон кэш) алгасагдана — «ойр» болохгүй.
              endsAt: earliestEnd(
                active.map((v) =>
                  saleEndsAt(v, eventEnds.get(row.id) ?? null, now),
                ),
                now.getTime(),
              ),
            }
          : base,
      );
    }
    return out;
  },
);

/**
 * `sale` тагтай мөрүүдэд товчийг наана; тийм мөр байхгүй бол асуухгүй.
 * Каталогоос гадна quiz-ийн үр дүн (`/api/quiz`) ч ашиглана — картын
 * хямдралын тууз (`endsAt`), хэмжээтэй үнэ (`cardPrice`) тэнд ч гарна.
 */
export async function withSale<T extends ProductListItem>(
  items: T[],
): Promise<T[]> {
  if (!items.some((p) => p.tags.includes("sale"))) return items;
  const sales = await getSaleSummaries();
  return items.map((p) => {
    const found = p.tags.includes("sale") ? sales.get(p.id) : undefined;
    if (!found) return p;
    // Картын үнийн хэмжээ (2.5) нь тусдаа талбар — товчоос салгана.
    const { card, ...sale } = found;
    return card ? { ...p, sale, cardPrice: card } : { ...p, sale };
  });
}

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
  // «Төрөл: Багц» — ус огт гарахгүй; багцуудыг каталог хуудас өөрөө
  // `getCatalogCollections`-оор авна.
  if (filters.kind === "bundle") return { items: [], total: 0, page, perPage };

  if (isSupabaseConfigured) {
    // Алдаа шидэгдэнэ (дээрх тайлбар): санах ойн зам руу бүү шилж.
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
      // 0181-ээс өмнөх сан дээр параметр байхгүй — зөвхөн хэрэгтэй үед.
      ...(filters.event ? { p_event: filters.event } : {}),
    });
    return {
      items: await withSale(data.map(fromCatalogRow)),
      // `total` нь мөр болгонд давтагдаж ирдэг; илэрцгүй бол 0.
      total: data[0] ? Number(data[0].total) : 0,
      page,
      perPage,
    };
  }

  return memoryCatalog(filters);
}

/**
 * Санах ойн зам — зөвхөн seed каталог (DEMO горим). Дүрмүүд нь
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
    event,
  } = filters;

  const all = await fetchProducts();

  const idSet = ids?.length ? new Set(ids) : null;
  // Арга хэмжээ (0181): LIVE гишүүд — `catalog_search`-ийн `p_event`-тэй ижил.
  const eventIds = event
    ? new Set(
        (await getLiveSaleEvents()).find((e) => e.slug === event)?.productIds ??
          [],
      )
    : null;
  let items = all.filter((p) => {
    if (idSet && !idSet.has(p.id)) return false;
    // «Таг» бүлэг (арга хэмжээ, Онцлох, таг) — дотроо OR (0194).
    if (
      !matchesTagGroup(
        { tags, featured, event },
        {
          tag: (t) => p.tags.includes(t),
          featured: p.isFeatured,
          event: () => eventIds?.has(p.id) ?? false,
        },
      )
    )
      return false;
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

/** Зарагдаж буй бараа — сагс, хурдан нэмэх зэрэг худалдан авах урсгалд. */
export async function getProductBySlug(
  slug: string,
): Promise<ProductDetail | null> {
  return fetchProductBy("slug", slug);
}

/**
 * Барааны хуудас: зарагдаж буй эсвэл «Тун удахгүй» (0125) бараа. Сүүлийнх нь
 * `comingSoon: true` бөгөөд нэг ч хэмжээ нь `sellable` биш.
 */
export async function getProductPageBySlug(
  slug: string,
): Promise<ProductDetail | null> {
  return fetchProductBy("slug", slug, true);
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
  {
    includeComingSoon = false,
    strict = true,
  }: {
    /** Хүслийн жагсаалт л (0125) — сагс, багц, захиалга энэ сонголтгүй. */
    includeComingSoon?: boolean;
    /**
     * Хэсэг (chunk) бүтэлгүйтвэл ШИДНЭ (өгөгдмөл — багцын гишүүд ISR-д
     * дутуу кэшлэгдэхгүй). Сагс хариунд ирээгүй мөрийг
     * «хаагдсан» гэж үздэг тул DB-ийн алдаа «бүх бараа алга» болж харагдах
     * ёсгүй (`/api/products`).
     */
    strict?: boolean;
  } = {},
): Promise<ProductDetail[]> {
  if (!ids.length) return [];
  if (!isSupabaseConfigured) {
    const set = new Set(ids);
    const pool = includeComingSoon
      ? [...SEED_PRODUCTS, ...SEED_COMING_SOON]
      : SEED_PRODUCTS;
    return pool.filter((p) => set.has(p.id));
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
    chunks.map((chunk) => {
      const base = supabase.from("products").select(SELECT).in("id", chunk);
      return includeComingSoon
        ? base.in("status", ["active", "coming_soon"])
        : base.eq("is_active", true);
    }),
  );
  if (strict) {
    const failed = results.find((r) => r.error);
    if (failed) throw new Error(`product details: ${failed.error!.message}`);
  }
  const rows = results.flatMap((r) =>
    r.error ? [] : ((r.data ?? []) as unknown as DbProduct[]),
  );
  if (!rows.length) return [];

  const locks = await getBottleLocks();
  const products = rows.map((r) => mapProduct(r, locks));
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
 * дангаараа удаашруулж байв (backlog H2). Доорх санах ойн зам зөвхөн DEMO
 * горимд — дүрэм нь SQL-тэй мөр мөрөөрөө ижил. RPC унавал шидэнэ.
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
    if (error) throw new Error(`related_products failed: ${error.message}`);
    return (data ?? []).map(fromCatalogRow);
  }
  return memoryRelated(slug, limit);
}

/** Санах ойн зам — зөвхөн seed каталог (DEMO горим). */
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
 * «Тун удахгүй» ус (0125) — нүүрний ижил нэртэй хэсэг. Хамгийн сүүлд
 * оруулсан нь түрүүлнэ. Каталогийн RPC-үүд эдгээрийг санаатай алгасдаг
 * (`catalog_items` нь `is_active`-аар шүүнэ) тул тусдаа уншина.
 */
const fetchComingSoon = unstable_cache(
  async (limit: number): Promise<ProductListItem[]> => {
    const supabase = createPublicClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("products")
      .select(SELECT)
      .eq("status", "coming_soon")
      .order("created_at", { ascending: false })
      .limit(limit);
    // Шидэх нь санаатай: алдааг кэшлэхгүй (catalogSearch-тэй ижил).
    if (error) throw new Error(`coming soon failed: ${error.message}`);
    return ((data ?? []) as unknown as DbProduct[]).map((r) =>
      toListItem(mapProduct(r)),
    );
  },
  ["coming-soon"],
  { revalidate: CATALOG_REVALIDATE, tags: [CACHE_TAG_CATALOG] },
);

export async function getComingSoonProducts(
  limit = 12,
): Promise<ProductListItem[]> {
  if (!isSupabaseConfigured) {
    return SEED_COMING_SOON.slice(0, limit).map(toListItem);
  }
  // Шидэнэ: `[]` буцаавал хэсэггүй нүүр нэг цагийн турш ISR-д үлдэнэ.
  return fetchComingSoon(limit);
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

/**
 * «Шинэ» тагтай ус, шинэ нь түрүүлж. Энэ нь каталогийн «Шинэ» chip-тэй ижил
 * багц (хамгийн сүүлийн NEW_PRODUCTS_COUNT ус, 0100_auto_new_tag.sql).
 */
export async function getNewArrivals(
  limit = NEW_PRODUCTS_COUNT,
): Promise<ProductListItem[]> {
  const { items } = await getCatalog({
    tags: ["new"],
    sort: "new",
    perPage: limit,
  });
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
 * definer), in sales order. The catalog's «Эрэлттэй» chip filters the `hot`
 * tag, which the DB keeps on the same top sellers (0101_auto_hot_tag), so the
 * rail and the chip show the same products.
 */
export async function getBestSellers(limit = 8): Promise<ProductListItem[]> {
  const supabase = createPublicClient();
  if (supabase) {
    const { data, error } = await supabase.rpc("top_seller_products", {
      p_limit: limit * 3,
    });
    if (error) throw new Error(`top_seller_products failed: ${error.message}`);
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
  // Борлуулалт хараахан байхгүй (эсвэл DEMO) — `hot` таг ижил багцыг заана.
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
    // `unstable_cache` дотор: шидэхгүй бол хоосон брэнд / 0₮ муж кэшлэгдэнэ.
    if (error) throw new Error(`catalog_facets failed: ${error.message}`);
    const row = data?.[0];
    return {
      brands: row?.brands ?? [],
      min: row?.min_price ?? 0,
      max: row?.max_price ?? 0,
    };
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
    revalidate: CATALOG_REVALIDATE,
    tags: [CACHE_TAG_CATALOG, CACHE_TAG_STOCK],
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
