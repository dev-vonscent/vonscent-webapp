import "server-only";
import { createClient } from "@/lib/supabase/server";
import { callRpc } from "@/lib/supabase/rpc";
import type {
  OrderRow,
  OrderItemRow,
  OrderStatusHistoryRow,
  ProfileRow,
  CouponRow,
  HomeSectionRow,
  FaqRow,
  BlogPostRow,
} from "@/db/types";
import {
  ORDER_STATUSES,
  DEFAULT_LOW_STOCK_ML,
  type OrderStatus,
} from "@/lib/constants";

/**
 * Admin read access. Uses the cookie-bound client so staff RLS applies (admins
 * may read all orders / profiles via is_staff()). Returns empty data in demo.
 */

interface RevenueWindows {
  sales_today: number;
  sales_7d: number;
  sales_30d: number;
}

export interface DashboardData {
  salesToday: number;
  sales7d: number;
  sales30d: number;
  statusCounts: Record<OrderStatus, number>;
  recentOrders: OrderRow[];
  /** Product ids ranked by paid sales volume (best first). */
  topSellerIds: string[];
}

/**
 * Борлуулалт (client-defined) — the goods value of paid orders, with shipping,
 * coupon and loyalty deductions excluded (requirement_final.md «Борлуулалт
 * бодох арга») — is defined once, in SQL: `greatest(subtotal - discount -
 * coalesce(loyalty_used, 0), 0)` in migration 0046. It used to also exist as a
 * TypeScript function here; two definitions of the same money rule drift.
 */

export async function getDashboardData(): Promise<DashboardData | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const now = Date.now();
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const since30d = new Date(now - 30 * 864e5).toISOString();

  // Previously this was one `select("*").limit(500)` and everything below was
  // computed from that slice — so past 500 lifetime orders the revenue figures
  // and status counts went quietly and permanently wrong. Each number now has
  // its own bounded query: revenue is scoped by date (not by row count) and
  // the status tallies are SQL counts.
  const [{ data: revenue }, { data: recent }, ...statusResults] =
    await Promise.all([
      callRpc<RevenueWindows[]>(supabase, "admin_revenue_windows", {
        p_today: startToday.toISOString(),
        p_7d: new Date(now - 7 * 864e5).toISOString(),
        p_30d: since30d,
      }),
      supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(8),
      ...ORDER_STATUSES.map((s) =>
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("status", s),
      ),
    ]);

  const windows = revenue?.[0] ?? {
    sales_today: 0,
    sales_7d: 0,
    sales_30d: 0,
  };

  const statusCounts = Object.fromEntries(
    ORDER_STATUSES.map((s, i) => [s, statusResults[i]?.count ?? 0]),
  ) as Record<OrderStatus, number>;

  const hasPaidSales = windows.sales_30d > 0;

  // Top sellers by actual paid volume — the same top_seller_products RPC the
  // storefront uses (audit R4: it excludes free gift lines and aggregates in
  // SQL, so the ranking never diverges or truncates). Falls back to the hot
  // tag in the dashboard when there are no sales yet.
  const topSellerIds: string[] = [];
  if (hasPaidSales) {
    const { data: ranked } = await supabase.rpc("top_seller_products", {
      p_limit: 20,
    });
    topSellerIds.push(
      ...(
        (ranked as { product_id: string; sold_qty: number }[] | null) ?? []
      ).map((r) => r.product_id),
    );
  }

  return {
    salesToday: windows.sales_today,
    sales7d: windows.sales_7d,
    sales30d: windows.sales_30d,
    statusCounts,
    recentOrders: (recent as OrderRow[] | null) ?? [],
    topSellerIds,
  };
}

export interface SidebarBadges {
  newOrders: number;
  outOfStock: number;
}

