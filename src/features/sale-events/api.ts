import "server-only";
import { unstable_cache } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { CACHE_TAG_CATALOG } from "@/lib/cache-tags";
import { isSupabaseConfigured } from "@/lib/env";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { callRpc } from "@/lib/supabase/rpc";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
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
 * Кэш: 60с + `CACHE_TAG_CATALOG` (админ бичилт `revalidatePublic()`-аар
 * цэвэрлэнэ). Эхлэх/дуусах мөч бичилтгүй тул минут тутмын cron
 * (`/api/cron/sale-events`) тэр мөчид мөн цэвэрлэнэ (plan §10).
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
    }));
  },
  ["live-sale-events"],
  { revalidate: 60, tags: [CACHE_TAG_CATALOG] },
);

/**
 * Одоо явж буй арга хэмжээнүүд. Туг хаалттай / demo / алдаа → хоосон
 * (дэлгүүр хэзээ ч унахгүй, зүгээр л chip, badge гарахгүй).
 */
export async function getLiveSaleEvents(): Promise<LiveSaleEvent[]> {
  if (!isSupabaseConfigured) return [];
  if (!(await isFeatureEnabled("sale_events"))) return [];
  try {
    // Кэш 60с хүртэл хоцорч болно — дууссаныг энд дахин шүүнэ.
    const now = Date.now();
    return (await fetchLive()).filter(
      (e) => Date.parse(e.startsAt) <= now && now < Date.parse(e.endsAt),
    );
  } catch (err) {
    Sentry.captureException(err);
    return [];
  }
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
  { revalidate: 60, tags: [CACHE_TAG_CATALOG] },
);

/**
 * `?event=slug`-ийн төлөв (тизер «11/23-нд эхэлнэ», «дууссан»). Олдохгүй /
 * ноорог → null. Төлвийг кэшийн хоцрогдлоос үл хамааран одоогийн цагаар
 * дахин тооцно.
 */
export async function getSaleEventPublic(
  slug: string,
): Promise<SaleEventPublic | null> {
  if (!isSupabaseConfigured || !SALE_EVENT_SLUG_RE.test(slug)) return null;
  if (!(await isFeatureEnabled("sale_events"))) return null;
  try {
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
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
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
  created_at: string;
  updated_at: string;
  sale_event_products:
    | {
        product_id: string;
        sort_order: number;
        sale_event_discounts: { ml: number; pct: number }[] | null;
      }[]
    | null;
}

const ADMIN_SELECT = `id, slug, name, badge_label, headline, description, starts_at, ends_at,
       is_active, show_countdown, created_at, updated_at,
       sale_event_products ( product_id, sort_order,
         sale_event_discounts ( ml, pct ) )`;

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
  const { data } = await supabase
    .from("products")
    .select("id, name, brand, gender, product_variants ( ml, price, is_active )")
    .in("status", ["active", "coming_soon"])
    .order("brand")
    .order("name");
  return ((data as ProductRow[] | null) ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    brand: r.brand,
    gender: r.gender,
    prices: Object.fromEntries(
      r.product_variants
        .filter((v) => v.is_active && v.price > 0)
        .map((v) => [v.ml, v.price]),
    ),
  }));
}
