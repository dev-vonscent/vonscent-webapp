import "server-only";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { createPublicClient } from "@/lib/supabase/public";
import { callRpc } from "@/lib/supabase/rpc";
import type { CatalogFilters } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { getCatalog, getProductDetailsByIds } from "@/features/products/api";
import { memberPrices, discountRange } from "./pricing";
import { DEFAULT_COLLECTION_SETTINGS } from "./types";
import type {
  BuilderProduct,
  Collection,
  CollectionMember,
  CollectionSettings,
} from "./types";
import type { ProductDetail } from "@/lib/types";
import type { Gender, TagKind } from "@/db/types";

/**
 * Collection data access. Reads `collections` + `collection_items` from
 * Supabase and resolves each member to its live product (price + stock) via the
 * cached product fetch, then prices the bundle per ml. Collections are DB-only,
 * so demo mode (no Supabase) returns empty lists.
 */

interface DbCollection {
  id: string;
  slug: string;
  type: "base" | "custom";
  user_id: string | null;
  name: string;
  gender: Gender;
  description: string | null;
  discount_pct: number | string;
  image_url: string | null;
  is_active: boolean;
  is_featured: boolean;
  collection_items: { product_id: string; sort_order: number }[];
  collection_ml_discounts?: {
    ml: number;
    discount_pct: number | string | null;
    price: number | null;
  }[];
  collection_tags?: { tags: { kind: TagKind } | null }[];
}

const SELECT = `
  id, slug, type, user_id, name, gender, description,
  discount_pct, image_url, is_active, is_featured,
  collection_items ( product_id, sort_order ),
  collection_ml_discounts ( ml, discount_pct, price ),
  collection_tags ( tags ( kind ) )
`;

/** Per-size overrides as a plain ml → % map (0051). */
function toMlDiscounts(row: DbCollection): Record<number, number> {
  const out: Record<number, number> = {};
  for (const d of row.collection_ml_discounts ?? []) {
    if (d.discount_pct != null) out[d.ml] = Number(d.discount_pct);
  }
  return out;
}

/** Хэмжээ бүрийн тогтмол үнэ (0054) — байгаа мөр нь хувийг гүйцээж дарна. */
function toMlPrices(row: DbCollection): Record<number, number> {
  const out: Record<number, number> = {};
  for (const d of row.collection_ml_discounts ?? []) {
    if (d.price != null) out[d.ml] = Number(d.price);
  }
  return out;
}

export const getCollectionSettings = cache(
  async (): Promise<CollectionSettings> => {
    if (!isSupabaseConfigured) return DEFAULT_COLLECTION_SETTINGS;
    const supabase = createPublicClient();
    if (!supabase) return DEFAULT_COLLECTION_SETTINGS;
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "collection")
      .maybeSingle();
    return {
      ...DEFAULT_COLLECTION_SETTINGS,
      ...((data?.value as Partial<CollectionSettings>) ?? {}),
    };
  },
);

function toMember(p: ProductDetail): CollectionMember {
  const variantByMl: CollectionMember["variantByMl"] = {};
  for (const v of p.variants) {
    if (v.isActive) {
      variantByMl[v.ml] = {
        variantId: v.id,
        price: v.price,
        inStock: v.inStock,
      };
    }
  }
  return {
    productId: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    image: p.image,
    variantByMl,
  };
}

function build(
  row: DbCollection,
  productById: Map<string, ProductDetail>,
  settings: CollectionSettings,
): Collection {
  const items = [...row.collection_items].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  const members = items
    .map((it) => productById.get(it.product_id))
    .filter((p): p is ProductDetail => Boolean(p))
    .map(toMember);

  // A member the admin hid / deleted drops out of the active product set, so a
  // short roster means the bundle can't be sold (§9).
  const complete = members.length === items.length && members.length > 0;
  const discountPct = Number(row.discount_pct);
  const mlDiscounts = toMlDiscounts(row);
  const mlPrices = toMlPrices(row);
  const prices = memberPrices(
    members,
    discountPct,
    settings.roundTo,
    mlDiscounts,
    mlPrices,
  );
  const availableMls = complete
    ? prices.filter((p) => p.available).map((p) => p.ml)
    : [];
  const sellable = prices.filter((p) => availableMls.includes(p.ml));
  const startingPrice = sellable.length
    ? Math.min(...sellable.map((p) => p.price))
    : 0;

  return {
    id: row.id,
    slug: row.slug,
    type: row.type,
    name: row.name,
    gender: row.gender,
    description: row.description ?? "",
    discountPct,
    mlDiscounts,
    mlPrices,
    discountRange: discountRange(prices, availableMls),
    tags: (row.collection_tags ?? [])
      .map((t) => t.tags?.kind)
      .filter((k): k is TagKind => Boolean(k)),
    image: row.image_url ?? members[0]?.image?.url ?? null,
    isActive: row.is_active,
    isFeatured: row.is_featured,
    members,
    prices,
    availableMls,
    startingPrice,
    soldOut: availableMls.length === 0,
  };
}

