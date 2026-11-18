/**
 * Хэмжээний хямдрал яг одоо хүчинтэй эсэх (0166). SQL-ийн
 * `variant_sale_active()`-ийн толь — хоёулаа зэрэг өөрчлөгдөх ёстой.
 *
 * Хугацаа null бол тэр талдаа хязгааргүй: хоёулаа null = байнгын хямдрал
 * (0054a-ийн хуучин зан). Дуусмагц үнэ өөрөө үндсэн үнэ рүүгээ буцна.
 */
export interface SaleFields {
  price: number;
  sale_price: number | null;
  sale_starts_at?: string | null;
  sale_ends_at?: string | null;
}

export function isSaleActive(v: SaleFields, now: Date = new Date()): boolean {
  if (v.sale_price == null || v.sale_price >= v.price) return false;
  const t = now.getTime();
  if (v.sale_starts_at && new Date(v.sale_starts_at).getTime() > t)
    return false;
  if (v.sale_ends_at && new Date(v.sale_ends_at).getTime() <= t) return false;
  return true;
}

export type SalePhase = "active" | "scheduled" | "ended";

/**
 * Хэмжээний хямдралын төлөв (админы харагдац). `sale_price` мөр хугацаа
 * дууссаны дараа ч САНД ҮЛДДЭГ (0166 — дахин хугацаа тавихад) тул
 * «хямдралтай эсэх»-ийг `sale_price != null`-ээр биш, үүгээр шийднэ.
 * Хямдралгүй (эсвэл үндсэн үнээс багагүй) бол null.
 */
export function salePhase(
  v: SaleFields,
  now: Date = new Date(),
): SalePhase | null {
  if (v.sale_price == null || v.sale_price >= v.price) return null;
  if (isSaleActive(v, now)) return "active";
  if (v.sale_starts_at && new Date(v.sale_starts_at).getTime() > now.getTime())
    return "scheduled";
  return "ended";
}

/** Админы (camelCase) хэмжээний хямдралын талбарууд. */
export interface SaleVariantFields {
  price: number;
  salePrice: number | null;
  saleStartsAt: string | null;
  saleEndsAt: string | null;
}

/** Хэмжээний хямдралын төлөв — `salePhase`-ийн админы (camelCase) хэлбэр. */
export function variantPhase(
  v: SaleVariantFields,
  now: number,
): SalePhase | null {
  return salePhase(
    {
      price: v.price,
      sale_price: v.salePrice,
      sale_starts_at: v.saleStartsAt,
      sale_ends_at: v.saleEndsAt,
    },
    new Date(now),
  );
}

/**
 * Барааны хямдралын төлөв — аль нэг хэмжээ хүчинтэй бол «Хүчинтэй».
 * Дууссан хямдралын `sale_price` санд үлддэг тул (16.1) зөвхөн
 * `salePrice != null`-ээр «хямдралтай» гэж үзэхгүй.
 */
export function productSalePhase(
  p: { variants: SaleVariantFields[] },
  now: number,
): SalePhase | null {
  const phases = p.variants.map((v) => variantPhase(v, now));
  if (phases.includes("active")) return "active";
  if (phases.includes("scheduled")) return "scheduled";
  return phases.includes("ended") ? "ended" : null;
}

/**
 * Одоо эсвэл удахгүй хямдралтай (дууссаныг тооцохгүй). Энд — `"use client"`
 * компонентод биш — байх ёстой: server хуудас (`/admin/sales`) дууддаг.
 */
export function isOnSale(
  p: { variants: SaleVariantFields[] },
  now: number,
): boolean {
  const phase = productSalePhase(p, now);
  return phase === "active" || phase === "scheduled";
}

/** Бодитоор төлөх үнэ — SQL-ийн `variant_price()`. */
export function effectivePrice(v: SaleFields, now: Date = new Date()): number {
  return isSaleActive(v, now) ? (v.sale_price as number) : v.price;
}

/**
 * Хямдарсан үнийг ойрын 100₮ руу тоймлоно (10560 → 10600, 10540 → 10500,
 * 10550 → 10600), үндсэн үнээс давуулахгүй. Гараар бичсэн ч, хувиас
 * бодсон ч (`apply_bulk_sale`) ижил дүрэм.
 */
