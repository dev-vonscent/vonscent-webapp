import { formatPrice } from "@/lib/format";

/**
 * Захиалгын тооцооны мөрүүд — нэг эх сурвалж.
 *
 * Pay хуудас, `/order/[token]`, `/account/orders/[id]`, админ дэлгэц,
 * нэхэмжлэх, и-мэйл — зургаан газар ижил блокийг тус тусад нь бичсэн байсан
 * тул checkout дээр хийсэн засвар (үндсэн үнэ ба багцын хямдралыг тусад нь
 * харуулах) тэдний алинд нь ч хүрээгүй. Одооноос мөр бүр эндээс гарна;
 * дэлгэц бүр зөвхөн ХЭРХЭН зурахаа мэднэ.
 *
 * Дараалал нь мөнгө хөдөлсний дараалал: үндсэн үнэ → хасагдах нь (багц,
 * купон, оноо) → нэмэгдэх хүргэлт. «Нийт төлөх» энд БАЙХГҮЙ — тэр нь дэлгэц
 * бүрт өөр жинтэй (том тоо, зураас) тул байрандаа үлдэнэ.
 */
export interface OrderSummarySource {
  /** Багцын хямдралын ДАРААХ барааны дүн — `orders.subtotal`. */
  subtotal: number;
  /**
   * Хямдралын ӨМНӨХ барааны дүн (0097). 0097-оос өмнөх захиалгад null —
   * тэр үед багцын хямдралыг мэдэх аргагүй тул ганц «Барааны дүн» мөр гарна.
   */
  grossSubtotal: number | null;
  /** Зөвхөн купоны хөнгөлөлт — `orders.discount`. */
  discount: number;
  couponCode?: string | null;
  loyaltyUsed: number;
  shippingFee: number;
}

export interface OrderSummaryRow {
  label: string;
  value: string;
  /** Хасагдаж буй мөр — дэлгэц үүнийг өөр өнгөөр тэмдэглэж болно. */
  credit?: boolean;
  /** Хямдралын дараах дэд дүн — бусад мөрөөс бага зэрэг тод. */
  strong?: boolean;
}

/** Багцаас хэмнэсэн дүн. Мэдэгдэхгүй (хуучин захиалга) бол 0. */
export function bundleSavingsOf(o: OrderSummarySource): number {
  if (o.grossSubtotal == null) return 0;
  return Math.max(o.grossSubtotal - o.subtotal, 0);
}

export function orderSummaryRows(o: OrderSummarySource): OrderSummaryRow[] {
  const bundle = bundleSavingsOf(o);
  const rows: OrderSummaryRow[] = [];

  if (bundle > 0) {
    rows.push({
      label: "Нийт үндсэн үнэ",
      value: formatPrice(o.grossSubtotal as number),
    });
    rows.push({
      label: "Багцын хямдрал",
      value: `−${formatPrice(bundle)}`,
      credit: true,
    });
  } else {
    rows.push({ label: "Барааны дүн", value: formatPrice(o.subtotal) });
  }

  if (o.discount > 0) {
    rows.push({
      label: o.couponCode ? `Купон · ${o.couponCode}` : "Хөнгөлөлт",
      value: `−${formatPrice(o.discount)}`,
      credit: true,
    });
  }

  // Хасалт хоёр ба түүнээс дээш удаа хийгдсэн үед «эцсийн барааны дүн» хаана
  // тогтсоныг нэг мөрөөр хэлнэ — эс тэгвээс хүргэлт, оноо хоёр юун дээр
  // нэмэгдэж/хасагдаж байгаа нь тодорхойгүй.
  if (bundle > 0 && o.discount > 0) {
    rows.push({
      label: "Хямдарсан үнэ",
      value: formatPrice(Math.max(o.subtotal - o.discount, 0)),
      strong: true,
    });
  }

  if (o.loyaltyUsed > 0) {
    rows.push({
      label: "V point",
      value: `−${formatPrice(o.loyaltyUsed)}`,
      credit: true,
    });
  }

  rows.push({
    label: "Хүргэлт",
    value: o.shippingFee === 0 ? "Үнэгүй" : `+${formatPrice(o.shippingFee)}`,
  });

  return rows;
}

/**
 * `orders` мөрийг (snake_case) тоймын эх өгөгдөл болгон хөрвүүлэх.
 *
 * Админ, бүртгэл, нэхэмжлэх, и-мэйл дөрөв нь DB мөрийг шууд уншдаг тул энэ
 * гүүр байхгүй бол тус бүрдээ ижил дөрвөн мөр бичих болно.
 */
export function summarySource(o: {
  subtotal: number;
  gross_subtotal: number | null;
  discount: number;
  coupon_code?: string | null;
  loyalty_used: number;
  shipping_fee: number;
}): OrderSummarySource {
  return {
    subtotal: o.subtotal,
    grossSubtotal: o.gross_subtotal,
    discount: o.discount,
    couponCode: o.coupon_code ?? null,
    loyaltyUsed: o.loyalty_used,
    shippingFee: o.shipping_fee,
  };
}
