import "server-only";
import { unstable_cache } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { CACHE_TAG_CATALOG } from "@/lib/cache-tags";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ML_SIZES,
  SALE_EVENT_TICKER_THEMES,
  type SaleEventTickerTheme,
} from "@/lib/constants";
import { discountForMl } from "@/features/collections/pricing";
import {
  bundlePctLowMessage,
  filledPcts,
  type SaleEventBundleOption,
} from "./bundles";
import { isSupabaseConfigured } from "@/lib/env";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { callRpc } from "@/lib/supabase/rpc";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SALE_EVENT_SLUG_RE } from "@/lib/validators/sale-event";
import type {
  LiveSaleEvent,
  SaleEventAdminRow,
  SaleEventProduct,
  SaleEventPublic,
  SaleEventState,
} from "./types";

/**
 * Арга хэмжээ (0181, feature flag `sale_events`) — дэлгүүрийн уншилт.
 *
 * Энд зөвхөн ХАРАГДАЦ (chip, зурвас, badge) — мөнгөнд нөлөөгүй. Үнэ нь SQL-ийн
 * `variant_price()`-ээс (plan §5.2). Хүснэгтүүд staff-only RLS-тэй тул зөвхөн
 * security definer RPC-ээр: товлосон арга хэмжээний хувь задрахгүй.
 *
 * Кэш: 1 цаг + `CACHE_TAG_CATALOG` (админ бичилт `revalidatePublic()`-аар
 * цэвэрлэнэ). Эхлэх/дуусах мөч бичилтгүй бөгөөд үргэлж УБ 00:00 тул шөнийн
 * cron (`/api/cron/midnight-revalidate`) тэр мөчид цэвэрлэнэ (plan §10).
 */

interface LiveRow {
  slug: string;
  name: string;
  badge_label: string | null;
  headline: string | null;
  description: string | null;
  starts_at: string;
  ends_at: string;
  show_countdown: boolean;
  product_ids: string[] | null;
  /** 0187-оос өмнөх санд байхгүй (undefined) — өгөгдмөл өнгө. */
  ticker_theme?: string | null;
}

/** Сангийн утга → мэдэгдэх өнгө; бусад / хоосон → null (өгөгдмөл). */
function tickerTheme(
  v: string | null | undefined,
): SaleEventTickerTheme | null {
  return (SALE_EVENT_TICKER_THEMES as readonly string[]).includes(v ?? "")
    ? (v as SaleEventTickerTheme)
    : null;
}

const fetchLive = unstable_cache(
  async (): Promise<LiveSaleEvent[]> => {
    const supabase = createPublicClient();
    if (!supabase) return [];
    const { data, error } = await callRpc<LiveRow[]>(
      supabase,
      "live_sale_events",
      {},
    );
    // Шидэх нь санаатай: алдаа кэшлэгдэхгүй (products/api.ts-ийн загвар).
    if (error) throw new Error(`live_sale_events: ${error.message}`);
    return (data ?? []).map((r) => ({
      slug: r.slug,
      name: r.name,
      badgeLabel: r.badge_label,
      headline: r.headline,
      description: r.description,
      startsAt: r.starts_at,
      endsAt: r.ends_at,
      showCountdown: r.show_countdown,
      productIds: r.product_ids ?? [],
      tickerTheme: tickerTheme(r.ticker_theme),
    }));
  },
  ["live-sale-events"],
  { revalidate: 3600, tags: [CACHE_TAG_CATALOG] },
);

/**
 * Одоо явж буй арга хэмжээнүүд. Туг хаалттай / demo → хоосон. Алдааг
 * ШИДНЭ (#284): `[]` бол хямдралын chip, badge-гүй хуудас ISR-д нэг цаг
 * үлдэнэ; шидвэл ISR өмнөх зөв хуудсаа үлдээнэ.
 */
