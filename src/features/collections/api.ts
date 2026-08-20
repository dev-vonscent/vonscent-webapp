import "server-only";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import { fetchProducts } from "@/features/products/api";
import { memberPrices } from "./pricing";
import { DEFAULT_COLLECTION_SETTINGS } from "./types";
import type {
  BuilderProduct,
  Collection,
  CollectionMember,
  CollectionSettings,
  GiftCandidate,
} from "./types";
import type { ProductDetail } from "@/lib/types";
import type { Gender } from "@/db/types";

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
  gift_ml: number | null;
  is_active: boolean;
  is_featured: boolean;
  collection_items: { product_id: string; sort_order: number }[];
}

const SELECT = `
  id, slug, type, user_id, name, gender, description,
  discount_pct, image_url, gift_ml, is_active, is_featured,
  collection_items ( product_id, sort_order )
`;

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
  const prices = memberPrices(members, discountPct, settings.roundTo);
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
    image: row.image_url ?? members[0]?.image?.url ?? null,
    giftMl: row.gift_ml ?? settings.giftMl,
    giftEnabled: settings.giftEnabled,
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
  discountPct: number;
  giftMl: number | null;
} | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = createPublicClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("collections")
    .select("name, discount_pct, gift_ml")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();
  if (!data) return null;
  const row = data as {
    name: string;
    discount_pct: number;
    gift_ml: number | null;
  };
  return {
    name: row.name,
    discountPct: Number(row.discount_pct),
    giftMl: row.gift_ml,
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

/**
 * Perfumes the buyer may pick as the free gift: active products not already in
 * the bundle, with enough source ml left to fill the gift size.
 */
export async function getGiftCandidates(
  excludeProductIds: string[],
  giftMl: number,
): Promise<GiftCandidate[]> {
  const products = await fetchProducts();
  const exclude = new Set(excludeProductIds);
  return products
    .filter((p) => !exclude.has(p.id) && !p.soldOut && p.availableMl >= giftMl)
    .map((p) => ({
      productId: p.id,
      slug: p.slug,
      name: p.name,
      brand: p.brand,
      image: p.image,
    }));
}
