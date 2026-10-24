/**
 * Centralized magic values (development.md §7.7).
 */

export const SITE = {
  name: "vonscent",
  domain: "vonscent.mn",
  // Canonical host — vonscent.mn 308-redirects here, so every absolute URL
  // (canonical, og:url, JSON-LD) points at www to avoid a redirect hop.
  url: "https://www.vonscent.mn",
  description:
    "Von Scent — дэлхийн шилдэг оригинал үнэртнүүдийг 2, 5, 10, 20 мл-ээр туршиж, өөрийн үнэрээ олоорой",
  tagline: "Үнэрээ ол",
  /**
   * Брэндийн бичигдэх нэр — Facebook хуудасны нэртэй ижил (клиент, 2026-09 UG).
   * Хайлтад харагдах бүх газарт (title, og:site_name, JSON-LD) үүнийг
   * хэрэглэнэ: зөвхөн «vonscent» гэж бичвэл Google «von scent» (зайтай)
   * хайлтыг сайттай холбодоггүй. Лого/UI дахь жижиг «vonscent» нь `name`.
   */
  brandName: "Von Scent",
  /** JSON-LD `alternateName` — Google-ийн site name-д хувилбар болгон өгнө. */
  alternateNames: ["vonscent", "VonScent", "vonscent.mn"],
  /**
   * Сайтын ерөнхий share зураг (og:image) — линк Messenger/Facebook-д
   * илгээхэд, Google-ийн thumbnail-д гарна. `public/`-д байрлах, вэб дээр
   * хаана ч харагддаггүй тусгай зураг; 1200×630 (1.91:1).
   */
  ogImage: { url: "/og-image.jpg", width: 1200, height: 630 },
  /**
   * `ogImage`-ийн 1:1 хос — Google хайлтын дөрвөлжин thumbnail-д зориулсан,
   * нүүр хуудасны JSON-LD `primaryImageOfPage`. Мөн вэб дээр харагддаггүй.
   */
  searchImage: { url: "/og-image-square.jpg", width: 1200, height: 1200 },
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

/**
 * Нүүрний decant visualizer-т «≈ N шүршилт» гэж харуулах ойролцоо тоо.
 * 1мл ≈ 15 шүршилт (клиентийн тоо: 2/5/10/20мл → 30/75/150/300) —
 * маркетингийн тооцоо, захиалга/үнэд оролцохгүй.
 */
export const SPRAYS_PER_ML = 15;

/**
 * FAQ-ийн тогтмол ангилал (клиент, 2026-09 UG) — нийтийн FAQ хуудас ийм
 * дарааллаар бүлэглэнэ. Админы «Ангилал» нь чөлөөт текст биш select, API нь
 * Zod enum-оор шалгана (`lib/validators/faq.ts`).
 */
export const FAQ_CATEGORIES = [
  "Decant гэж юу вэ",
  "Хэмжээ ба багц",
  "Захиалга ба төлбөр",
  "Хүргэлт",
  "Цуцлалт ба буцаалт",
  "V point ба бэлэг",
] as const;
export type FaqCategory = (typeof FAQ_CATEGORIES)[number];

/**
 * Сурталчилгааны popup-ийн зар хэнд харагдах вэ. «Бүртгүүлээд купон аваарай»
 * мэтийг нэвтэрсэн хэрэглэгчид харуулбал дарахад middleware нүүр рүү буцаадаг
 * тул зарыг зочин / гишүүнээр ялгана. Хадгалагдсан хуучин зар = `all`.
 */
export const POPUP_AUDIENCES = {
  all: "Бүгд",
  guests: "Зөвхөн зочин",
  members: "Зөвхөн нэвтэрсэн",
} as const;
export type PopupAudience = keyof typeof POPUP_AUDIENCES;

/**
 * «Туршиж үзэх» шошготой хэмжээ (ус ба багцын хэмжээний товч дээр). Зөвхөн
 * UI санал — 2ml нь sample биш, бусадтай адил энгийн хэмжээ.
 */
export const TRIAL_SIZE_ML: MlSize = 2;

/**
 * «Шинэ» таг автомат: хамгийн сүүлд ХУДАЛДААНД ГАРСАН (`launched_at`, 0125)
 * ийм тооны идэвхтэй ус. Шинэ ус гарахад хамгийн хуучин нь гарна. DB дээр
 * `refresh_new_tag()` (0100, 0125) ижил тоогоор ажилладаг тул хоёуланг нь
 * зэрэг сольно.
 */
export const NEW_PRODUCTS_COUNT = 12;

/**
 * Барааны амьдралын мөчлөг (`products.status`, 0125). `is_active` нь
 * `status === "active"`-тай DB-ийн trigger-ээр үргэлж тэнцүү.
 *
 *   hidden      — сайтад огт харагдахгүй;
 *   coming_soon — барааны хуудас, нүүрний «Тун удахгүй» хэсэгт харагдана,
 *                 захиалж болохгүй. Зөвхөн хэзээ ч худалдаанд гарч байгаагүй
 *                 бараа (`launched_at` хоосон) энэ төлөвт орж чадна;
 *   active      — зарагдана.
 */
export const PRODUCT_STATUSES = ["hidden", "coming_soon", "active"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const PRODUCT_STATUS_LABEL: Record<ProductStatus, string> = {
  hidden: "Нуусан",
  coming_soon: "Тун удахгүй",
  active: "Идэвхтэй",
};

/** «Тун удахгүй» үеийн ойролцоо хугацааны текстийн дээд урт (DB check-тэй ижил). */
export const COMING_SOON_NOTE_MAX = 120;

/**
 * Каталогийн анхны эрэмбэ: `sort` параметргүй URL. Энэ утгыг сонгоход URL-аас
 * `sort` хасагдана. «Санал болгох» = Эрэлттэй → Шинэ → Онцлох → бусад (0115).
 */
export const DEFAULT_CATALOG_SORT = "recommended";

/**
 * Каталогийн нэг ачаалалт (эхний серверийн render ба доош гүйлгэх бүр).
 * 24 нь 2/3/4 баганын аль алинд нь хуваагддаг тул ачаалал бүрийн заагт хоосон
 * нүд үлдэхгүй.
 */
export const CATALOG_PAGE_SIZE = 24;

/**
 * «Эрэлттэй» таг автомат: төлөгдсөн захиалгаар хамгийн их зарагдсан ийм тооны
 * идэвхтэй ус. DB дээр `hot_product_ids()` (0101_auto_hot_tag.sql) ижил
 * тоогоор ажилладаг.
 */
export const HOT_PRODUCTS_COUNT = 12;

/**
 * Багцын «Шинэ» / «Эрэлттэй» таг автомат (админ тавихаа больсон): хамгийн
 * сүүлд нэмэгдсэн / төлөгдсөн захиалгаар хамгийн их зарагдсан ийм тооны
 * идэвхтэй багц (0122).
 *
 * «Шинэ» нь хамгийн сүүлийн 3 багц (клиент, 2026-10): «Шинээр ирсэн» rail
 * 9 ус + 3 багц, 4 дэх шинэ багц нь «Шинэ»-ээс хасагдана.
 */
export const NEW_COLLECTIONS_COUNT = 3;
export const HOT_COLLECTIONS_COUNT = 6;

/**
 * Нүүрний «Эрэлттэй» rail-ийн багцын тоо — 12 нүднээс 9 ус + 3 багц
 * (клиент, 2026-10). Зарагдсан багц дутвал бусдаас санамсаргүй нөхнө.
 */
export const HOT_RAIL_COLLECTIONS = 3;

/**
 * «Онцлох» — ус, багц нийлээд хамгийн ихдээ ийм тоо (0144_featured_rolling).
 * Хэтэрвэл хамгийн эрт онцлох болсон нь DB-д автоматаар хасагдана — SQL-ийн
 * `offset 12`-тэй ижил байх ёстой.
 */
export const FEATURED_LIMIT = 12;

/** Size a fresh bundle starts on — the smallest (2ml) tier. */
export const DEFAULT_BUNDLE_ML = 2;

/**
 * Reserve hold (minutes) for orders awaiting payment before auto-release.
 *
 * 30 биш 35: `release_expired_reserves` (pg_cron, 5 минут тутам) нь захиалгыг
 * QPay-ээс асуулгүйгээр цуцалдаг. Төлбөр тулгалт (`/api/cron/reconcile-
 * payments`, мөн 5 минут тутам) цуцлалтаас ӨМНӨ дор хаяж нэг удаа ажилласан
 * байхыг баталгаажуулах зөрүү — эс тэгвээс алдагдсан callback-тай төлбөр
 * хэзээ ч олдохгүйгээр цуцлагдана.
 *
 * Хэрэглэгчид энэ тоог төлбөрийн хуудас, захиалгын имэйл хоёр хэлнэ.
 */
export const RESERVE_TIMEOUT_MINUTES = 35;

/**
 * Төлбөрийн хуудсан дээр хэрэглэгчид хэлэх хугацаа (клиент, 2026-10). Бодит
 * цуцлалт нь `RESERVE_TIMEOUT_MINUTES` — дээрх 5 минутын зөрүү нь тулгалтын
 * дотоод нөөц тул хэрэглэгчид дугуй 30 гэж хэлнэ.
 */
export const PAYMENT_WINDOW_MINUTES = 30;

/** «Дараа авахаар хадгалах» — хэрэглэгч бүрийн дээд тоо (0116). Хуучнаас нь хасна. */
export const SAVED_CHECKOUTS_MAX = 10;

/**
 * Хэрэглэгчийн хүсэлтээр цуцалсан, төлсөн захиалгын буцаалтаас хасагдах
 * банкны шимтгэл, % — НИЙТ дүнгээс (хүргэлт орсон; цуцлах хугацаа нь
 * хүргэлтэд гарахаас өмнө тул хүргэлтийн төлбөр ч буцаагдана). Клиент,
 * 2026-09-30. Дүнг `refundBreakdown()` (src/lib/refund.ts) бодно.
 */
export const REFUND_FEE_PCT = 1;

/**
 * QPay-ийн шимтгэл, % — QPay-ээр төлөх захиалгын НИЙТ дүнгээс (хүргэлт
 * орсон). Ашгийн тайлан зардал болгон хасна (0111_report_finance). Клиент,
 * 2026-10-01.
 */
export const QPAY_FEE_PCT = 1;

/**
 * Буцаалтын данс сонгох банкууд. QPay нь зөвхөн картын гүйлгээг буцаадаг
 * тул бусад төлбөрийг админ энэ данс руу гараар шилжүүлнэ.
 */
export const MN_BANKS = [
  "Хаан банк",
  "Голомт банк",
  "Худалдаа хөгжлийн банк",
  "Хас банк",
  "Төрийн банк",
  "Капитрон банк",
  "Богд банк",
  "Ариг банк",
  "Тээвэр хөгжлийн банк",
  "Чингис хаан банк",
  "Үндэсний хөрөнгө оруулалтын банк",
  "М банк",
] as const;

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

/**
 * Эрхийн дээд хязгаар. Босго нь шугаман тул 5М₮-ийн захиалга 25 ширхэг 1мл
 * шаардах байсан — сан тэр болгоныг даахгүй, савлах ажил ч боломжгүй. 8 нь
 * 1.6М₮ дээр дүүрнэ; түүнээс дээш дүн эрх нэмэхгүй (2026-09-29: 5 → 8).
 * 4 устай сан × `GIFT_PER_PRODUCT_LIMIT` (2) = 8 тул хамгийн бага сан ч
 * бүтэн эрхийг даана.
 */
export const GIFT_MAX_SAMPLES = 8;

/**
 * Нэг уснаас хамгийн ихдээ хэдэн 1мл дээж. Сан цөөн устай үед (4 ус / 5 эрх)
 * давхардал зөвшөөрөхгүй бол хэрэглэгчийн эрх чимээгүй үрэгддэг; хязгааргүй
 * зөвшөөрвөл нэг ус хурдан дуусаж бэлгийн олон янз байдал алдагдана.
 */
export const GIFT_PER_PRODUCT_LIMIT = 2;

export const GENDERS = ["male", "female", "unisex"] as const;
export type Gender = (typeof GENDERS)[number];

/**
 * Үнэртний төрөл нь 0085-аас хойш админы удирддаг `concentrations` хүснэгт —
 * шинэ ус ирэхэд админ өөрөө бүртгэдэг тул хаалттай жагсаалт байхаа больсон.
 * Доорх нь зөвхөн seed/demo-гийн өгөгдмөл ба шинэ барааны анхдагч сонголт.
 */
export const DEFAULT_CONCENTRATIONS = [
  { code: "Extrait", label: "Extrait de Parfum" },
  { code: "Parfum", label: "Parfum" },
  { code: "Elixir", label: "Elixir" },
  { code: "EDP", label: "Eau de Parfum" },
  { code: "EDT", label: "Eau de Toilette" },
  { code: "EDC", label: "Eau de Cologne" },
  { code: "Eau Fraiche", label: "Eau Fraîche" },
  { code: "Perfume Oil", label: "Үнэрийн тос" },
  { code: "Attar", label: "Attar" },
  { code: "Body Mist", label: "Body Mist" },
  { code: "Hair Mist", label: "Hair Mist" },
] as const;

/** Шинэ барааны форм хоосон эхлэхгүйн тулд. */
export const DEFAULT_CONCENTRATION = "EDP";

/** Товчлолын урт — админ формын input болон Zod хоёр нэг хязгаартай. */
export const CONCENTRATION_CODE_MAX = 40;
export const CONCENTRATION_LABEL_MAX = 80;

export const GENDER_LABEL: Record<Gender, string> = {
  male: "Эрэгтэй",
  female: "Эмэгтэй",
  unisex: "Unisex",
};

/**
 * Шинэ бараа нэмэхэд галерейд сонгож нэмдэг савны зураг. Эх хувь нь
 * Storage-ийн `bottles/<style>.webp` (scripts/upload-bottle-images.ts),
 * формын урьдчилан харах зураг нь `public/bottles/`.
 */
export const BOTTLE_STYLES = ["black", "pink", "silver"] as const;
export type BottleStyle = (typeof BOTTLE_STYLES)[number];

export const BOTTLE_STYLE_LABEL: Record<BottleStyle, string> = {
  black: "Хар сав",
  pink: "Ягаан сав",
  silver: "Мөнгөлөг сав",
};

/**
 * Галерей дахь савны зургийн хуулбарын нэр (`addBottleImage`). Дэлгүүр түүнийг
 * тайрахгүй, бүтнээр нь харуулахад ашиглана.
 */
export const BOTTLE_IMAGE_URL_RE = /\/bottle-[0-9a-f-]{36}\.webp$/;

export const BOTTLE_STYLE_PREVIEW: Record<BottleStyle, string> = {
  black: "/bottles/black-bottle.png",
  pink: "/bottles/pink-bottles.jpg",
  silver: "/bottles/silver-bottle.png",
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
 * Төлвийн чипний өнгө. Дөрвөн файлд ижилхэн бичигдсэн байсан (хэрэглэгчийн
 * захиалгын жагсаалт, дэлгэрэнгүй, /order/[token]) — админы хэсэгт бол огт
 * өнгөгүй (жагсаалт) эсвэл гурван утгад л буурсан (дэлгэрэнгүй, confirmed/
 * shipping/delivered бүгд ижил ногоон) байв. Нэг эх сурвалж болгов.
 */
export const ORDER_STATUS_STYLE: Record<OrderStatus, string> = {
  pending: "bg-amber-500/15 text-amber-500",
  confirmed: "bg-sky-500/15 text-sky-500",
  shipping: "bg-violet-500/15 text-violet-400",
  delivered: "bg-emerald-500/15 text-emerald-500",
  cancelled: "bg-red-500/20 text-red-400",
};

/**
 * Бэлдсэн эсэхийг (orders.prepared_at, 0099) солиж болох төлвүүд. Хүлээгдэж
 * буй нь төлөгдөөгүй, хүргэгдсэн/цуцлагдсан нь хаагдсан.
 */
export const PREPARABLE_ORDER_STATUSES = [
  "confirmed",
  "shipping",
] as const satisfies readonly OrderStatus[];

/** `/admin/orders?status=` дээрх төлөв биш шүүлт: баталгаажсан + бэлдээгүй. */
export const UNPREPARED_FILTER = "unprepared";

export const PAYMENT_STATUSES = ["unpaid", "paid", "refunded"] as const;
export type PaymentStatusValue = (typeof PAYMENT_STATUSES)[number];

/**
 * Төлбөрийн төлвийн шошго. Захиалгын төлөв нь `ORDER_STATUS_LABEL`-аар нэг
 * эх сурвалжтай байхад төлбөрийн төлөв нь дөрвөн файлд гараар хуулсан ижил
 * ternary байсан — админы хүснэгт, админы дэлгэрэнгүй, төлвийн хяналт,
 * хэрэглэгчийн дэлгэрэнгүй. Тохиолдлоор л таарч байсан тул энд төвлөрүүлэв.
 */
export const PAYMENT_STATUS_LABEL: Record<PaymentStatusValue, string> = {
  unpaid: "Төлөөгүй",
  paid: "Төлсөн",
  refunded: "Буцаагдсан",
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

/**
 * Үнэрийн хүч (0078) — quiz-ийн эрчмийн тэнхлэг. Тайлбарууд нь «Алийг нь
 * илүүд үзэх вэ?» асуултын хариултуудтай нэг мөр байх ёстой: админ бөглөхдөө
 * хэрэглэгчийн сонголттой ижил шалгуур барина.
 */
export const SILLAGES = ["light", "medium", "strong"] as const;
export type Sillage = (typeof SILLAGES)[number];

export const SILLAGE_LABEL: Record<Sillage, string> = {
  light: "Сул",
  medium: "Дундаж",
  strong: "Хүчтэй",
};

export const SILLAGE_HINT: Record<Sillage, string> = {
  light: "Ойртоход л мэдрэгдэнэ",
  medium: "Хажуугаар зөрөхөд мэдрэгдэнэ",
  strong: "Өрөөнд орж ирэхэд анзаарагдана",
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

/** Хайлтын талбаруудын (header, глобал панель, каталог) нэгдсэн placeholder. */
export const SEARCH_PLACEHOLDER = "Үнэртэн, багц, брэнд хайх";

/** Багц үүсгэгчид зөвхөн ус сонгогдоно — багц дотор багц орохгүй. */
export const BUILDER_SEARCH_PLACEHOLDER = "Үнэртэн, брэнд хайх";

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
 *
 * ⚠️ **Доорх данс нь ЖИШИГ, бодит биш.** Одоогоор худалдан авагчид хүрдэггүй:
 * checkout нь `paymentMethod: "qpay"`-г хатуу дамжуулдаг тул шилжүүлгийн
 * захиалга үүсэх зам байхгүй (клиентийн шийдвэр, 2026-09-13). Шилжүүлгийг
 * нээхийн ӨМНӨ энэ гурван утгыг бодит данс болгоно — эс бөгөөс мөнгө байхгүй
 * данс руу явна.
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

/**
 * API-д хүсэлтийн хязгаар (backlog §2.1) — бодлого бүр «цонх тутам хэдэн
 * хүсэлт» гэж уншигдана. Хэрэгжилт нь GCRA (0076_rate_limits.sql): цонхны
 * дотор `limit` хүсэлтийг цуваагаар нь зөвшөөрч, дараа нь `windowSec / limit`
 * тутамд нэгийг дусаана.
 *
 * Утгууд нь **энгийн хэрэглэгчийн хамгийн идэвхтэй үеэс** дээгүүр байхаар
 * сонгогдсон: Монголд гар утасны операторууд NAT ард олон захиалагчийг нэг
 * IP-ээр гаргадаг тул нэвтрээгүй цэгүүд (quiz, coupon) өгөөмөр байх ёстой.
 * Хатуулах шаардлагатай бол Sentry дээрх 429-ийн тоог эхлээд хар.
 */
export const RATE_LIMITS = {
  /** Холбоо барих форм — нэг хүн өдөрт хэд ч бичихгүй. */
  contact: { limit: 3, windowSec: 10 * 60 },
  /** Имэйл бүртгэл/цуцлалт — данстай хэрэглэгч, спам утга учиргүй. */
  newsletter: { limit: 5, windowSec: 60 * 60 },
  /** Купон шалгах — код таах оролдлогыг сааруулна (checkout-д debounce бий). */
  coupon: { limit: 20, windowSec: 60 },
  /** Сэтгэгдэл — нэг хэрэглэгч бараа тутамд нэгийг л үлдээдэг. */
  review: { limit: 10, windowSec: 60 * 60 },
  /** Захиалга — reserve/RPC хамгийн үнэтэй зам, гэхдээ дахин оролдлого элбэг. */
  order: { limit: 10, windowSec: 10 * 60 },
  /** Quiz — нэвтрэхгүйгээр ажилладаг, каталогийн хайлт хийдэг тул хямд биш. */
  quiz: { limit: 30, windowSec: 5 * 60 },
  /**
   * Зураг байршуулалт — sharp боловсруулалт CPU/Storage-д хамгийн үнэтэй.
   * Зөвхөн үйлчлүүлэгчийн хавтас (avatar): ажилтны хавтас role шалгалтаар
   * хаалттай бөгөөд бараа олноор оруулах урсгалыг зогсоох ёсгүй.
   */
  upload: { limit: 30, windowSec: 10 * 60 },
  /**
   * verify.mn MO-SMS сесс нээх — нэг дугаарт. Гадны үйлчилгээ рүү залгадаг
   * цорын ганц нээлттэй цэг тул хоёр тэнхлэгээр хэмжинэ. Сесс ~5 минут амьдардаг
   * бөгөөд хэрэглэгч СМС-ээ өөрөө илгээдэг: 10 минутад 3 удаа эхлүүлэх нь
   * «код ирсэнгүй, дахин эхлүүлье» гэсэн жинхэнэ урсгалд хангалттай.
   */
  verifyStartPhone: { limit: 3, windowSec: 10 * 60 },
  /** Мөн IP-ээр: дугаар солиод л дахин эхлүүлэхээс сэргийлнэ. */
  verifyStartIp: { limit: 10, windowSec: 10 * 60 },
  /**
   * Захиалга хайх (`/order/find`). `order_no` нь дараалсан sequence тул энэ
   * цэг нь хамгийн тод тандалтын гадаргуу: хязгаар нь утас таах оролдлогыг
   * утгагүй болгох ёстой. Жинхэнэ хэрэглэгч 1-2 удаа л бичнэ.
   */
  orderLookup: { limit: 10, windowSec: 10 * 60 },
  /**
   * Төлбөрийн төлөв асуух (`/api/payments/status`). Хуудас өөрөө 3 секунд
   * тутам асуудаг тул өгөөмөр байх ёстой — гэхдээ `verify=1` нь QPay руу
   * гадагш дуудлага хийдэг учир хязгааргүй байж болохгүй.
   */
  paymentStatus: { limit: 120, windowSec: 5 * 60 },
  /**
   * QPay-ийн callback. Нэг захиалгад QPay нэг л ping илгээдэг бөгөөд
   * алдаа гарвал дахин оролддог — хэдхэн дуудлага. Хязгаар нь нууц алдагдсан
   * үеийн хоёр дахь давхарга: дуудалт бүр QPay руу гадагш `payment/check`
   * илгээдэг тул хязгааргүй байх ёсгүй.
   */
  qpayWebhook: { limit: 60, windowSec: 5 * 60 },
  /**
   * Шинэ үнэртний санал (0137) — нэвтэрсэн хэрэглэгч, давхар санал тоологдохгүй
   * тул зөвхөн спамын хамгаалалт: жинхэнэ хэрэглэгч өдөрт хэдхэнийг л бичнэ.
   */
  perfumeRequest: { limit: 10, windowSec: 24 * 60 * 60 },
  /**
   * Мэдэгдэл илгээх / хуваарьлах (0138) — staff, гэхдээ нэг товч бүх
   * хэрэглэгч рүү очдог тул андуурч олон дарахаас хамгаална.
   */
  broadcastSend: { limit: 10, windowSec: 60 * 60 },
  /** «Надад туршиж илгээх» — зөвхөн өөртөө, засах явцад хэд хэдэн удаа. */
  broadcastTest: { limit: 30, windowSec: 10 * 60 },
} as const;

export type RateLimitName = keyof typeof RATE_LIMITS;

/**
 * Танилцуулга (`/about`) ба Блог (`/blog`) хуудсууд түр нуугдсан эсэх
 * (клиентийн шийдвэр, 2026-09-13).
 *
 * Цэс, footer, sitemap, хайлтын үр дүнгээс холбоосуудыг нь аль хэдийн хассан;
 * энэ тугийг route бүр шалгаж, шууд URL-ээр орох замыг 404 болгоно. Хуудсуудыг
 * эргүүлж нээхэд үүнийг `false` болгоод холбоосуудыг нь буцааж тавина.
 *
 * Төрлийг зориуд `boolean` гэж бичив: literal `true` бол TypeScript доорх
 * кодыг хүрэшгүй гэж үзээд narrowing-оо алддаг.
 */
export const CONTENT_PAGES_HIDDEN: boolean = true;

export interface FeatureFlagMeta {
  /** Админы «Feature flag» хуудсанд харагдах нэр. */
  label: string;
  /** Асаахад юу нээгдэх вэ — UI, API, trigger/cron. */
  description: string;
}

/**
 * Feature flag-ийн жагсаалт (0133, CLAUDE.md «Шинэ feature → prod»).
 *
 * Шинэ feature бүр энд түлхүүрээ нэмж, өөрийн migration-д
 * `insert into feature_flags (key) values ('<key>') on conflict do nothing;`
 * хийнэ. Утга нь САНД (dev/prod тус тусдаа) — энд зөвхөн нэр. Feature нээгдэж
 * тогтворжсоны дараа тугийг кодоос ба сангаас хамт устгана.
 *
 * Жишээ:
 *   tier_list: {
 *     label: "Tier list",
 *     description: "Хэрэглэгчийн зэрэглэл: /account цэс, API, оноо олгох trigger.",
 *   },
 */
export const FEATURE_FLAGS = {
  lucky_wheel: {
    label: "Азын хүрд",
    description:
      "/lucky-wheel хуудас, цэс ба купоны холбоосууд, /api/lucky-wheel, төлөгдсөн захиалгаас эрх олгох trigger (0134). Эргүүлэх ажиллагаа нь Азын хүрдний «Идэвхтэй» тохиргоогоор тусдаа.",
  },
  campaigns: {
    label: "Кампанит ажил",
    description:
      "Админ → Маркетинг → Кампанит ажил (/admin/campaigns, /api/admin/campaigns), бүртгүүлэхэд купон олгох RPC (0135), шинэ хэрэглэгчийн мэндчилгээний цонх (/api/campaigns/welcome). Купон олголт нь кампанит ажил бүрийн «Идэвхтэй» тохиргоогоор тусдаа.",
  },
  perfume_requests: {
    label: "Үнэртний санал",
    description:
      "Хэрэглэгч шинэ үнэртэн санал болгох: /request, хайлт хоосон үеийн ба footer/цэсний холбоосууд, /api/perfume-requests, админ /admin/requests (/api/admin/perfume-requests), submit/merge RPC (0137).",
  },
  notifications: {
    label: "Мэдэгдэл",
    description:
      "Header-ийн хонх, toast, /account/notifications, /api/notifications, админ /admin/broadcasts (/api/admin/broadcasts), notify_user/send_broadcast RPC ба хуваарьт илгээлтийн cron (0138), оноо/үнэгүй эрх/захиалгын мэдэгдэл (0139–0141).",
  },
  user_tiers: {
    label: "Хэрэглэгчийн түвшин",
    description:
      "Standard/Gold/Platinum/Sapphire/Ruby: /account/tier хуудас, профайл ба цэсний түвшний хүрээ, сэтгэгдлийн зургийн хүрээ, нүүр хуудасны «Top 3 хэрэглэгч», «Миний захиалга»-ын нийт дүн, /api/account/tier, mark_order_paid-ийн түвшний V point хувь (0143). Унтраалттай үед оноо хуучин settings.loyalty дүрмээр бодогдоно.",
  },
} as const satisfies Record<string, FeatureFlagMeta>;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

/** `FEATURE_FLAGS`-ийг түлхүүрээр унших — жагсаалт хоосон үед ч төрөлтэй. */
export const FEATURE_FLAG_META: Readonly<Record<FeatureFlag, FeatureFlagMeta>> =
  FEATURE_FLAGS;

/**
 * «Миний купон» цэсний «Шинэ» тэмдэг (0104) энэ өдрөөс хойш хэнд ч гарахгүй.
 * Өмнө нь ч хэрэглэгч хуудсыг нэг нээмэгц алга болно (`useNewBadge`).
 * Мэдээ бол түр зуурынх — мөнхөд гялалзах тэмдэг анхаарал татахаа больдог.
 */
/**
 * «Миний купон»-д ашигласан / дууссан купон хэдэн хоног харагдах вэ. Дараа нь
 * жагсаалтаас нуугдана (сангаас устахгүй — админы log, тайланд үлдэнэ).
 * Тоолох эхлэл: ашигласан бол сүүлчийн ашиглалт, дууссан бол `ends_at` эсвэл
 * `deactivated_at` (0120).
 */
export const WALLET_HISTORY_DAYS = 30;

/**
 * Хэрэглэгчийн түвшин (0143, feature flag `user_tiers`). Түвшин нь хадгалагдсан
 * утга биш — нийт худалдан авалтаас (төлөгдсөн, цуцлагдаагүй захиалгын
 * купоны дараах барааны дүн, хүргэлтгүй) тухай бүр бодогдоно.
 *
 * ⚠ `minSpend` ба `rate` нь SQL-ийн `tier_rate_for_spend()`-тэй (0143) үсэг
 * үсгээрээ таарах ёстой — оноог сан бодно, энд зөвхөн харуулах.
 * Өсөх дарааллаар.
 */
export const USER_TIERS = [
  { key: "standard", label: "Standard", minSpend: 0, rate: 1 },
  { key: "gold", label: "Gold", minSpend: 1_000_000, rate: 2 },
  { key: "platinum", label: "Platinum", minSpend: 3_000_000, rate: 3 },
  { key: "sapphire", label: "Sapphire", minSpend: 5_000_000, rate: 4 },
  { key: "ruby", label: "Ruby", minSpend: 10_000_000, rate: 5 },
] as const;

export type UserTierKey = (typeof USER_TIERS)[number]["key"];

/** Түвшний хуудасны топ жагсаалтын урт (7 хоног / сар). */
export const TIER_LEADERBOARD_SIZE = 3;

export const COUPONS_NEW_BADGE_UNTIL = "2026-11-01T00:00:00+08:00";

/** Мэдэгдлийн хонхны panel — эхний хэдэн мөр (хөнгөн). */
export const NOTIFICATION_PANEL_LIMIT = 10;
/** /account/notifications-ийн хуудасны хэмжээ (API-ийн default ч мөн). */
export const NOTIFICATION_PAGE_SIZE = 20;
/** Хонхны poll-ын давтамж ба кэш шинэ байх хугацаа. */
export const NOTIFICATION_POLL_INTERVAL_MS = 60_000;
export const NOTIFICATION_STALE_MS = 30_000;
/** Poll-ын нэг хариунд буцаах уншаагүй мөрийн дээд хэмжээ. */
export const NOTIFICATION_POLL_FRESH_MAX = 20;
/**
 * Poll-ын цонхыг cursor-оос хэр ухрааж эхлүүлэх вэ — урт transaction-ий
 * хоцорсон мөр, app/сангийн цагийн зөрүүг барина (server.ts).
 */
export const NOTIFICATION_POLL_LOOKBACK_MS = 10 * 60_000;
/** Шинэ мэдэгдлийн toast хэр удаан харагдах вэ. */
export const NOTIFICATION_TOAST_DURATION_MS = 6_000;