export async function getLiveSaleEvents(): Promise<LiveSaleEvent[]> {
  if (!isSupabaseConfigured) return [];
  if (!(await isFeatureEnabled("sale_events"))) return [];
  // Кэш 60с хүртэл хоцорч болно — дууссаныг энд дахин шүүнэ.
  const now = Date.now();
  return (await fetchLive()).filter(
    (e) => Date.parse(e.startsAt) <= now && now < Date.parse(e.endsAt),
  );
}

const fetchPcts = unstable_cache(
  async (): Promise<Record<string, number>> => {
    const supabase = createPublicClient();
    if (!supabase) return {};
    const { data, error } = await callRpc<
      { product_id: string; ml: number; pct: number }[]
    >(supabase, "live_event_discounts", {});
    if (error) throw new Error(`live_event_discounts: ${error.message}`);
    const out: Record<string, number> = {};
    for (const r of data ?? []) {
      out[r.product_id] = Math.max(out[r.product_id] ?? 0, r.pct);
    }
    return out;
  },
  ["live-event-pcts"],
  { revalidate: 3600, tags: [CACHE_TAG_CATALOG] },
);

/**
 * Барааны картын «~10%»: LIVE арга хэмжээн дэх бараа бүрийн хамгийн их хувь
 * (`live_event_discounts`, 0181 — зөвхөн live мөр, anon-д нээлттэй; товлосон
 * хувь задрахгүй). Туг хаалттай → хоосон; алдааг шиднэ (#284).
 */
export async function getLiveEventPcts(): Promise<Record<string, number>> {
  if (!isSupabaseConfigured) return {};
  if (!(await isFeatureEnabled("sale_events"))) return {};
  return fetchPcts();
}

const fetchPublic = unstable_cache(
  async (slug: string): Promise<SaleEventPublic | null> => {
    const supabase = createPublicClient();
    if (!supabase) return null;
    const { data, error } = await callRpc<
      {
        slug: string;
        name: string;
        state: SaleEventState;
        starts_at: string;
        ends_at: string;
      }[]
    >(supabase, "sale_event_public", { p_slug: slug });
    if (error) throw new Error(`sale_event_public: ${error.message}`);
    const r = data?.[0];
    return r
      ? {
          slug: r.slug,
          name: r.name,
          state: r.state,
          startsAt: r.starts_at,
          endsAt: r.ends_at,
        }
      : null;
  },
  ["sale-event-public"],
  { revalidate: 3600, tags: [CACHE_TAG_CATALOG] },
);

/**
 * `?event=slug`-ийн төлөв (тизер «11/23-нд эхэлнэ», «дууссан»). Олдохгүй /
 * ноорог → null; алдааг шиднэ (#284). Төлвийг кэшийн хоцрогдлоос үл
 * хамааран одоогийн цагаар дахин тооцно.
 */
export async function getSaleEventPublic(
  slug: string,
): Promise<SaleEventPublic | null> {
  if (!isSupabaseConfigured || !SALE_EVENT_SLUG_RE.test(slug)) return null;
  if (!(await isFeatureEnabled("sale_events"))) return null;
  const e = await fetchPublic(slug);
  if (!e) return null;
  const now = Date.now();
  const state: SaleEventState =
    now < Date.parse(e.startsAt)
      ? "scheduled"
      : now < Date.parse(e.endsAt)
        ? "live"
        : "ended";
  return { ...e, state };
}

// ── Админ ─────────────────────────────────────────────────────────────────

interface AdminRow {
  id: string;
  slug: string;
  name: string;
  badge_label: string | null;
  headline: string | null;
  description: string | null;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  show_countdown: boolean;
  ticker_theme: string | null;
  created_at: string;
  updated_at: string;
  sale_event_products:
    | {
        product_id: string;
        sort_order: number;
        sale_event_discounts: { ml: number; pct: number }[] | null;
      }[]
    | null;
  /** 0190 — туг хаалттай ч уншина (staff RLS); бичих нь тугаар. */
  sale_event_collections?:
    | {
        collection_id: string;
        sort_order: number;
        sale_event_collection_discounts: { ml: number; pct: number }[] | null;
      }[]
    | null;
}