export function roundSalePrice(sale: number, price: number): number {
  return Math.min(price, Math.round(sale / 100) * 100);
}

/**
 * Админы draft → `product_variants`-ийн хямдралын баганууд. 0 буюу хоосон =
 * хямдрал байхгүй; тэр үед хугацаа ч цэвэрлэгдэнэ (хоосон хямдралд үлдсэн
 * огноо дараагийн хямдралд санамсаргүй үйлчлэхгүй). Мөрийг үргэлж бичих нь
 * чухал — тэгэхгүй бол хямдралыг цуцлах арга байхгүй болно.
 */
export function variantSaleColumns(v: {
  price: number;
  salePrice: number | null;
  saleStartsAt: string | null;
  saleEndsAt: string | null;
}) {
  const on = v.salePrice != null && v.salePrice > 0;
  return {
    sale_price: on ? roundSalePrice(v.salePrice as number, v.price) : null,
    sale_starts_at: on ? v.saleStartsAt : null,
    sale_ends_at: on ? v.saleEndsAt : null,
  };
}

/** Сангийн одоогийн мөр — `saleLinkPatch`-ийн харьцуулалтад. */
export interface StoredSaleColumns {
  sale_price: number | null;
  sale_starts_at: string | null;
  sale_ends_at: string | null;
  sale_id?: string | null;
}

/** Ижил мөч уу — null/undefined хоёулаа «хугацаагүй». */
const sameInstant = (a?: string | null, b?: string | null) =>
  a == null || b == null
    ? (a ?? null) === (b ?? null)
    : Date.parse(a) === Date.parse(b);

/**
 * Нэртэй хямдрал (0188): хэмжээний хямдралыг барааны засвараас ГАРААР
 * өөрчилбөл тэр хэмжээ хямдралаасаа салж (`sale_id = null`) «Нэргүй»
 * болно — эс бөгөөс хямдралын жагсаалт админы бичээгүй үнэ/хугацааг өөрийнх
 * мэт харуулна. Өөрчлөөгүй бол юу ч буцаахгүй (upsert `sale_id`-д хүрэхгүй).
 */
export function saleLinkPatch(
  prev: StoredSaleColumns | undefined,
  next: Pick<
    StoredSaleColumns,
    "sale_price" | "sale_starts_at" | "sale_ends_at"
  >,
): { sale_id: null } | Record<string, never> {
  if (!prev?.sale_id) return {};
  const changed =
    prev.sale_price !== next.sale_price ||
    !sameInstant(prev.sale_starts_at, next.sale_starts_at) ||
    !sameInstant(prev.sale_ends_at, next.sale_ends_at);
  return changed ? { sale_id: null } : {};
}

// ── Дэлгүүрийн харагдац: хувь, дуусах хугацаа (task 2.2, 2.4) ───────────────

/**
 * Нэг хэмжээний хямдралын хувь (бүхэл, 0 = хямдралгүй). `price` нь бодит үнэ
 * (`variant_price` — гар хямдрал + арга хэмжээ). Маш бага зөрүү ч «1%» болно —
 * хямдралтай хэмжээ «0%» гэж харагдахгүй. SQL-ийн толь: `catalog_items.
 * sale_max_pct` (0192) — хоёулаа зэрэг өөрчлөгдөх ёстой.
 */
export function salePct(basePrice: number, price: number): number {
  if (!(basePrice > 0) || !(price < basePrice)) return 0;
  return Math.max(1, Math.round(((basePrice - price) / basePrice) * 100));
}

/**
 * Барааны картын хямдралын товч (task 2.4). Server-ээс тооцоолж
 * `ProductListItem.sale`-д ирнэ.
 */
export interface SaleSummary {
  /** Хямдралтай хэмжээнүүдийн хамгийн бага хувь. */
  minPct: number;
  /** Хамгийн их хувь — «Хямдрал их → бага» эрэмбэ (2.7) мөн үүгээр. */
  maxPct: number;
  /** Идэвхтэй хэмжээ БҮГД хямдралтай эсэх («~» тэмдэг). */
  allSizes: boolean;
  /**
   * Хамгийн ойр дуусах хямдралын мөч (ISO, exclusive) — хугацаагүй бол null.
   * Туг `sale_display` хаалттай үед server огт өгөхгүй (undefined).
   */
  endsAt?: string | null;
}

