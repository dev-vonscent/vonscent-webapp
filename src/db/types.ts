/**
 * Database types.
 *
 * NOTE: In production this file is GENERATED via
 *   pnpm db:types   (supabase gen types typescript --local)
 * The hand-authored version below mirrors supabase/migrations/* so the app is
 * type-safe before a live database exists. Regenerate after any schema change
 * (development.md §7.4).
 */

export type Gender = "male" | "female" | "unisex";
export type Concentration =
  | "EDP"
  | "EDT"
  | "Parfum"
  | "EDC"
  | "Extrait"
  | "Elixir";
/**
 * Scent families are admin-managed rows in `scent_families` (0018), so a
 * family is just its slug — not a closed union. The six below are only the
 * seeded defaults, used as demo-mode data and as fallback labels.
 */
export type ScentFamily = string;
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipping"
  | "delivered"
  | "cancelled";
export type PaymentMethod = "qpay" | "bank_transfer";
export type PaymentStatus = "unpaid" | "paid" | "refunded";
export type TagKind = "new" | "hot" | "sale";
export type Season = "spring" | "summer" | "autumn" | "winter" | "all";
export type CouponType = "percent" | "fixed";
export type UserRole =
  | "guest"
  | "customer"
  | "courier"
  | "operator"
  | "super_admin";

type WithDefaults<Row, Optional extends keyof Row> = Omit<Row, Optional> &
  Partial<Pick<Row, Optional>>;