/** Counts shown on the admin sidebar: fresh orders + sold-out active goods. */
export async function getSidebarBadges(): Promise<SidebarBadges> {
  const supabase = await createClient();
  if (!supabase) return { newOrders: 0, outOfStock: 0 };
  // Both are SQL counts. This runs in `(admin)/layout.tsx` — on every admin
  // navigation — so it used to pull 10,000 inventory rows over the wire to
  // count them in JS. `available_ml` is a generated column (0046).
  const [{ count }, { count: outOfStock }] = await Promise.all([
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("inventory")
      .select("product_id, products!inner(is_active)", {
        count: "exact",
        head: true,
      })
      .eq("products.is_active", true)
      .lte("available_ml", 0),
  ]);
  return { newOrders: count ?? 0, outOfStock: outOfStock ?? 0 };
}

export interface AdminNotification {
  id: string;
  kind: string;
  order_id: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
}

/** Unread admin notifications (order cancellations etc.), newest first. */
export async function getUnreadNotifications(): Promise<AdminNotification[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("admin_notifications")
    .select("*")
    .eq("is_read", false)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data as unknown as AdminNotification[] | null) ?? [];
}

export async function getOrderDetail(id: string): Promise<{
  order: OrderRow;
  items: OrderItemRow[];
  history: OrderStatusHistoryRow[];
  customer: ProfileRow | null;
} | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  const order = data as OrderRow | null;
  if (!order) return null;

  const [{ data: items }, { data: history }, customer] = await Promise.all([
    supabase.from("order_items").select("*").eq("order_id", id),
    supabase
      .from("order_status_history")
      .select("*")
      .eq("order_id", id)
      .order("created_at", { ascending: true }),
    order.user_id
      ? supabase
          .from("profiles")
          .select("*")
          .eq("id", order.user_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    order,
    items: (items as OrderItemRow[] | null) ?? [],
    history: (history as OrderStatusHistoryRow[] | null) ?? [],
    customer: (customer.data as ProfileRow | null) ?? null,
  };
}

/**
 * Every customer as a pick-list option (id + display name), for the coupon
 * targeting Select. Deliberately separate from `getCustomers`: that one is
 * paginated for the list screen, and paginating a dropdown would silently
 * hide anyone past the first page.
 */
export async function getCustomerOptions(): Promise<
  { id: string; full_name: string | null; phone: string | null }[]
> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, phone")
    .order("full_name", { ascending: true });
  return (
    (data as
      | { id: string; full_name: string | null; phone: string | null }[]
      | null) ?? []
  );
}

/** Rows per page for the customers list — server-side, like orders. */
export const CUSTOMERS_PER_PAGE = 50;

export async function getCustomers(
  search?: string,
  page = 0,
): Promise<{ rows: ProfileRow[]; total: number | null }> {
  const supabase = await createClient();
  if (!supabase) return { rows: [], total: null };
  let query = supabase
    .from("profiles")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });
  if (search) query = query.ilike("full_name", `%${search}%`);
  // The old `.limit(200)` hid every customer past the 200th, search included.
  const { data, count } = await query.range(
    page * CUSTOMERS_PER_PAGE,
    page * CUSTOMERS_PER_PAGE + CUSTOMERS_PER_PAGE - 1,
  );
  return { rows: (data as ProfileRow[] | null) ?? [], total: count ?? 0 };
}

/** One ml size as the admin edits it (product_variants). */
export interface AdminVariant {
  ml: number;
  /** The ₮ price the admin typed — nothing derives it. */
  price: number;
  isActive: boolean;
}

/** A gallery row as the admin edits it (product_images). */
export interface AdminProductImage {
  id: string;
  url: string;
  alt: string | null;
  sort_order: number;
  /** Ticked = the storefront shows it (0049). */
  is_visible: boolean;
}