/** All active base collections, resolved with live member data. */

/**
 * Багцын гишүүдийг ЗӨВХӨН тэдгээрийн id-гаар уншина.
 *
 * Өмнө нь энэ гурван дуудагч бүгд `fetchProducts()`-оор БҮХ идэвхтэй барааг
 * (зураг, хэмжээ, үлдэгдэл, таг) татаж аваад дундаас нь 3–5 гишүүнээ олдог
 * байв — хэрэглэгчийн «Миний багцууд» хуудсыг дангаараа хамгийн удаан хуудас
 * болгож байсан шалтгаан. Одоо зөвхөн хэрэгтэй мөрүүд ирнэ.
 */
async function membersById(
  rows: DbCollection[],
): Promise<Map<string, ProductDetail>> {
  const ids = [
    ...new Set(
      rows.flatMap((r) => (r.collection_items ?? []).map((i) => i.product_id)),
    ),
  ];
  const products = await getProductDetailsByIds(ids);
  return new Map(products.map((p) => [p.id, p]));
}

export const getBaseCollections = cache(async (): Promise<Collection[]> => {
  if (!isSupabaseConfigured) return [];
  const supabase = createPublicClient();
  if (!supabase) return [];

  const [{ data, error }, settings] = await Promise.all([
    supabase
      .from("collections")
      .select(SELECT)
      .eq("type", "base")
      .eq("is_active", true)
      .order("is_featured", { ascending: false })
      .order("name"),
    getCollectionSettings(),
  ]);
  if (error || !data) return [];

  const rows = data as unknown as DbCollection[];
  const productById = await membersById(rows);
  return rows.map((row) => build(row, productById, settings));
});

/** Featured base collections for the home rail. */
export async function getFeaturedCollections(limit = 4): Promise<Collection[]> {
  const all = await getBaseCollections();
  return all.filter((c) => c.isFeatured && !c.soldOut).slice(0, limit);
}

/** One active base collection by slug (null when missing / not sellable roster). */
export async function getCollectionBySlug(
  slug: string,
): Promise<Collection | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = createPublicClient();
  if (!supabase) return null;

  const [{ data, error }, settings] = await Promise.all([
    supabase
      .from("collections")
      .select(SELECT)
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle(),
    getCollectionSettings(),
  ]);
  if (error || !data) return null;

  const row = data as unknown as DbCollection;
  return build(row, await membersById([row]), settings);
}

/** The signed-in user's saved custom collections (owner-scoped via RLS). */
export async function getMyCollections(): Promise<Collection[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const [{ data, error }, settings] = await Promise.all([
    supabase
      .from("collections")
      .select(SELECT)
      .eq("type", "custom")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    getCollectionSettings(),
  ]);
  if (error || !data) return [];

  const rows = data as unknown as DbCollection[];
  const productById = await membersById(rows);
  return rows.map((row) => build(row, productById, settings));
}

/** Pricing facts for a base collection — used to re-price a bundle at checkout. */
export async function getCollectionOrderInfo(id: string): Promise<{
  name: string;
  /** Default %, for a size with no override. */
  discountPct: number;
  /** Per-size overrides (0051) — the ordered ml is priced from these. */
  mlDiscounts: Record<number, number>;
  /** Тогтмол үнэтэй хэмжээнүүд (0054) — байвал хувийн тооцоог бүрэн орлоно. */
  mlPrices: Record<number, number>;
  /** Product ids of the collection's roster — the order must match it. */
  memberProductIds: string[];
} | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = createPublicClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("collections")
    .select(
      "name, discount_pct, collection_items ( product_id ), collection_ml_discounts ( ml, discount_pct, price )",
    )
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();
  if (!data) return null;
  const row = data as {
    name: string;
    discount_pct: number;
    collection_items: { product_id: string }[] | null;
    collection_ml_discounts:
      | {
          ml: number;
          discount_pct: number | string | null;
          price: number | null;
        }[]
      | null;
  };
  const mlDiscounts: Record<number, number> = {};
  const mlPrices: Record<number, number> = {};
  for (const d of row.collection_ml_discounts ?? []) {
    if (d.discount_pct != null) mlDiscounts[d.ml] = Number(d.discount_pct);
    if (d.price != null) mlPrices[d.ml] = Number(d.price);
  }
  return {
    name: row.name,
    discountPct: Number(row.discount_pct),
    mlDiscounts,
    mlPrices,
    memberProductIds: (row.collection_items ?? []).map((i) => i.product_id),
  };
}