const ADMIN_SELECT = `id, slug, name, badge_label, headline, description, starts_at, ends_at,
       is_active, show_countdown, ticker_theme, created_at, updated_at,
       sale_event_products ( product_id, sort_order,
         sale_event_discounts ( ml, pct ) ),
       sale_event_collections ( collection_id, sort_order,
         sale_event_collection_discounts ( ml, pct ) )`;

function toAdminRow(r: AdminRow): SaleEventAdminRow {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    badgeLabel: r.badge_label,
    headline: r.headline,
    description: r.description,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    isActive: r.is_active,
    showCountdown: r.show_countdown,
    tickerTheme: tickerTheme(r.ticker_theme),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    items: [...(r.sale_event_products ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((p) => ({
        productId: p.product_id,
        pcts: Object.fromEntries(
          (p.sale_event_discounts ?? []).map((d) => [String(d.ml), d.pct]),
        ),
      })),
    collections: [...(r.sale_event_collections ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((c) => ({
        collectionId: c.collection_id,
        pcts: Object.fromEntries(
          (c.sale_event_collection_discounts ?? []).map((d) => [
            String(d.ml),
            d.pct,
          ]),
        ),
      })),
  };
}

/**
 * Админы жагсаалт — session client (staff RLS, 0181). Арга хэмжээ цөөхөн
 * (жилд хэдэн арав) тул бүгдийг нь гишүүд, хувьтай нь нэг query-гээр.
 */
export async function getSaleEventsAdmin(): Promise<SaleEventAdminRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("sale_events")
    .select(ADMIN_SELECT)
    .order("starts_at", { ascending: false });
  if (error) {
    Sentry.captureException(new Error(`sale_events admin: ${error.message}`));
    return [];
  }
  return ((data as AdminRow[] | null) ?? []).map(toAdminRow);
}

/** Студийн нэг мөр (studio-ux.md §8.1). Олдохгүй / алдаа → null. */
export async function getSaleEventAdmin(
  id: string,
): Promise<SaleEventAdminRow | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("sale_events")
    .select(ADMIN_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    Sentry.captureException(new Error(`sale_event admin: ${error.message}`));
    return null;
  }
  return data ? toAdminRow(data as AdminRow) : null;
}

interface ProductRow {
  id: string;
  name: string;
  brand: string;
  gender: SaleEventProduct["gender"];
  product_variants: { ml: number; price: number; is_active: boolean }[];
  product_images: {
    url: string;
    sort_order: number;
    is_visible: boolean | null;
  }[];
}

/**
 * Студийн барааны сонгогч — зөвхөн дэлгүүрт харагдаж буй («Идэвхтэй»,
 * «Тун удахгүй») бараа, идэвхтэй ба үнэтэй хэмжээнүүдтэйгээ.
 */
export async function getSaleEventProductOptions(): Promise<
  SaleEventProduct[]
> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, brand, gender, product_variants ( ml, price, is_active ), product_images ( url, sort_order, is_visible )",
    )
    .in("status", ["active", "coming_soon"])
    .order("brand")
    .order("name");
  // Чимээгүй хоосон сонгогч «бараа алга» гэж төөрөгдүүлнэ — алдааны хуудас.
  if (error) {
    Sentry.captureException(new Error(`sale_event products: ${error.message}`));
    throw new Error("Барааны жагсаалтыг уншиж чадсангүй.");
  }
  return ((data as ProductRow[] | null) ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    brand: r.brand,
    gender: r.gender,
    // Дэлгүүрийн картын зураг: харагдахаар тэмдэглэсэн эхнийх (0049).
    image:
      [...r.product_images]
        .filter((i) => i.is_visible !== false)
        .sort((a, b) => a.sort_order - b.sort_order)[0]?.url ?? null,
    prices: Object.fromEntries(
      r.product_variants
        .filter((v) => v.is_active && v.price > 0)
        .map((v) => [v.ml, v.price]),
    ),
  }));
}

