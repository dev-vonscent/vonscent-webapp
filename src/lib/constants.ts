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
 * closed set (0031b_sample_tier_back.sql).
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
 * Доод хязгаар (ml) — шинэ бараа энэ утгаас эхэлнэ.
 *
 * Боломжит үлдэгдэл нь энэ тооноос доош ороход бараа «Бага» болж, хяналтын
 * самбарт сэрэмжлүүлэг гарна. 20ml байсныг 50 болгов: 20ml гэдэг нь ганцхан
 * 20ml decant-ын хэмжээ, өөрөөр хэлбэл сэрэмжлүүлэг нь сүүлчийн захиалга
 * гарсны дараа асдаг байсан — гааль, тээврийн хугацааг бодоход дахин
 * захиалахад хэтэрхий орой. Админ бараа тус бүрээр нь өөрчилж болно.
 */
export const DEFAULT_LOW_STOCK_ML = 50;

/**
 * Бэлгийн 1мл дээж (questions.md №2–3): one pick per full 200,000₮ of goods
 * value — coupon discount subtracted, shipping excluded. 200k → 1 pick,
 * 400k → 2 picks, and so on. Дээж нь зөвхөн админы бэлгийн сангаас гарна
 * (backlog A2); сан нь сар бүр солигддог гэсэн үүрэг байхгүй.
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
 * The live table is хороо-level: the client's sheet prices all 204 хороо one by
 * one (docs/delivery/delivery-zones-ub-template.csv, built into
 * settings.shipping by scripts/build-shipping-settings.ts). Restating that here
 * would be 204 keys nobody reads and a second copy to keep in step, so this
 * seed stays at district granularity — a sane default for an environment that
 * has no settings row yet, never a substitute for the imported table.
 *
 * `deliverable: false` marks a zone we cannot serve at all (requirement_fb.md:
 * "бүс сонговол хүргэлт хийх боломжгүй байдлаар"). It starts empty: which
 * хороо are refused is a client decision that arrives with the sheet.
 * `remote: true` marks countryside zones, where the customer is reminded to
 * name the bus/transport pickup point.
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
    // энд өргөнө.
  },
  {
    code: "R",
    name: "Орон нутаг",
    fee: 9000,
    deliverable: true,
    remote: true,
    // Налайх, Багануур, Багахангай — хотын дүүрэг ч илгээмж унаагаар явдаг тул
    // орон нутгийн үнээр бодогдоно (клиентийн 2026-09 залруулга). Бусад аймаг
    // энд бичигдэхгүй: Улаанбаатараас гадуурх хаяг checkout дээр өөрөө энэ
    // бүсэд унана (features/checkout/api.ts ruralFallback).
    areas: ["MN1113", "MN1101", "MN1104"],
  },
  {
    code: "X",
    name: "Хүргэлт хийхгүй",
    fee: 0,
    deliverable: false,
    remote: false,
    areas: [],
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

/**
 * Гарах үед Supabase-ийн хариуг хэр удаан хүлээх вэ (мс).
 *
 * Сессийг сервер тал дээр хүчингүй болгох нь зөв — гэхдээ тэр дуудлага
 * саатсанаас болж хэрэглэгч гарч чадахгүй байх нь буруу. Хугацаа дуусвал
 * cookie-г ямар ч тохиолдолд устгаад цааш явна (`/api/auth/sign-out`).
 */
export const SIGN_OUT_TIMEOUT_MS = 2_500;

/**
 * Хайлт эхлэх хамгийн богино урт (backlog H1.3).
 *
 * Нэг үсгээр хайхад бараг бүх каталог таардаг — хэрэглэгчид ямар ч мэдээлэл
 * өгөхгүй, сервер рүү үсэг дарах бүрд дэмий хүсэлт явна. Мөн trigram индекс
 * 3 тэмдэгтээс богино хэвийн дээр ажиллахгүй тул хязгаар нь техникийн ч
 * утгатай.
 */
export const MIN_SEARCH_LENGTH = 2;

/** Глобал хайлтын нэг төрөлд ногдох илэрцийн тоо. */
export const SEARCH_LIMIT_PER_KIND = 5;

/**
 * Бүтээгдэхүүний хуудсанд нэг удаад харуулах сэтгэгдлийн тоо.
 *
 * Эхний багц нь сервер талд рендерлэгдэж (SEO, ISR-д кэшлэгдэнэ), үлдсэнийг нь
 * «Цааш үзэх» товч клиентээс татна — өмнө нь бүх сэтгэгдлийг хязгааргүй татаж
 * байсан. Хоёр баганат grid-д жигд дүүрэхээр 6.
 */
export const REVIEWS_PAGE_SIZE = 6;

/**
 * Сэтгэгдлийн текстийн дээд урт.
 *
 * Зориуд богино: сэтгэгдэл нь бүтээгдэхүүний хуудсанд нэг харцаар уншигдах
 * богино сэтгэгдэл байх ёстой, эссэ биш. Zod (client + server) ба DB check
 * гурвуулаа энэ утгыг барина (0072).
 */
export const REVIEW_BODY_MAX = 200;

/**
 * Дундаж захиалгын дүн (AOV) — зөвхөн **тооцооны таамаг**, дүрэм биш.
 *
 * Азын хүрдний эдийн засаг (docs/lucky-wheel.md §3) бүхэлдээ үүн дээр
 * тулгуурладаг: хувиар хөнгөлөх купоны бодит үнэ нь сагснаас хамаарна.
 * 2026-09-07-оос хойш хүрдний хувийн купонд дээд хязгаар байхгүй болсон тул
 * админ дээрх «дундаж шагнал / эргэлт» тооцоо үүнгүйгээр 5% ба 10% купоныг
 * 0₮ гэж үнэлж, тоог дуугүйхэн дорд харуулах байсан.
 */
export const ASSUMED_AOV = 80_000;

/**
 * Банкны шилжүүлгийн данс — «bank_transfer» захиалгын төлбөрийн хуудсанд.
 *
 * Хуудсанд шигтгэсэн байснаас энд гарсан: төлбөрийн заавар нь агуулга биш,
 * тохиргоо. Утгууд нь клиентээс бодит данс ирэх хүртэлх түр зуурын байршуулагч
 * бөгөөд солиход зөвхөн энэ мөрүүд өөрчлөгдөнө.
 */
export const BANK_TRANSFER = {
  bank: "Хаан банк",
  account: "5000 1234 5678",
  holder: "Вонсэнт ХХК",
} as const;

/**
 * Барааны хуудасны «Төстэй бараа» хэсгийн DOM id.
 *
 * Хоёр компонент хуваалцдаг: хуудас өөрөө үүнийг зүүж, `ProductPurchase`-ийн
 * мобайл наалдсан зурвас үүнийг ажигладаг — тэр хэсэг дэлгэцэд ороход зурвас
 * өөрөө арилдаг (өөр барааны карт дээр энэ барааны «Захиалах» суух нь замд ч
 * саад, утга нь ч буруу). Тиймээс мөрөнд бичсэн шидэт утга биш, нэг эх сурвалж.
 */
export const RELATED_SECTION_ID = "related-products";
