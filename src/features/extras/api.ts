import "server-only";
import { unstable_cache } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import type { ExtraInventoryMode, VialStyle } from "@/db/types";
import { CACHE_TAG_CATALOG, CACHE_TAG_FEATURE_FLAGS } from "@/lib/cache-tags";
import { createPublicClient } from "@/lib/supabase/public";
import { callRpc } from "@/lib/supabase/rpc";
import { vialName } from "@/lib/vials";
import { bottleKind } from "./lib/bottle-kind";
import { BOTTLE_TABS, type BottleFacets } from "./lib/sections";
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
  bottle_ml: number | null;
  sort: number;
  from_price: number;
  sold_out: boolean;
  leftover_brand: string | null;
  leftover_product: string | null;
  remaining_ml: number | null;
  full_ml: number | null;
  created_at: string;
  updated_at: string;
  stock: number | null;
  notice: string;
  requires_consent: boolean;
}

export interface ShopExtraListItem extends ShopExtraCard {
  sort: number;
  categorySort: number;
  createdAt: string;
  updatedAt: string;
}

/** «Үнэртний шил»-ийн жагсаалтын мөр — эх үнэртний шинжтэй (шүүлтүүрт). */
export interface BottleListItem extends ShopExtraListItem {
  facets: BottleFacets | null;
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
    // `leftover_brand/product` нь горимоос үл хамааран `product_id`-ийн
    // үнэртэн (0154-ийн `lp` join) — нэрээ үл харгалзан бүх шилэнд ирнэ.
    perfume: r.leftover_brand
      ? { brand: r.leftover_brand, name: r.leftover_product ?? "" }
      : null,
    bottleMl: r.bottle_ml,
    stock: r.stock,
    notice: r.notice,
    requiresConsent: r.requires_consent,
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
  perfume: {
    slug: string | null;
    name: string;
    brand: string;
    description: string;
    notes_top: string[];
    notes_heart: string[];
    notes_base: string[];
  } | null;
  variants: {
    id: string;
    label: string;
    price: number;
    available: number | null;
    vial_style: VialStyle | null;
    vial_ml: number | null;
    batch_code: string | null;
    size_note: string | null;
    image_url: string | null;
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
    // Бэлгийн савны хувилбар бүр өөрийн зурагтай (0153) — галерейд нэмнэ.
    images: [
      ...new Set([
        ...(data.card.images.length
          ? data.card.images
          : card.image
            ? [card.image]
            : []),
        ...data.variants.flatMap((v) => (v.image_url ? [v.image_url] : [])),
      ]),
    ],
    variants: data.variants.map((v) => ({
      id: v.id,
      // Грамын савны хувилбар нэргүй — савны нэрээр («Ягаан 10ml»).
      label:
        v.vial_ml != null
          ? vialName({ style: v.vial_style, ml: v.vial_ml })
          : v.label,
      price: v.price,
      available: v.available,
      batchCode: v.batch_code,
      sizeNote: v.size_note,
      imageUrl: v.image_url,
      vialStyle: v.vial_style,
      vialMl: v.vial_ml,
    })),
    productSlug: data.product_slug,
    productId: data.product_id,
    perfume: data.perfume
      ? {
          slug: data.perfume.slug,
          name: data.perfume.name,
          brand: data.perfume.brand,
          description: data.perfume.description,
          notesTop: data.perfume.notes_top,
          notesHeart: data.perfume.notes_heart,
          notesBase: data.perfume.notes_base,
        }
      : null,
    updatedAt: data.card.updated_at,
  };
}

/**
 * Үнэртний хуудасны «Бэлэглэх бол» — зарагдаж буй бүх бэлгийн сав
 * (хайрцаг, цаасан уут, даавуун уут), админы дарааллаар. Хувилбар хэрэгтэй
 * тул дэлгэрэнгүйгээр (цөөн тул зэрэг уншина).
 */
export async function getGiftOffers(): Promise<ShopExtraDetail[]> {
  const gifts = (await getShopExtras()).filter(
    (e) => e.categorySlug === "gift-box" && !e.soldOut,
  );
  const details = await Promise.all(gifts.map((g) => getShopExtra(g.slug)));
  return details.filter((d): d is ShopExtraDetail => d != null);
}

const fetchBottleFacets = unstable_cache(
  async (): Promise<
    {
      id: string;
      gender: string | null;
      scent_families: string[];
      seasons: string[];
    }[]
  > => {
    const supabase = createPublicClient();
    if (!supabase) return [];
    const { data, error } = await callRpc<
      {
        id: string;
        gender: string | null;
        scent_families: string[];
        seasons: string[];
      }[]
    >(supabase, "extras_bottle_facets", {});
    if (error) throw new Error(`extras_bottle_facets failed: ${error.message}`);
    return data ?? [];
  },
  ["extras-bottle-facets"],
  { revalidate: 60, tags: [CACHE_TAG_CATALOG, CACHE_TAG_FEATURE_FLAGS] },
);

/** Шил бүрийн эх үнэртний хүйс / үнэрийн төрөл / улирал (0176), id-аар. */
export async function getBottleFacets(): Promise<Map<string, BottleFacets>> {
  try {
    return new Map(
      (await fetchBottleFacets()).map((r) => [
        r.id,
        { gender: r.gender, families: r.scent_families, seasons: r.seasons },
      ]),
    );
  } catch (err) {
    Sentry.captureException(err);
    return new Map();
  }
}

/**
 * «Энэ үнэрийн шил» (plan §19.4) — тухайн үнэртэнтэй холбогдсон бүтэн,
 * үлдэгдэлтэй, хоосон шил; зарагдаж буй нь эхэнд, tab-ийн дарааллаар.
 * id-г SQL-ээс (`extras_bottles_for`, 0175), картыг cache-тэй жагсаалтаас.
 */
export async function getBottlesFor(
  productId: string,
): Promise<ShopExtraListItem[]> {
  const supabase = createPublicClient();
  if (!supabase) return [];
  const [{ data, error }, all] = await Promise.all([
    callRpc<string[]>(supabase, "extras_bottles_for", { p_product: productId }),
    getShopExtras(),
  ]);
  if (error) {
    Sentry.captureException(new Error(`extras_bottles_for: ${error.message}`));
    return [];
  }
  const ids = new Set(data ?? []);
  const order = (e: ShopExtraListItem) =>
    BOTTLE_TABS.indexOf(bottleKind(e.categorySlug, e.mode) ?? "empty");
  return all
    .filter((e) => ids.has(e.id))
    .sort(
      (a, b) =>
        Number(a.soldOut) - Number(b.soldOut) ||
        order(a) - order(b) ||
        a.fromPrice - b.fromPrice,
    );
}