interface BundleRow {
  id: string;
  name: string;
  is_active: boolean;
  image_url: string | null;
  discount_pct: number | string;
  collection_ml_discounts: {
    ml: number;
    discount_pct: number | string | null;
  }[];
  collection_items: {
    products: {
      product_variants: { ml: number; price: number; is_active: boolean }[];
      product_images: {
        url: string;
        sort_order: number;
        is_visible: boolean | null;
      }[];
    } | null;
  }[];
  sale_event_collections: {
    event_id: string;
    sale_events: {
      name: string;
      is_active: boolean;
      starts_at: string;
      ends_at: string;
    } | null;
  }[];
}

/**
 * Студийн бэлэн багцын сонгогч (16.7, туг `sale_event_bundles`) — идэвхтэй
 * бэлэн багцууд, хэмжээ бүрийн ОДООГИЙН хувь, гишүүдийн үндсэн үнийн
 * нийлбэр (урьдчилж харах), багцыг агуулсан бусад арга хэмжээ (16.3).
 * Session client (staff RLS, 0190).
 */
export async function getSaleEventBundleOptions(): Promise<
  SaleEventBundleOption[]
> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("collections")
    .select(
      `id, name, is_active, image_url, discount_pct,
       collection_ml_discounts ( ml, discount_pct ),
       collection_items ( products ( product_variants ( ml, price, is_active ),
         product_images ( url, sort_order, is_visible ) ) ),
       sale_event_collections ( event_id,
         sale_events ( name, is_active, starts_at, ends_at ) )`,
    )
    .eq("type", "base")
    // Идэвхгүй багц ч орно: аль хэдийн event-д байгаа бол «Идэвхгүй»
    // тэмдэгтэй сонгогдсон хэвээр харагдана (шинээр нэмэхэд disabled).
    .order("is_active", { ascending: false })
    .order("name");
  if (error) {
    Sentry.captureException(new Error(`sale_event bundles: ${error.message}`));
    throw new Error("Багцын жагсаалтыг уншиж чадсангүй.");
  }
  const rows = (data as unknown as BundleRow[] | null) ?? [];
  const sellable = await sellableCollections(
    rows.filter((r) => r.is_active).map((r) => r.id),
  );
  return rows.map((r) => {
    const own = new Map(
      r.collection_ml_discounts
        .filter((d) => d.discount_pct != null)
        .map((d) => [d.ml, Number(d.discount_pct)]),
    );
    const basePcts: Record<number, number> = {};
    const memberSums: Record<number, number> = {};
    const members = r.collection_items.map((i) => i.products);
    for (const ml of ML_SIZES) {
      basePcts[ml] = discountForMl(
        ml,
        Number(r.discount_pct),
        Object.fromEntries(own),
      );
      const prices = members.map(
        (p) =>
          p?.product_variants.find((v) => v.ml === ml && v.is_active)?.price,
      );
      if (members.length > 0 && prices.every((x) => x != null)) {
        memberSums[ml] = prices.reduce((s, x) => s + (x ?? 0), 0);
      }
    }
    const firstImage = members[0]?.product_images
      ? [...members[0].product_images]
          .filter((i) => i.is_visible !== false)
          .sort((a, b) => a.sort_order - b.sort_order)[0]?.url
      : null;
    return {
      id: r.id,
      name: r.name,
      status: !r.is_active
        ? ("inactive" as const)
        : sellable.has(r.id)
          ? ("available" as const)
          : ("sold_out" as const),
      image: r.image_url ?? firstImage ?? null,
      basePcts,
      memberSums,
      events: r.sale_event_collections
        .filter((e) => e.sale_events)
        .map((e) => ({
          eventId: e.event_id,
          name: e.sale_events!.name,
          isActive: e.sale_events!.is_active,
          startsAt: e.sale_events!.starts_at,
          endsAt: e.sale_events!.ends_at,
        })),
    };
  });
}

/**
 * Route-ийн шалгалт (16.7): event хувь > багцын одоогийн хувь. Service
 * client — суурь хувийг сангаас. Анхны зөрчлийн монгол мессеж, эс бөгөөс null.
 */