export interface AdminProduct {
  id: string;
  slug: string;
  name: string;
  brand: string;
  gender: string;
  concentration: string;
  scentFamilies: string[];
  seasons: string[];
  description: string;
  notesDescription: string;
  usageDescription: string;
  shortDescription: string;
  images: AdminProductImage[];
  variants: AdminVariant[];
  notesTop: string[];
  notesHeart: string[];
  notesBase: string[];
  originCountry: string | null;
  releaseYear: number | null;
  bottlePrice: number;
  bottleMl: number;
  salePct: number;
  isActive: boolean;
  startingPrice: number;
  /** on_hand_ml − reserved_ml: what the shop can actually still sell. */
  availableMl: number;
  /** Physical ml in the source bottle, reservations included. */
  onHandMl: number;
  /** ml promised to orders that are placed but not yet committed. */
  reservedMl: number;
  lowStockMl: number;
  tags: string[];
  /** Free-form internal tag slugs (0035_custom_tags). */
  customTags: string[];
  /** First image the storefront actually shows, if any. */
  imageUrl: string | null;
  /** Gallery pictures the admin has not ticked for the storefront yet. */
  hiddenImageCount: number;
  /** Bottle photo the AI works from (0031_product_reference_image). */
  referenceImageUrl: string | null;
  /** Latest AI generation state (ai-image-generation §8). */
  imageStatus: "none" | "pending" | "generating" | "done" | "failed";
  imageResultUrl: string | null;
  imageGenId: string | null;
  imagePrompt: string;
  imageError: string | null;
}

const ADMIN_PRODUCT_SELECT = `
  id, slug, name, brand, gender, concentration, scent_families, seasons,
  description, notes_description, usage_description, short_description,
  notes_top, notes_heart, notes_base, origin_country, release_year,
  bottle_price, bottle_ml, sale_pct, is_active, reference_image_url,
  product_images ( id, url, alt, sort_order, is_visible ),
  product_variants ( ml, price, is_active ),
  inventory ( on_hand_ml, reserved_ml, low_stock_ml ),
  product_tags ( tags ( slug ) ),
  product_image_generations ( id, status, result_url, prompt, error, created_at )
`;

interface GenRow {
  id: string;
  status: "pending" | "generating" | "done" | "failed";
  result_url: string | null;
  prompt: string;
  error: string | null;
  created_at: string;
}

interface AdminProductRow {
  id: string;
  slug: string;
  name: string;
  brand: string;
  gender: string;
  concentration: string;
  scent_families: string[] | null;
  seasons: string[] | null;
  description: string;
  notes_description: string | null;
  usage_description: string | null;
  short_description: string | null;
  notes_top: string[];
  notes_heart: string[];
  notes_base: string[];
  origin_country: string | null;
  release_year: number | null;
  bottle_price: number;
  bottle_ml: number;
  sale_pct: number;
  is_active: boolean;
  reference_image_url: string | null;
  product_images: AdminProductImage[];
  product_variants: {
    ml: number;
    price: number;
    is_active: boolean;
  }[];
  inventory:
    | { on_hand_ml: number; reserved_ml: number; low_stock_ml: number }
    | { on_hand_ml: number; reserved_ml: number; low_stock_ml: number }[]
    | null;
  product_tags: { tags: { slug: string } | { slug: string }[] | null }[];
  product_image_generations?: GenRow[];
}

