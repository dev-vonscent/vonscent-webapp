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
