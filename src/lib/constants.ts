/**
 * Centralized magic values (development.md §7.7).
 */

export const SITE = {
  name: "vonscent",
  domain: "vonscent.mn",
  url: "https://vonscent.mn",
  description:
    "Үнэртэн бага хэмжээгээр (decant) туршиж сонгох дэлгүүр — 5/10/20ml багц.",
  tagline: "Үнэрээ ол",
} as const;

/**
 * The ml decant sizes the store sells — the complete list. The client sells
 * these three and nothing else, so this is a closed set: the admin picks a
 * price for each size, never a new size (0027_manual_pricing.sql enforces the
 * same rule in the DB).
 */
export const ML_SIZES = [5, 10, 20] as const;
export type MlSize = (typeof ML_SIZES)[number];

/** Reserve hold (minutes) for orders awaiting payment before auto-release. */
export const RESERVE_TIMEOUT_MINUTES = 30;

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
  { name: "А бүс (хотын төв)", fee: 6000, deliverable: true, remote: false },
  { name: "Б бүс (алслагдсан хороолол)", fee: 10000, deliverable: true, remote: false },
  { name: "Орон нутаг", fee: 12000, deliverable: true, remote: true },
  { name: "Налайх / Шарга морьт / 22 товчоо", fee: 0, deliverable: false, remote: false },
];

export interface ShippingZoneConfig {
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

/** Free shipping when subtotal ≥ this. */
export const FREE_SHIP_OVER = 150000;

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