function mapAdminProduct(r: AdminProductRow): AdminProduct {
  const inv = Array.isArray(r.inventory) ? r.inventory[0] : r.inventory;
  const prices = r.product_variants
    .filter((v) => v.is_active)
    .map((v) => v.price);
  const tags = r.product_tags
    .map((pt) => (Array.isArray(pt.tags) ? pt.tags[0] : pt.tags)?.slug)
    .filter((s): s is string => Boolean(s));
  const images = [...(r.product_images ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  const gen = [...(r.product_image_generations ?? [])].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  )[0];
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    brand: r.brand,
    gender: r.gender,
    concentration: r.concentration,
    scentFamilies: r.scent_families ?? [],
    seasons: r.seasons ?? [],
    description: r.description,
    notesDescription: r.notes_description ?? "",
    usageDescription: r.usage_description ?? "",
    shortDescription: r.short_description ?? "",
    images,
    variants: [...r.product_variants]
      .sort((a, b) => a.ml - b.ml)
      .map((v) => ({
        ml: v.ml,
        price: v.price,
        isActive: v.is_active,
      })),
    notesTop: r.notes_top,
    notesHeart: r.notes_heart,
    notesBase: r.notes_base,
    originCountry: r.origin_country,
    releaseYear: r.release_year,
    bottlePrice: r.bottle_price,
    bottleMl: r.bottle_ml,
    salePct: r.sale_pct,
    isActive: r.is_active,
    startingPrice: prices.length ? Math.min(...prices) : 0,
    availableMl: inv ? inv.on_hand_ml - inv.reserved_ml : 0,
    // Kept alongside `availableMl` because the products list now owns stock
    // management outright: an operator correcting ml downward has to see how
    // much is already reserved, or the floor rejection reads as arbitrary.
    onHandMl: inv?.on_hand_ml ?? 0,
    reservedMl: inv?.reserved_ml ?? 0,
    lowStockMl: inv?.low_stock_ml ?? DEFAULT_LOW_STOCK_ML,
    tags,
    // Filled by the callers' separate custom-tags query (audit R2 — an
    // embedded select would fail wholesale on a DB without 0035).
    customTags: [],
    imageUrl: images.find((i) => i.is_visible !== false)?.url ?? null,
    hiddenImageCount: images.filter((i) => i.is_visible === false).length,
    referenceImageUrl: r.reference_image_url ?? null,
    imageStatus: gen?.status ?? "none",
    imageResultUrl: gen?.result_url ?? null,
    imageGenId: gen?.id ?? null,
    imagePrompt: gen?.prompt ?? "",
    imageError: gen?.error ?? null,
  };
}

/**
 * Hard cap on the catalogue fetch. This query had no `.limit()` at all, which
 * does not mean "everything" — it means PostgREST's `db-max-rows` silently
 * truncates. An explicit cap plus `productsWereCapped` makes the ceiling
 * visible instead: the shop is told rather than quietly shown fewer goods.
 */
export const ADMIN_PRODUCTS_CAP = 2000;

export async function getAdminProducts(): Promise<AdminProduct[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("products")
    .select(ADMIN_PRODUCT_SELECT)
    .order("created_at", { ascending: false })
    .limit(ADMIN_PRODUCTS_CAP);
  return ((data as unknown as AdminProductRow[] | null) ?? []).map(
    mapAdminProduct,
  );
}

/** True when the catalogue is larger than one `getAdminProducts()` page. */
export async function productsWereCapped(): Promise<boolean> {
  const supabase = await createClient();
  if (!supabase) return false;
  const { count } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true });
  return (count ?? 0) > ADMIN_PRODUCTS_CAP;
}

export async function getAdminProduct(
  id: string,
): Promise<AdminProduct | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("products")
    .select(ADMIN_PRODUCT_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const product = mapAdminProduct(data as unknown as AdminProductRow);

  // Separate tolerant query (audit R2): a DB without 0035 still edits fine,
  // just without the custom-tag picker preselection.
  const { data: ctRows } = await supabase
    .from("product_custom_tags")
    .select("custom_tags ( slug )")
    .eq("product_id", id);
  if (ctRows) {
    product.customTags = (
      ctRows as unknown as {
        custom_tags: { slug: string } | { slug: string }[] | null;
      }[]
    )
      .map(
        (r) =>
          (Array.isArray(r.custom_tags) ? r.custom_tags[0] : r.custom_tags)
            ?.slug,
      )
      .filter((s): s is string => Boolean(s));
  }
  return product;
}