export async function bundlePctLowError(
  supabase: SupabaseClient,
  bundles: readonly { collectionId: string; pcts: Record<string, number> }[],
): Promise<string | null> {
  if (!bundles.length) return null;
  const { data, error } = await supabase
    .from("collections")
    .select(
      "id, name, discount_pct, collection_ml_discounts ( ml, discount_pct )",
    )
    .in(
      "id",
      bundles.map((b) => b.collectionId),
    );
  if (error) throw new Error(`bundle base pcts: ${error.message}`);
  const rows = (data ?? []) as unknown as {
    id: string;
    name: string;
    discount_pct: number | string;
    collection_ml_discounts: {
      ml: number;
      discount_pct: number | string | null;
    }[];
  }[];
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const b of bundles) {
    const r = byId.get(b.collectionId);
    if (!r) return "Багц олдсонгүй — хуудсаа сэргээнэ үү.";
    const own = Object.fromEntries(
      r.collection_ml_discounts
        .filter((d) => d.discount_pct != null)
        .map((d) => [d.ml, Number(d.discount_pct)]),
    );
    const basePcts = Object.fromEntries(
      ML_SIZES.map((ml) => [
        ml,
        discountForMl(ml, Number(r.discount_pct), own),
      ]),
    );
    const msg = bundlePctLowMessage(r.name, filledPcts(b.pcts), basePcts);
    if (msg) return msg;
  }
  return null;
}

/**
 * Одоо худалдаж авч болох багцууд — SQL `collection_sellable` (0191), сангийн
 * `save_sale_event`-ийн `BUNDLE_UNAVAILABLE`-тай ЯГ ижил дүрэм. Service
 * role (функц нь зөвхөн service_role-д); дуудагч staff-аар хамгаалагдсан.
 */
async function sellableCollections(
  ids: readonly string[],
): Promise<Set<string>> {
  const admin = createAdminClient();
  if (!admin || !ids.length) return new Set();
  const results = await Promise.all(
    ids.map(async (id) => {
      const { data, error } = await admin.rpc("collection_sellable", {
        p_collection: id,
      });
      if (error) throw new Error(`collection_sellable: ${error.message}`);
      return data === true ? id : null;
    }),
  );
  return new Set(results.filter((x): x is string => x != null));
}

/**
 * Route-ийн шалгалт (0191): ШИНЭЭР нэмэгдэж буй багц (энэ event-д хараахан
 * байхгүй) идэвхтэй, зарагдаж байх ёстой. Аль хэдийн байгаа багц дууссан ч
 * хадгалагдана. Зөрчил бол монгол мессеж, эс бөгөөс null.
 */
export async function newBundleUnavailableError(
  supabase: SupabaseClient,
  collectionIds: readonly string[],
  eventId: string | null,
): Promise<string | null> {
  if (!collectionIds.length) return null;
  let existing = new Set<string>();
  if (eventId) {
    const { data, error } = await supabase
      .from("sale_event_collections")
      .select("collection_id")
      .eq("event_id", eventId);
    if (error) throw new Error(`sale_event_collections: ${error.message}`);
    existing = new Set(
      ((data as { collection_id: string }[] | null) ?? []).map(
        (r) => r.collection_id,
      ),
    );
  }
  const fresh = collectionIds.filter((id) => !existing.has(id));
  if (!fresh.length) return null;
  const [{ data, error }, sellable] = await Promise.all([
    supabase.from("collections").select("id, name, is_active").in("id", fresh),
    sellableCollections(fresh),
  ]);
  if (error) throw new Error(`collections: ${error.message}`);
  const bad = (
    (data as { id: string; name: string; is_active: boolean }[] | null) ?? []
  )
    .filter((c) => !sellable.has(c.id))
    .map((c) => `«${c.name}» (${c.is_active ? "дууссан" : "идэвхгүй"})`);
  return bad.length
    ? `Дууссан эсвэл идэвхгүй багцыг шинээр нэмэх боломжгүй: ${bad.join(", ")}.`
    : null;
}
