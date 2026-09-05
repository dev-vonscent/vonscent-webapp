import "server-only";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import { fetchProducts } from "@/features/products/api";
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
export const getBaseCollections = cache(async (): Promise<Collection[]> => {
  if (!isSupabaseConfigured) return [];
  const supabase = createPublicClient();
  if (!supabase) return [];

  const [{ data, error }, products, settings] = await Promise.all([
    supabase
      .from("collections")
      .select(SELECT)
      .eq("type", "base")
      .eq("is_active", true)
      .order("is_featured", { ascending: false })
      .order("name"),
    fetchProducts(),
    getCollectionSettings(),
  ]);
  if (error || !data) return [];

  const productById = new Map(products.map((p) => [p.id, p]));
  return (data as unknown as DbCollection[]).map((row) =>
    build(row, productById, settings),
  );
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

  const [{ data, error }, products, settings] = await Promise.all([
    supabase
      .from("collections")
      .select(SELECT)
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle(),
    fetchProducts(),
    getCollectionSettings(),
  ]);
  if (error || !data) return null;

  const productById = new Map(products.map((p) => [p.id, p]));
  return build(data as unknown as DbCollection, productById, settings);
}

/** The signed-in user's saved custom collections (owner-scoped via RLS). */
export async function getMyCollections(): Promise<Collection[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const [{ data, error }, products, settings] = await Promise.all([
    supabase
      .from("collections")
      .select(SELECT)
      .eq("type", "custom")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    fetchProducts(),
    getCollectionSettings(),
  ]);
  if (error || !data) return [];

  const productById = new Map(products.map((p) => [p.id, p]));
  return (data as unknown as DbCollection[]).map((row) =>
    build(row, productById, settings),
  );
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

/** All active products shaped for the custom-bundle builder (client-safe). */
export async function getBuilderProducts(): Promise<BuilderProduct[]> {
  const products = await fetchProducts();
  return products.map((p) => ({
    productId: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    gender: p.gender,
    image: p.image,
    soldOut: p.soldOut,
    availableMl: p.availableMl,
    variantByMl: Object.fromEntries(
      p.variants
        .filter((v) => v.isActive)
        .map((v) => [
          v.ml,
          { variantId: v.id, price: v.price, inStock: v.inStock },
        ]),
    ),
    scentFamilies: p.scentFamilies,
    seasons: p.seasons,
    tags: p.tags,
    startingPrice: p.startingPrice,
    createdAt: p.createdAt,
    ratingCount: p.ratingCount,
  }));
}