/**
 * Багц угсрах хуудсын НЭГ ХУУДАС бараа.
 *
 * Шүүлт / эрэмбэ / хуудаслалт нь `catalog_search()` дотор — каталогийн
 * хуудастай ЯГ нэг эх сурвалж, тиймээс хоёр дэлгэц хэзээ ч өөр бараа
 * харуулахгүй. Дараа нь зөвхөн тэр хуудсанд харагдах барааны хэмжээнүүдийг
 * `product_variants_for()`-оор нэмж уншина (0064).
 *
 * Өмнө нь энэ функц БҮХ идэвхтэй барааг хэмжээ бүрийнх нь хамт буцааж, шүүлт,
 * эрэмбэ, хуудаслалт нь браузарт хийгддэг байв — 75 бараатай үед хуудас 405 KB.
 */
export async function getBuilderProducts(
  filters: CatalogFilters = {},
): Promise<{
  items: BuilderProduct[];
  total: number;
  page: number;
  perPage: number;
}> {
  const { items, total, page, perPage } = await getCatalog({
    ...filters,
    perPage: filters.perPage ?? BUILDER_PER_PAGE,
  });
  if (!items.length) return { items: [], total, page, perPage };

  const supabase = createPublicClient();
  const extra = new Map<
    string,
    { availableMl: number; variantByMl: BuilderProduct["variantByMl"] }
  >();
  if (!supabase) {
    // Demo горим (эсвэл RPC байхгүй сан): seed каталогаас нөхнө. Үгүй бол
    // бүх ус «энэ хэмжээнд байхгүй» гэж харагдана.
    for (const p of await getProductDetailsByIds(items.map((i) => i.id))) {
      extra.set(p.id, {
        availableMl: p.availableMl,
        variantByMl: Object.fromEntries(
          p.variants
            .filter((v) => v.isActive)
            .map((v) => [
              v.ml,
              { variantId: v.id, price: v.price, inStock: v.inStock },
            ]),
        ),
      });
    }
  }
  if (supabase) {
    const { data } = await callRpc<
      {
        product_id: string;
        available_ml: number;
        variants: Record<
          string,
          { variantId: string; price: number; inStock: boolean }
        > | null;
      }[]
    >(supabase, "product_variants_for", { p_ids: items.map((i) => i.id) });
    if (!data?.length) {
      // 0064 хэрэгжээгүй сан дээр ч угсрагч ажиллана.
      for (const p of await getProductDetailsByIds(items.map((i) => i.id))) {
        extra.set(p.id, {
          availableMl: p.availableMl,
          variantByMl: Object.fromEntries(
            p.variants
              .filter((v) => v.isActive)
              .map((v) => [
                v.ml,
                { variantId: v.id, price: v.price, inStock: v.inStock },
              ]),
          ),
        });
      }
    }
    for (const row of data ?? []) {
      extra.set(row.product_id, {
        availableMl: row.available_ml,
        variantByMl: Object.fromEntries(
          Object.entries(row.variants ?? {}).map(
            ([ml, v]) => [Number(ml), v] as const,
          ),
        ) as BuilderProduct["variantByMl"],
      });
    }
  }

  return {
    items: items.map((p) => ({
      productId: p.id,
      slug: p.slug,
      name: p.name,
      brand: p.brand,
      gender: p.gender,
      image: p.image,
      soldOut: p.soldOut,
      availableMl: extra.get(p.id)?.availableMl ?? 0,
      variantByMl: extra.get(p.id)?.variantByMl ?? {},
      scentFamilies: p.scentFamilies,
      seasons: p.seasons,
      tags: p.tags,
      startingPrice: p.startingPrice,
      createdAt: p.createdAt,
      ratingCount: p.ratingCount,
    })),
    total,
    page,
    perPage,
  };
}

/** Багц угсрагчийн нэг хуудсанд хэдэн бараа. Каталогийнхаас өгөөмөр: энд
 *  сонголт хийж байгаа тул нэг дэлгэцэнд илүү олон ус харагдах нь дээр. */
export const BUILDER_PER_PAGE = 24;
