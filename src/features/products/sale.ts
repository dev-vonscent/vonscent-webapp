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
