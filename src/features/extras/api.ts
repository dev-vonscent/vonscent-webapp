import "server-only";
import { unstable_cache } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import type { ExtraInventoryMode, VialStyle } from "@/db/types";
import { CACHE_TAG_CATALOG, CACHE_TAG_FEATURE_FLAGS } from "@/lib/cache-tags";
import { createPublicClient } from "@/lib/supabase/public";
import { callRpc } from "@/lib/supabase/rpc";
import { vialName } from "@/lib/vials";
import type { ShopExtraCard, ShopExtraDetail } from "./types";

/**
 * Дэлгүүрийн нэмэлт бараа (extras-shop-plan §9). Бүх уншилт SQL-ийн
 * `extras_catalog()` / `extra_detail()`-ээс — «дууссан» эсэх нь staff-only
 * хүснэгтээс (сав, шилний түгжээ) хамаардаг тул тэнд л бодогдоно.
 * Туг хаалттай бол SQL хоосон буцаана; хуудас өөрөө `isFeatureEnabled`-ээр
 * 404 болно (хоёр давхарга).
 */

interface CatalogRow {
  id: string;
  slug: string;
  name: string;
  category_id: string;
  category_slug: string;
  category_name: string;
  category_sort: number;
  mode: ExtraInventoryMode;
  image_url: string | null;
  images: string[];
  capacity: number | null;
  sort: number;
  from_price: number;
  sold_out: boolean;
  leftover_brand: string | null;
  leftover_product: string | null;
  remaining_ml: number | null;
  full_ml: number | null;
  created_at: string;
  updated_at: string;
}

export interface ShopExtraListItem extends ShopExtraCard {
  sort: number;
  categorySort: number;
  createdAt: string;
  updatedAt: string;
}

function toCard(r: CatalogRow): ShopExtraListItem {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    categoryName: r.category_name,
    categorySlug: r.category_slug,
    mode: r.mode,
    image: r.image_url,
    fromPrice: r.from_price,
    soldOut: r.sold_out,
    leftover:
      r.mode === "leftover_liquid"
        ? {
            brand: r.leftover_brand ?? "",
            productName: r.leftover_product ?? "",
            remainingMl: r.remaining_ml ?? 0,
            fullMl: r.full_ml ?? 0,
          }
        : null,
    capacity: r.capacity,
    sort: r.sort,
    categorySort: r.category_sort,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const fetchCatalog = unstable_cache(
  async (): Promise<CatalogRow[]> => {
    const supabase = createPublicClient();
    if (!supabase) return [];
    const { data, error } = await callRpc<CatalogRow[]>(
      supabase,
      "extras_catalog",
      {},
    );
    if (error) throw new Error(`extras_catalog failed: ${error.message}`);
    return data ?? [];
  },
  ["extras-catalog"],
  // Захиалга нөөцийг хөдөлгөхөд `revalidatePublic()` catalog tag-ийг цэвэрлэнэ.
  { revalidate: 60, tags: [CACHE_TAG_CATALOG, CACHE_TAG_FEATURE_FLAGS] },
);

/** Нийтэлсэн бүх нэмэлт бараа — дарааллаар (ангилал → sort → шинэ). */
export async function getShopExtras(): Promise<ShopExtraListItem[]> {
  try {
    const rows = (await fetchCatalog()).map(toCard);
    return rows.sort(
      (a, b) =>
        a.categorySort - b.categorySort ||
        Number(a.soldOut) - Number(b.soldOut) ||
        a.sort - b.sort ||
        b.createdAt.localeCompare(a.createdAt),
    );
  } catch (err) {
    Sentry.captureException(err);
    return [];
  }
}

interface DetailRow {
  card: CatalogRow;
  description: string;
  product_slug: string | null;
  product_id: string | null;
  variants: {
    id: string;
    label: string;
    price: number;
    available: number | null;
    vial_style: VialStyle | null;
    vial_ml: number | null;
  }[];
}

export async function getShopExtra(
  slug: string,
): Promise<ShopExtraDetail | null> {
  const supabase = createPublicClient();
  if (!supabase) return null;
  const { data, error } = await callRpc<DetailRow | null>(
    supabase,
    "extra_detail",
    { p_slug: slug },
  );
  if (error) {
    Sentry.captureException(new Error(`extra_detail: ${error.message}`));
    return null;
  }
  if (!data) return null;
  const card = toCard(data.card);
  return {
    card,
    description: data.description,
    images: data.card.images.length
      ? data.card.images
      : card.image
        ? [card.image]
        : [],
    variants: data.variants.map((v) => ({
      id: v.id,
      // Грамын савны хувилбар нэргүй — савны нэрээр («Ягаан 10ml»).
      label:
        v.vial_ml != null
          ? vialName({ style: v.vial_style, ml: v.vial_ml })
          : v.label,
      price: v.price,
      available: v.available,
    })),
    productSlug: data.product_slug,
    productId: data.product_id,
    updatedAt: data.card.updated_at,
  };
}