export async function getCustomerDetail(id: string): Promise<{
  profile: ProfileRow;
  orders: OrderRow[];
  ledger: { id: string; delta: number; reason: string; created_at: string }[];
} | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  const profile = data as ProfileRow | null;
  if (!profile) return null;

  const [{ data: orders }, { data: ledger }] = await Promise.all([
    supabase
      .from("orders")
      .select("*")
      .eq("user_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("loyalty_ledger")
      .select("id, delta, reason, created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return {
    profile,
    orders: (orders as OrderRow[] | null) ?? [],
    ledger:
      (ledger as
        | { id: string; delta: number; reason: string; created_at: string }[]
        | null) ?? [],
  };
}

export async function getCoupons(): Promise<CouponRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("coupons")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as CouponRow[] | null) ?? [];
}

export interface ReportData {
  totalRevenue: number;
  /** Зардал: эх савнуудын үнэ + бүх restock-ийн худалдан авсан үнэ. */
  totalCost: number;
  /** Борлуулалт − зардал. */
  profit: number;
  paidOrders: number;
  topProducts: { name: string; brand: string; qty: number; revenue: number }[];
  topBrands: { brand: string; revenue: number }[];
  /** Paid sales per calendar month, newest first. `month` is "YYYY-MM". */
  monthly: {
    month: string;
    revenue: number;
    orders: number;
    /** Source ml sold that month — what the bottles actually gave up. */
    ml: number;
  }[];
}

export async function getReportData(): Promise<ReportData> {
  const supabase = await createClient();
  const empty: ReportData = {
    totalRevenue: 0,
    totalCost: 0,
    profit: 0,
    paidOrders: 0,
    topProducts: [],
    topBrands: [],
    monthly: [],
  };
  if (!supabase) return empty;

  // Every figure below is a SQL aggregate (0046). Summing these in JS meant
  // fetching every paid order_item, every order, every product price and every
  // restock row — each capped by a `.limit()` or by PostgREST's db-max-rows,
  // so the profit the shop plans on was silently wrong past the cap.
  const [
    { data: totals },
    { data: monthly },
    { data: products },
    { data: brands },
  ] = await Promise.all([
    callRpc<
      { total_revenue: number; paid_orders: number; total_cost: number }[]
    >(supabase, "admin_report_totals", {}),
    callRpc<{ month: string; revenue: number; orders: number; ml: number }[]>(
      supabase,
      "admin_report_monthly",
      {},
    ),
    callRpc<{ name: string; brand: string; qty: number; revenue: number }[]>(
      supabase,
      "admin_report_top_products",
      { p_limit: 10 },
    ),
    callRpc<{ brand: string; revenue: number }[]>(
      supabase,
      "admin_report_top_brands",
      {},
    ),
  ]);

  const t = totals?.[0];
  if (!t) return empty;

  return {
    totalRevenue: t.total_revenue,
    totalCost: t.total_cost,
    profit: t.total_revenue - t.total_cost,
    paidOrders: t.paid_orders,
    topProducts: products ?? [],
    topBrands: brands ?? [],
    monthly: monthly ?? [],
  };
}

/** A home rail as the admin edits it — product ids only, in their order. */
export interface AdminHomeSection extends HomeSectionRow {
  productIds: string[];
}

export async function getAllHomeSections(): Promise<AdminHomeSection[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("home_sections")
    .select("*, home_section_products ( product_id, sort_order )")
    .order("sort_order", { ascending: true });

  return (
    (data as unknown as
      | (HomeSectionRow & {
          home_section_products: { product_id: string; sort_order: number }[];
        })[]
      | null) ?? []
  ).map((row) => ({
    ...row,
    productIds: [...row.home_section_products]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((p) => p.product_id),
  }));
}

export async function getAllFaqs(): Promise<FaqRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("faqs")
    .select("*")
    .order("sort_order", { ascending: true });
  return (data as FaqRow[] | null) ?? [];
}

export async function getAllBlogPosts(): Promise<BlogPostRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("blog_posts")
    .select("*")
    .order("published_at", { ascending: false });
  return (data as BlogPostRow[] | null) ?? [];
}
