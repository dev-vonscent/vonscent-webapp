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
/**
 * Үнэртний төрөл нь 0085-аас хойш `concentrations` хүснэгтийн мөр (админ
 * удирддаг), enum биш — тиймээс энэ нь зүгээр л түүний `code` текст.
 * `DEFAULT_CONCENTRATIONS` (constants) нь зөвхөн seed/demo-гийн жагсаалт.
 */
export type Concentration = string;
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
/**
 * Үнэрийн хүч (0078). Концентраци нь савны төрөл болохоос хүч биш тул quiz-ийн
 * эрчмийн тэнхлэг үүнийг уншина — sillage-ийг админ гараар тохируулна.
 */
export type Sillage = "light" | "medium" | "strong";
export type CouponType = "percent" | "fixed";
/** Lucky wheel (0053; `none` and `order` — 0128). */
export type SpinPrizeKind =
  | "points"
  | "coupon_percent"
  | "coupon_fixed"
  | "bundle"
  | "none";
export type SpinTier = "common" | "rare" | "grand";
export type SpinType = "free" | "paid" | "order";
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
  notes_top: string[];
  notes_heart: string[];
  notes_base: string[];
  gender: Gender;
  concentration: Concentration;
  /** Үнэр хэр хол мэдрэгдэх вэ (0078) — quiz-ийн эрчмийн эх сурвалж. */
  sillage: Sillage;
  /** Үнэр барилт (0083) — админы бичсэн чөлөөт текст, ж: «4-6 цаг». */
  longevity: string | null;
  scent_families: ScentFamily[];
  origin_country: string | null;
  release_year: number | null;
  seasons: Season[];
  bottle_price: number;
  bottle_ml: number;
  rating_avg: number;
  rating_count: number;
  /** `status === 'active'`-тай үргэлж тэнцүү (0125 trigger + check). */
  is_active: boolean;
  /** Барааны амьдралын мөчлөг (0125) — `PRODUCT_STATUSES`. */
  status: "hidden" | "coming_soon" | "active";
  /** Анх худалдаанд гарсан мөч (0125); хэзээ ч гараагүй бол null. */
  launched_at: string | null;
  /** «Тун удахгүй» үеийн ойролцоо хугацаа, ж: «10-р сарын сүүлээр» (0125). */
  coming_soon_note: string | null;
  /**
   * Декант цутгах савны өнгө (0145). null = хүйсээр (`defaultVialStyle`).
   */
  vial_style: VialStyle | null;
  /** «Онцлох бараа» (0055) — нүүрийн 'featured' хэсэг эндээс автоматаар уншина. */
  is_featured: boolean;
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
  /** Үндсэн үнэ — админы гараар бичсэн (0027). Хямдралгүй үед төлөх дүн. */
  price: number;
  /**
   * Хямдарсан үнэ (0054). null бол хямдрал байхгүй. Байвал энэ нь бодитоор
   * төлөх дүн — `variant_price()` үүнийг эхэлж авна.
   */
  sale_price: number | null;
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