/**
 * Идэвхтэй хэмжээнүүдээс (үндсэн/бодит үнэ) товч. Нэг ч хэмжээ хямдралгүй
 * бол null.
 */
export function summarizeSale(
  sizes: readonly { basePrice: number; price: number }[],
): Omit<SaleSummary, "endsAt"> | null {
  const pcts = sizes.map((s) => salePct(s.basePrice, s.price));
  const on = pcts.filter((p) => p > 0);
  if (!on.length) return null;
  return {
    minPct: Math.min(...on),
    maxPct: Math.max(...on),
    allSizes: on.length === pcts.length,
  };
}

/**
 * Chip-ийн ард гарах хувь (task 2.4):
 *  - бүх хэмжээ ижил хувьтай → «10%»;
 *  - бүх хэмжээ хямдралтай, хувь өөр → «10–30%»;
 *  - аль нэг хэмжээ хямдралгүй → «~30%» (хамгийн их хувь хүртэл).
 */
export function salePctText(
  s: Pick<SaleSummary, "minPct" | "maxPct" | "allSizes"> | null | undefined,
): string | null {
  if (!s || !(s.maxPct > 0)) return null;
  if (!s.allSizes) return `~${s.maxPct}%`;
  return s.minPct === s.maxPct ? `${s.maxPct}%` : `${s.minPct}–${s.maxPct}%`;
}

/**
 * Одоогийн хямдарсан үнэ хэзээ дуусах вэ (ISO, exclusive). Хямдралгүй бол
 * undefined, хугацаагүй бол null.
 *
 * Эх үүсвэр — SQL-ийн дүрмээр:
 *  - `variant_sale_label` (0189) нь бодит үнийг тогтоож буй LIVE арга
 *    хэмжээний нэр. Гар хямдрал ба арга хэмжээ ИЖИЛ үнэ гаргавал SQL арга
 *    хэмжээг сонгодог (label = event) — энд ч тэгнэ: `eventEndsAt`.
 *  - label null бол гар хямдрал — гэхдээ ЗӨВХӨН хүчинтэй үед
 *    (`isSaleActive`: эхэлсэн, дуусаагүй). Дууссан/эхлээгүй `sale_price` санд
 *    үлддэг (0166) тул хэзээ ч эх үүсвэр, дуусах мөч болохгүй.
 *  - label мэдэгдэхгүй (demo seed) бол хүчинтэй гар хямдрал үнэтэйгээ
 *    тэнцвэл гар хямдрал, эс бөгөөс арга хэмжээ.
 */
export function saleEndsAt(
  v: SaleFields & {
    variant_price?: number | null;
    variant_sale_label?: string | null;
  },
  eventEndsAt: string | null,
  now: Date = new Date(),
): string | null | undefined {
  const price =
    typeof v.variant_price === "number"
      ? Math.min(v.variant_price, v.price)
      : effectivePrice(v, now);
  if (price >= v.price) return undefined;
  if (v.variant_sale_label) return eventEndsAt;
  const manualOn = isSaleActive(v, now) && v.sale_price === price;
  if (v.variant_sale_label === null) {
    // SQL: арга хэмжээ биш → гар хямдрал; хүчингүй бол хугацаа мэдэгдэхгүй.
    return manualOn ? (v.sale_ends_at ?? null) : null;
  }
  return manualOn ? (v.sale_ends_at ?? null) : eventEndsAt;
}

/**
 * Хамгийн ойр мөч (null/undefined алгасна); байхгүй бол null. `now` өгвөл
 * өнгөрсөн мөчийг алгасна — хоцорсон кэшийн дууссан хугацаа «ойр» болохгүй.
 */
export function earliestEnd(
  ends: readonly (string | null | undefined)[],
  now?: number,
): string | null {
  let best: string | null = null;
  for (const e of ends) {
    if (!e) continue;
    const t = Date.parse(e);
    if (!Number.isFinite(t) || (now != null && t <= now)) continue;
    if (best == null || t < Date.parse(best)) best = e;
  }
  return best;
}
