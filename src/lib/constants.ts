/**
 * Centralized magic values (development.md §7.7).
 */

export const SITE = {
  name: "vonscent",
  domain: "vonscent.mn",
  url: "https://vonscent.mn",
  description:
    "Үнэртэн бага хэмжээгээр (decant) туршиж сонгох дэлгүүр — 2/5/10/20ml багц.",
  tagline: "Үнэрээ ол",
} as const;

/**
 * The ml decant sizes the store sells — the complete list. 2ml is the sample
 * size, an ordinary purchasable tier like the rest (client decision, see
 * docs/analysis/questions.md №1); the admin prices each size per product and
 * leaves a size inactive where it makes no sense. The DB enforces the same
 * closed set (0031_sample_tier_back.sql).
 */
export const ML_SIZES = [2, 5, 10, 20] as const;
export type MlSize = (typeof ML_SIZES)[number];

/**
 * Bundles price over every size the shop sells — 2ml is an ordinary tier, so a
 * bundle can be built out of 2ml decants too (client decision).
 */
export const BUNDLE_ML_SIZES = ML_SIZES;

/** Size a fresh bundle starts on — the most common decant tier. */
export const DEFAULT_BUNDLE_ML = 5;

/** Reserve hold (minutes) for orders awaiting payment before auto-release. */
export const RESERVE_TIMEOUT_MINUTES = 30;

/**
 * Сар бүрийн бэлгийн sample (questions.md №2–3): one 1ml pick per full
 * 200,000₮ of goods value — coupon discount subtracted, shipping excluded.
 * 200k → 1 pick, 400k → 2 picks, and so on.
 */
export const GIFT_THRESHOLD = 200_000;
export const GIFT_SAMPLE_ML = 1;

export const GENDERS = ["male", "female", "unisex"] as const;
export type Gender = (typeof GENDERS)[number];

export const CONCENTRATIONS = [
  "EDP",
  "EDT",
  "Parfum",
  "EDC",
  "Extrait",
  "Elixir",
] as const;
export type Concentration = (typeof CONCENTRATIONS)[number];

export const GENDER_LABEL: Record<Gender, string> = {
  male: "Эрэгтэй",
  female: "Эмэгтэй",
  unisex: "Unisex",
};

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "shipping",
  "delivered",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Хүлээгдэж буй",
  confirmed: "Баталгаажсан",
  shipping: "Хүргэгдэж буй",
  delivered: "Хүргэгдсэн",
  cancelled: "Цуцлагдсан",
};

/**
 * Shipping zones (seed/fallback only — the storefront reads settings.shipping
 * so the admin's A10 configuration is what customers actually pay).
 *
 * `deliverable: false` marks a zone we cannot serve at all (requirement_fb.md:
 * "бүс сонговол хүргэлт хийх боломжгүй байдлаар" — Налайх, Шарга морьт, 22
 * товчоо г.м.). `remote: true` marks countryside zones, where the customer is
 * reminded to name the bus/transport pickup point.
 */
export const SHIPPING_ZONES: readonly ShippingZoneConfig[] = [
  {
    code: "A",
    name: "А бүс (хотын төв)",
    fee: 7000,
    deliverable: true,
    remote: false,
    // Баянгол, Сүхбаатар, Чингэлтэй, Хан-Уул
    areas: ["MN1107", "MN1119", "MN1125", "MN1122"],
  },
  {
    code: "B",
    name: "Б бүс (алслагдсан хороолол)",
    fee: 9000,
    deliverable: true,
    remote: false,
    // Баянзүрх, Сонгинохайрхан
    areas: ["MN1110", "MN1116"],
  },
  {
    code: "C",
    name: "В бүс (захын хороолол)",
    fee: 10000,
    deliverable: true,
    remote: false,
    // Хороо түвшний бүс: админ Тохиргоо хуудсаар тодорхой хороодыг Б-ээс
    // энд өргөнө (Шарга морьт, 22 товчоо орчмын зуслан бол X рүү).
  },
  { code: "R", name: "Орон нутаг", fee: 9000, deliverable: true, remote: true },
  {
    code: "X",
    name: "Хүргэлт хийхгүй",
    fee: 0,
    deliverable: false,
    remote: false,
    // Налайх, Багануур, Багахангай
    areas: ["MN1113", "MN1101", "MN1104"],
  },
];

export interface ShippingZoneConfig {
  /**
   * Stable identifier (A/B/C/R/X) — what gets stored on `orders.ship_zone` and
   * matched against, so the admin can rename or re-price a zone without
   * breaking historical orders or the checkout lookup. `name` is display only.
   */
  code: string;
  name: string;
  fee: number;
  /** false = we do not deliver here; checkout blocks the order. */
  deliverable: boolean;
  /** true = countryside; remind the customer to pick a transport point. */
  remote: boolean;
  /**
   * adm2 p-codes (optionally `code:khoroo`) covered by this zone — the admin
   * fills these in on the Тохиргоо page and checkout then picks the zone from
   * the address (todo.md B5b). Absent = manual selection only.
   */
  areas?: string[];
}

export const PAYMENT_METHODS = [
  { value: "qpay", label: "QPay (QR код)" },
  { value: "bank_transfer", label: "Банк шилжүүлэг" },
] as const;

/**
 * Seeded scent families. The live list lives in the `scent_families` table and
 * the admin adds/removes rows there (Тохиргоо → Үнэрийн төрөл); these are the
 * rows 0018_scent_families.sql inserts, reused as the demo-mode catalogue and
 * as a label fallback when a product references a family that was deleted.
 */
export const DEFAULT_SCENT_FAMILIES = [
  { slug: "floral", label: "Цэцэгт", iconUrl: "/family-floral.png" },
  { slug: "woody", label: "Модлог", iconUrl: "/family-woody.png" },
  { slug: "fresh", label: "Сэргэг", iconUrl: "/family-fresh.png" },
  { slug: "oriental", label: "Дорнын", iconUrl: "/family-oriental.png" },
  { slug: "citrus", label: "Цитрус", iconUrl: "/family-citrus.png" },
  { slug: "spicy", label: "Халуун", iconUrl: "/family-spicy.png" },
] as const;

export const SEASONS = ["spring", "summer", "autumn", "winter", "all"] as const;
export type Season = (typeof SEASONS)[number];

export const SEASON_LABEL: Record<Season, string> = {
  spring: "Хавар",
  summer: "Зун",
  autumn: "Намар",
  winter: "Өвөл",
  all: "Бүх улирал",
};

export const ROLES = [
  "guest",
  "customer",
  "courier",
  "operator",
  "super_admin",
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  guest: "Зочин",
  customer: "Хэрэглэгч",
  courier: "Хүргэгч",
  operator: "Оператор",
  super_admin: "Супер админ",
};