/** Админы удирддаг үнэртний төрөл (0085_concentrations.sql). */
export interface ConcentrationRow {
  id: string;
  /** «EDP» — `products.concentration` энэ утгыг хадгална. */
  code: string;
  /** «Eau de Parfum». Хоосон байж болно. */
  label: string;
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
  /**
   * Багцын хямдралын өмнөх барааны дүн — sum(list_price * qty), 0097.
   * `gross_subtotal − subtotal` нь багцын хямдрал. Хуучин захиалгад null.
   */
  gross_subtotal: number | null;
  shipping_fee: number;
  discount: number;
  loyalty_used: number;
  total: number;
  coupon_code: string | null;
  /** "yyyy-MM-dd" (UB) the customer picked at checkout — 0052_order_deliver_on. */
  deliver_on: string | null;
  reserve_expires_at: string | null;
  /** Ажилтан бэлдсэн (грамлаж, уутласан) цаг — 0099. NULL = бэлдэгдээгүй. */
  prepared_at: string | null;
  prepared_by: string | null;
  qpay_invoice_id: string | null;
  /**
   * Opaque key for /pay/<token> — 0068. `order_no` is a sequence, so it can
   * never be the payment page's key.
   */
  pay_token: string;
  /**
   * Checkout-ийн сагсны хуулбар (0124) — төлөгдөөгүй бол «Дараа захиалах»
   * руу шилжүүлэхэд. Төлөгдсөн / цуцлагдсан мөчид trigger арилгана.
   */
  checkout_snapshot: Record<string, unknown> | null;
  /**
   * `cancelled → pending` сэргээлт бүрт нэмэгдэнэ (0146) — нөөцийн
   * хөдөлгөөний event_key-д орно.
   */
  lifecycle_cycle: number;
  /** Захиалах мөчид хасагдсан бэлэг (0146). */
  omitted_gifts: OmittedGift[] | null;
  /** Хэрэглэсэн барааны нөхцөлийг зөвшөөрсөн цаг (0153). */
  used_goods_consent_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Захиалах мөчид ороогүй бэлгийн дээж — босго эсвэл 1ml сав дууссан. */
export interface OmittedGift {
  product_id: string;
  reason: "threshold" | "vial" | "stock";
}

/**
 * QPay invoice artefacts for one order — 0068. Its own table because `qr_image`
 * (~10KB) and the 23 bank deeplinks (~5KB) would otherwise ride along in every
 * `select *` on `orders`.
 */
export interface QpayInvoiceRow {
  order_id: string;
  /**
   * NULL нь «мөрийг эзэмшсэн боловч QPay хараахан хариулаагүй» (0086) — нэг
   * захиалгад хоёр бодит invoice үүсэхийг хаадаг эзэмшлийн мөр. Уншигч бүр
   * түүнийг invoice гэж БИШ, хийгдэж байгаа ажил гэж үзэх ёстой.
   */
  invoice_id: string | null;
  qr_text: string | null;
  /** Bare base64 PNG, exactly as QPay returns it (no `data:` prefix). */
  qr_image: string | null;
  short_url: string | null;
  deeplinks: { name: string; description?: string; logo?: string; link: string }[];
  amount: number;
  /** Мөрийг эзэмшсэн мөч — хуучирсан эзэмшлийг булаахад хэрэглэгдэнэ (0086). */
  claimed_at: string;
  created_at: string;
}

/**
 * Идемпотентын түлхүүр — нэг checkout оролдлого = нэг UUID (0087). `order_id`
 * NULL байхад «ялагч захиалгаа үүсгэж байна» гэсэн үг.
 */
export interface OrderRequestRow {
  request_id: string;
  order_id: string | null;
  created_at: string;
}

/**
 * QPay-ийн PAID гүйлгээний мөр (0089). Буцаалт гараар хийгддэг тул
 * `qpay_payment_id` нь операторын QPay портал дээрх хайлтын түлхүүр ба
 * маргаантай төлбөрийн нотолгоо.
 */
export interface QpayPaymentRow {
  qpay_payment_id: string;
  order_id: string;
  amount: number;
  currency: string | null;
  paid_at: string | null;
  wallet: string | null;
  raw: Record<string, unknown>;
  created_at: string;
}

/**
 * Буцаалтын данс (0108) — хэрэглэгч төлсөн захиалгаа цуцлахад бичнэ,
 * админ буцаалт хийсний дараа устгагдана.
 */
export interface OrderRefundAccountRow {
  order_id: string;
  bank: string;
  account_number: string;
  holder_name: string;
  created_at: string;
}

interface OrderItemBase {
  id: string;
  order_id: string;
  product_name: string;
  /** Үнэртэнд брэнд, нэмэлт бараанд ангиллын нэр (0146). */
  brand: string;
  unit_price: number;
  /** Хямдраагүй нэгж үнэ (0097). Багцын гишүүнд л unit_price-аас их. */
  list_price: number | null;
  qty: number;
  is_sample: boolean;
  line_total: number;
  collection_id: string | null;
  collection_name: string | null;
  is_gift: boolean;
  /** Зарсан мөчийн хувилбарын нэр: «Хар», «18 / 100ml» (0146). */
  variant_label: string | null;
  /** Зарсан мөчийн зураг (0146) — нэмэлт бараанд. */
  image_url: string | null;
  /** Энэ мөрөнд түгжсэн хоосон сав ба түүний төлөв (0146). */
  vial_id: string | null;
  vial_state: OrderItemStockState | null;
}

/** Нөөцийн төлөв: reserved → committed (хүргэгдэх) | released (0146). */
export type OrderItemStockState = "reserved" | "committed" | "released";

/** Декантын мөр — ml-тэй. */
export interface PerfumeOrderItemRow extends OrderItemBase {
  line_kind: "perfume";
  product_id: string | null;
  variant_id: string | null;
  ml: number;
  extra_variant_id: null;
  extra_product_id: null;
  extra_inventory_mode: null;
  extra_state: null;
  restocked_qty: 0;
}

/** Нэмэлт барааны мөр (0146) — ml-гүй, үнэртэнтэй холбоогүй. */
export interface ExtraOrderItemRow extends OrderItemBase {
  line_kind: "extra";
  product_id: null;
  variant_id: null;
  ml: null;
  extra_variant_id: string;
  extra_product_id: string;
  extra_inventory_mode: ExtraInventoryMode;
  extra_state: OrderItemStockState;
  /** Хүргэгдсэний дараах буцаалтад нөөцөд буцаасан ширхэг (эцсийн нийт). */
  restocked_qty: number;
}

/** `line_kind`-аар салбарладаг — `ml`-ийг шалгахгүйгээр бүү уншаарай. */
export type OrderItemRow = PerfumeOrderItemRow | ExtraOrderItemRow;

export interface CouponRow {
  id: string;
  code: string;
  /**
   * Non-null = personal coupon: listed only to this customer, but any signed-in
   * customer who knows the code may redeem it (shared, 0104).
   */
  user_id: string | null;
  /** Set when the coupon was granted automatically for an order (0025). */
  source_order_id: string | null;
  /** Set when a campaign issued it, e.g. the sign-up coupon (0135). */
  campaign_id?: string | null;
  type: CouponType;
  value: number;
  min_subtotal: number;
  /** Shop-wide cap. Always set on a personal coupon (0104 check). */
  max_uses: number | null;
  /** Per-account cap, counted from coupon_redemptions (0025). */
  max_uses_per_user: number | null;
  used_count: number;
  /** Generated: shop-wide cap reached (0119). Read-only. */
  used_up: boolean;
  /** Cap on a percent coupon's ₮ discount (0053). null = uncapped. */
  max_discount: number | null;
  /** Who issued it: 'manual' | 'spin' (0053) | 'campaign' (0135). */
  source: string;
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
  /** Order cancelled → coupon given back; the row stays as the log (0104). */
  cancelled_at: string | null;
}

/** A curated home page rail (0023_home_sections). */
export interface HomeSectionRow {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  /**
   * 'manual' = hand-picked list, 'tag' = everything carrying `tag`,
   * 'featured' = every product the admin marked «Онцлох» (0055).
   */
  kind: "manual" | "tag" | "featured" | "extras";
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

/** One segment of the lucky wheel (0053). Staff-only — `weight` is shop economics. */
export interface SpinWheelPrizeRow {
  id: string;
  /** Position on the wheel, clockwise from 12 o'clock. */
  slot: number;
  label: string;
  short_label: string;
  kind: SpinPrizeKind;
  tier: SpinTier;
  /** points → V; coupon_percent → %; coupon_fixed → ₮; bundle → шир. */
  value: number;
  min_subtotal: number;
  max_discount: number | null;
  /** Relative draw weight — the shop's odds, never sent to the client. */
  weight: number;
  /** Global per-month issue cap; null = unlimited. */
  monthly_cap: number | null;
  /** Where a capped draw is redirected to. */
  fallback_slot: number | null;
  is_active: boolean;
  created_at: string;
}

/** One spin. Prize fields are snapshots so history survives a prize edit. */
export interface SpinWheelSpinRow {
  id: string;
  user_id: string;
  prize_id: string | null;
  slot: number;
  label: string;
  kind: SpinPrizeKind;
  tier: SpinTier;
  value: number;
  spin_type: SpinType;
  points_spent: number;
  coupon_id: string | null;
  /** `order` spins only — whose credit it consumed (0129). */
  credit_order_id: string | null;
  /** Physical prizes only — set when the admin has handed it over. */
  fulfilled_at: string | null;
  created_at: string;
}

export interface OrderStatusHistoryRow {
  id: string;
  order_id: string;
  status: OrderStatus;
  note: string;
  changed_by: string | null;
  created_at: string;
}

/** A marketing campaign (0135). Dates are UB calendar days, inclusive. */
export interface CampaignRow {
  id: string;
  type: "signup_coupon";
  name: string;
  description: string;
  is_active: boolean;
  /** `YYYY-MM-DD`: starts at 00:00:00 UB. */
  starts_on: string;
  /** `YYYY-MM-DD`: ends at 23:59:59 UB. */
  ends_on: string;
  /** ₮, fixed-amount coupon. */
  coupon_value: number;
  min_subtotal: number;
  coupon_valid_days: number;
  coupons_per_user: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** One customer's grant from a campaign — once per account and per phone. */
export interface CampaignGrantRow {
  id: string;
  campaign_id: string;
  user_id: string | null;
  phone: string | null;
  /** When the customer saw the welcome popup; null = not yet. */
  notified_at: string | null;
  created_at: string;
}

/** A suggested perfume the shop doesn't carry yet (0137) — one row per perfume. */
export interface PerfumeRequestRow {
  id: string;
  brand_id: string | null;
  brand_name: string;
  perfume_name: string;
  /** `concentrations.code`; null = the customer didn't know. */
  concentration: string | null;
  /** `perfume_request_key(brand, name)` — dedupe key. */
  match_key: string;
  vote_count: number;
  last_voted_at: string;
  created_at: string;
}

/** One customer's vote for a suggested perfume. */
export interface PerfumeRequestVoteRow {
  request_id: string;
  user_id: string;
  note: string | null;
  created_at: string;
}

// ── Нэмэлт бараа ба савны тоон нөөц (0145, extras-shop-plan §5) ─────────

/** Савны өнгө — `BOTTLE_STYLES` (constants) ба SQL check-тэй ижил. */
export type VialStyle = "black" | "pink" | "silver";

/** Нөөцийн горим: ангилал+горим (0153) → бараа → хувилбар composite FK-аар. */
export type ExtraInventoryMode =
  | "local_quantity"
  | "shared_vial"
  | "leftover_liquid";

export type ExtraProductStatus = "draft" | "published" | "archived";

export interface ExtraCategoryRow {
  id: string;
  slug: string;
  name: string;
  image_url: string | null;
  sort: number;
  is_active: boolean;
}

/** Ангилалд зөвшөөрөгдсөн горим (0153) — анхааруулга, зөвшөөрөл горим тус бүрт. */
export interface ExtraCategoryModeRow {
  category_id: string;
  inventory_mode: ExtraInventoryMode;
  notice: string;
  requires_consent: boolean;
}

export interface ExtraProductRow {
  id: string;
  category_id: string;
  /** Ганц горимтой ангилалд trigger сонгоно; «Шилтэй ус»-д заавал (0153). */
  inventory_mode: ExtraInventoryMode;
  slug: string;
  name: string;
  description: string;
  images: string[];
  status: ExtraProductStatus;
  /** leftover_liquid: эх үнэртэн, үлдсэн ба бүтэн савны ml. */
  product_id: string | null;
  remaining_ml: number | null;
  full_ml: number | null;
  /**
   * Зөвхөн дэлгэцийн утга — тооцоонд оролцохгүй. `bottle_ml`: хоосон/бүтэн
   * шилний бүтэн хэмжээ («0/125ml», 0153). `capacity` нь v4-ийн хайрцгийн
   * «хэдэн шил багтах» (v5-д засахгүй).
   */
  attrs: { capacity?: number; bottle_ml?: number };
  sort: number;
  created_at: string;
  updated_at: string;
}

export interface ExtraVariantRow {
  id: string;
  extra_id: string;
  inventory_mode: ExtraInventoryMode;
  label: string;
  price: number;
  /** Зөвхөн `extra_stock_move`-оор өөрчлөгдөнө (guard trigger). */
  on_hand_qty: number;
  reserved_qty: number;
  /** shared_vial-д л. */
  vial_id: string | null;
  is_active: boolean;
  sort: number;
  updated_at: string;
  /** Хоосон/бүтэн шилний batch code (0153). */
  batch_code: string | null;
  image_url: string | null;
  /** Чөлөөт хэмжээ/тохирох тайлбар (0153). */
  size_note: string | null;
}

export type StockMovementKind =
  | "set"
  | "purchase"
  | "adjust"
  | "reserve"
  | "release"
  | "commit"
  | "restock";

export interface ExtraMovementRow {
  id: number;
  extra_variant_id: string;
  kind: StockMovementKind;
  delta_on_hand: number;
  delta_reserved: number;
  order_item_id: string | null;
  event_key: string | null;
  note: string;
  actor: string | null;
  created_at: string;
  /** `purchase`-д л (0153): нэгж үнэ, нийт = delta × нэгж, авсан өдөр (УБ). */
  unit_cost: number | null;
  cost: number | null;
  purchased_on: string | null;
}

export interface VialRow {
  id: string;
  /** 1ml, 2ml сав өнгөгүй (null). */
  style: VialStyle | null;
  ml: 1 | 2 | 5 | 10 | 20;
  /** null = тоолж эхлээгүй (зарах боломж хязгааргүй). */
  on_hand: number | null;
  reserved: number;
  low_threshold: number;
  is_active: boolean;
  note: string;
  updated_by: string | null;
  updated_at: string;
}

export interface VialMovementRow {
  id: number;
  vial_id: string;
  kind: StockMovementKind;
  delta_on_hand: number;
  delta_reserved: number;
  order_item_id: string | null;
  event_key: string | null;
  note: string;
  actor: string | null;
  created_at: string;
  /** `purchase`-д л (0153): нэгж үнэ, нийт = delta × нэгж, авсан өдөр (УБ). */
  unit_cost: number | null;
  cost: number | null;
  purchased_on: string | null;
}

export type LeftoverLockState = "listed" | "reserved" | "committed" | "released";

export interface LeftoverLiquidLockRow {
  extra_product_id: string;
  locked_ml: number;
  state: LeftoverLockState;
  order_item_id: string | null;
  updated_at: string;
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
      // status ба is_active-ийн аль нэгийг өгөхөд хангалттай — нөгөөг нь
      // trigger бөглөнө (0125); launched_at-ийг ч trigger тавина.
      products: Table<
        ProductRow,
        | "id"
        | "created_at"
        | "updated_at"
        | "status"
        | "is_active"
        | "launched_at"
        | "coming_soon_note"
        | "vial_style"
      >;
      product_images: Table<ProductImageRow, "id">;
      product_variants: Table<ProductVariantRow, "id" | "sale_price">;
      inventory: Table<InventoryRow, "updated_at">;
      tags: Table<TagRow, "id">;
      scent_families: Table<ScentFamilyRow, "created_at">;
      concentrations: Table<
        ConcentrationRow,
        "id" | "label" | "sort_order" | "is_active" | "created_at"
      >;
      profiles: Table<ProfileRow, "created_at" | "updated_at">;
      addresses: Table<AddressRow, "id" | "created_at">;
      orders: Table<
        OrderRow,
        | "id"
        | "order_no"
        | "created_at"
        | "updated_at"
        | "lifecycle_cycle"
        | "omitted_gifts"
        | "used_goods_consent_at"
      >;
      order_items: Table<OrderItemRow, "id">;
      order_refund_accounts: Table<OrderRefundAccountRow, "created_at">;
      coupons: Table<CouponRow, "id" | "created_at" | "used_up">;
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
      spin_wheel_prizes: Table<SpinWheelPrizeRow, "id" | "created_at">;
      spin_wheel_spins: Table<SpinWheelSpinRow, "id" | "created_at">;
      campaigns: Table<
        CampaignRow,
        | "id"
        | "description"
        | "is_active"
        | "min_subtotal"
        | "coupons_per_user"
        | "created_by"
        | "created_at"
        | "updated_at"
      >;
      campaign_grants: Table<
        CampaignGrantRow,
        "id" | "phone" | "notified_at" | "created_at"
      >;
      perfume_requests: Table<
        PerfumeRequestRow,
        | "id"
        | "brand_id"
        | "concentration"
        | "vote_count"
        | "last_voted_at"
        | "created_at"
      >;
      perfume_request_votes: Table<PerfumeRequestVoteRow, "note" | "created_at">;
      extra_categories: Table<
        ExtraCategoryRow,
        "id" | "image_url" | "sort" | "is_active"
      >;
      extra_category_modes: Table<
        ExtraCategoryModeRow,
        "notice" | "requires_consent"
      >;
      extra_products: Table<
        ExtraProductRow,
        | "id"
        | "inventory_mode"
        | "description"
        | "images"
        | "status"
        | "product_id"
        | "remaining_ml"
        | "full_ml"
        | "attrs"
        | "sort"
        | "created_at"
        | "updated_at"
      >;
      extra_variants: Table<
        ExtraVariantRow,
        | "id"
        | "inventory_mode"
        | "label"
        | "on_hand_qty"
        | "reserved_qty"
        | "vial_id"
        | "is_active"
        | "sort"
        | "updated_at"
        | "batch_code"
        | "image_url"
        | "size_note"
      >;
      extra_movements: Table<
        ExtraMovementRow,
        "id" | "created_at" | "unit_cost" | "cost" | "purchased_on"
      >;
      vials: Table<VialRow, "id" | "updated_at">;
      vial_movements: Table<
        VialMovementRow,
        "id" | "created_at" | "unit_cost" | "cost" | "purchased_on"
      >;
      leftover_liquid_locks: Table<LeftoverLiquidLockRow, "updated_at">;
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
      // jsonb: { ok, reason? } — 0073.
      mark_order_refunded: { Args: Record<string, unknown>; Returns: unknown };
      recompute_rating: { Args: Record<string, unknown>; Returns: undefined };
      release_order_points: { Args: Record<string, unknown>; Returns: number };
      release_due_points: { Args: Record<string, unknown>; Returns: number };
      grant_reward_coupon: { Args: Record<string, unknown>; Returns: string };
      spin_wheel: { Args: Record<string, unknown>; Returns: unknown };
      spin_wheel_state: { Args: Record<string, unknown>; Returns: unknown };
      // { campaignId, count, value } | null — 0135.
      grant_signup_coupons: {
        Args: { p_user: string; p_phone?: string | null };
        Returns: unknown;
      };
      // { requestId, isNew, isNewVote, voteCount } | null — 0137.
      submit_perfume_request: {
        Args: {
          p_user: string;
          p_brand: string;
          p_name: string;
          p_concentration?: string | null;
          p_note?: string | null;
          p_brand_id?: string | null;
        };
        Returns: unknown;
      };
      merge_perfume_requests: {
        Args: { p_source: string; p_target: string };
        Returns: number;
      };
      launch_product: {
        Args: { p_id: string };
        Returns: "launched" | "already_active" | "not_coming_soon" | "not_found";
      };
    };
    Enums: {
      user_role: UserRole;
      gender_t: Gender;
      order_status_t: OrderStatus;
      payment_method_t: PaymentMethod;
      payment_status_t: PaymentStatus;
      tag_kind_t: TagKind;
      product_status_t: ProductRow["status"];
      coupon_type_t: CouponType;
      spin_prize_kind_t: SpinPrizeKind;
      spin_prize_tier_t: SpinTier;
      spin_type_t: SpinType;
    };
    CompositeTypes: Record<string, never>;
  };
}