export interface ProductRow {
  id: string;
  slug: string;
  name: string;
  brand: string;
  /** Part 1 of 4: the perfume and the brand behind it (0022). */
  description: string;
  /** Part 2: what the individual notes smell like. */
  notes_description: string;
  /** Part 3: where and when to wear it. */
  usage_description: string;
  /** Part 4: one-liner for cards, previews and meta tags. */
  short_description: string;
  notes_top: string[];
  notes_heart: string[];
  notes_base: string[];
  gender: Gender;
  concentration: Concentration;
  scent_families: ScentFamily[];
  origin_country: string | null;
  release_year: number | null;
  seasons: Season[];
  bottle_price: number;
  bottle_ml: number;
  /** Display-only discount % (0038) — variant prices stay the charged figure. */
  sale_pct: number;
  rating_avg: number;
  rating_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductImageRow {
  id: string;
  product_id: string;
  url: string;
  alt: string;
  sort_order: number;
  /** Admin's selection of what the storefront shows (0049). */
  is_visible: boolean;
}

export interface ProductVariantRow {
  id: string;
  product_id: string;
  ml: number;
  /** The ₮ price the admin typed (0027) — nothing derives it. */
  price: number;
  is_active: boolean;
}

export interface InventoryRow {
  product_id: string;
  on_hand_ml: number;
  reserved_ml: number;
  low_stock_ml: number;
  is_sold_out: boolean;
  updated_at: string;
}

/** Admin-managed scent family taxonomy (0018_scent_families.sql). */
export interface ScentFamilyRow {
  slug: string;
  label: string;
  icon_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface TagRow {
  id: string;
  slug: string;
  name: string;
  kind: TagKind;
}

export interface ProfileRow {
  id: string;
  full_name: string;
  phone: string | null;
  phone_verified: boolean;
  avatar_url: string | null;
  role: UserRole;
  /** Spendable balance. */
  loyalty_points: number;
  /** Earned but still locked until delivery / the lock window (0024). */
  pending_points: number;
  is_blocked: boolean;
  created_at: string;
  updated_at: string;
}

export interface AddressRow {
  id: string;
  user_id: string;
  label: string;
  recipient: string;
  phone: string;
  city: string;
  district: string | null;
  detail: string;
  is_default: boolean;
  created_at: string;
}

export interface OrderRow {
  id: string;
  order_no: string;
  user_id: string | null;
  status: OrderStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  contact_name: string;
  contact_phone: string;
  contact_email: string | null;
  ship_city: string;
  ship_district: string | null;
  ship_detail: string;
  ship_zone: string | null;
  note: string | null;
  subtotal: number;
  shipping_fee: number;
  discount: number;
  loyalty_used: number;
  total: number;
  coupon_code: string | null;
  reserve_expires_at: string | null;
  qpay_invoice_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  brand: string;
  ml: number;
  unit_price: number;
  qty: number;
  is_sample: boolean;
  line_total: number;
}

export interface CouponRow {
  id: string;
  code: string;
  /** Non-null = personal coupon, usable only by that customer (0020). */
  user_id: string | null;
  /** Set when the coupon was granted automatically for an order (0025). */
  source_order_id: string | null;
  type: CouponType;
  value: number;
  min_subtotal: number;
  max_uses: number | null;
  /** Per-account cap, counted from coupon_redemptions (0025). */
  max_uses_per_user: number | null;
  used_count: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface WishlistRow {
  user_id: string;
  product_id: string;
  created_at: string;
}

export interface ReviewRow {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  body: string;
  created_at: string;
}

export interface SettingRow {
  key: string;
  value: unknown;
  updated_at: string;
}

export interface BlogPostRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  cover_url: string | null;
  category: string;
  tags: string[];
  is_published: boolean;
  published_at: string;
  created_at: string;
  updated_at: string;
}

export interface FaqRow {
  id: string;
  category: string;
  question: string;
  answer: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface NewsletterSubscriberRow {
  id: string;
  email: string;
  created_at: string;
}

export interface LoyaltyLedgerRow {
  id: string;
  user_id: string;
  order_id: string | null;
  delta: number;
  reason: string;
  /** When a locked 'earn' row becomes spendable (0024). */
  available_at: string | null;
  /** false only while an 'earn' row is still locked. */
  released: boolean;
  created_at: string;
}

/** One use of a coupon, backing the per-account cap (0025). */
export interface CouponRedemptionRow {
  id: string;
  coupon_id: string;
  user_id: string | null;
  order_id: string | null;
  created_at: string;
}

/** A curated home page rail (0023_home_sections). */
export interface HomeSectionRow {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  /** 'manual' = hand-picked list, 'tag' = everything carrying `tag`. */
  kind: "manual" | "tag";
  tag: TagKind | null;
  max_items: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface HomeSectionProductRow {
  section_id: string;
  product_id: string;
  sort_order: number;
}

export interface OrderStatusHistoryRow {
  id: string;
  order_id: string;
  status: OrderStatus;
  note: string;
  changed_by: string | null;
  created_at: string;
}

type Table<Row, Optional extends keyof Row> = {
  Row: Row;
  Insert: WithDefaults<Row, Optional>;
  Update: Partial<Row>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      products: Table<ProductRow, "id" | "created_at" | "updated_at" | "sale_pct">;
      product_images: Table<ProductImageRow, "id">;
      product_variants: Table<ProductVariantRow, "id">;
      inventory: Table<InventoryRow, "updated_at">;
      tags: Table<TagRow, "id">;
      scent_families: Table<ScentFamilyRow, "created_at">;
      profiles: Table<ProfileRow, "created_at" | "updated_at">;
      addresses: Table<AddressRow, "id" | "created_at">;
      orders: Table<OrderRow, "id" | "order_no" | "created_at" | "updated_at">;
      order_items: Table<OrderItemRow, "id">;
      coupons: Table<CouponRow, "id" | "created_at">;
      coupon_redemptions: Table<CouponRedemptionRow, "id" | "created_at">;
      home_sections: Table<HomeSectionRow, "id" | "created_at">;
      home_section_products: Table<HomeSectionProductRow, "sort_order">;
      wishlists: Table<WishlistRow, "created_at">;
      reviews: Table<ReviewRow, "id" | "created_at">;
      settings: Table<SettingRow, "updated_at">;
      blog_posts: Table<
        BlogPostRow,
        "id" | "published_at" | "created_at" | "updated_at"
      >;
      faqs: Table<FaqRow, "id" | "created_at">;
      newsletter_subscribers: Table<NewsletterSubscriberRow, "id" | "created_at">;
      loyalty_ledger: Table<LoyaltyLedgerRow, "id" | "created_at">;
      order_status_history: Table<OrderStatusHistoryRow, "id" | "created_at">;
    };
    Views: Record<string, never>;
    Functions: {
      place_order: { Args: Record<string, unknown>; Returns: unknown };
      reserve_inventory: { Args: Record<string, unknown>; Returns: boolean };
      release_inventory: { Args: Record<string, unknown>; Returns: undefined };
      commit_inventory: { Args: Record<string, unknown>; Returns: undefined };
      mark_order_paid: { Args: Record<string, unknown>; Returns: undefined };
      cancel_order: { Args: Record<string, unknown>; Returns: undefined };
      restock_inventory: { Args: Record<string, unknown>; Returns: undefined };
      validate_coupon: { Args: Record<string, unknown>; Returns: unknown };
      update_order_status: { Args: Record<string, unknown>; Returns: undefined };
      mark_order_refunded: { Args: Record<string, unknown>; Returns: undefined };
      recompute_rating: { Args: Record<string, unknown>; Returns: undefined };
      release_order_points: { Args: Record<string, unknown>; Returns: number };
      release_due_points: { Args: Record<string, unknown>; Returns: number };
      grant_reward_coupon: { Args: Record<string, unknown>; Returns: string };
    };
    Enums: {
      user_role: UserRole;
      gender_t: Gender;
      concentration_t: Concentration;
      order_status_t: OrderStatus;
      payment_method_t: PaymentMethod;
      payment_status_t: PaymentStatus;
      tag_kind_t: TagKind;
      coupon_type_t: CouponType;
    };
    CompositeTypes: Record<string, never>;
  };
}
