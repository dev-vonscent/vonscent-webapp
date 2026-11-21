import { formatPrice } from "@/lib/format";
import {
  parseSaleBreakdown,
  saleTotalOf,
  type SaleRow,
} from "@/lib/orders/price-breakdown";

/**
 * Захиалгын тооцооны мөрүүд — нэг эх сурвалж.
 *
 * Pay хуудас, `/order/[token]`, `/account/orders/[id]`, админ дэлгэц,
 * нэхэмжлэх, и-мэйл — зургаан газар ижил блокийг тус тусад нь бичсэн байсан
 * тул checkout дээр хийсэн засвар (үндсэн үнэ ба багцын хямдралыг тусад нь
 * харуулах) тэдний алинд нь ч хүрээгүй. Одооноос мөр бүр эндээс гарна;
 * дэлгэц бүр зөвхөн ХЭРХЭН зурахаа мэднэ.
 *
 * Дараалал нь мөнгө хөдөлсний дараалал (task 10, клиентийн шийдвэр
 * 2026-11-17; засвар 2026-11-21 сл.8): Үндсэн үнийн нийлбэр → − Багцын
 * хямдрал → − Арга хэмжээ / Хямдрал → = Нийт барааны үнэ → − Купон (10%)
 * → − V point → + Хүргэлт. Купон нь хямдралын ДАРААХ
 * дүнгээс бодогддог (`validate_coupon`) тул арга хэмжээг купоноос өмнө
 * харуулна — эс бөгөөс мөрүүд тоогоор зөв уншигдахгүй. «Нийт төлөх» энд
 * БАЙХГҮЙ — тэр нь дэлгэц бүрт өөр жинтэй (том тоо, зураас) тул байрандаа
 * үлдэнэ.
 */
export interface OrderSummarySource {
  /** Багцын хямдралын ДАРААХ барааны дүн — `orders.subtotal`. */
  subtotal: number;
  /**
   * Хямдралын ӨМНӨХ барааны дүн (0097). 0097-оос өмнөх захиалгад null —
   * тэр үед багцын хямдралыг мэдэх аргагүй тул ганц «Барааны дүн» мөр гарна.
   */
  grossSubtotal: number | null;
  /**
   * Арга хэмжээ / гар хямдралын мөрүүд (0189 `orders.sale_breakdown`).
   * Хуучин захиалгад null — тэр үед хямдрал мөрийн үнэд шингэсэн хэвээр.
   */
  saleBreakdown?: SaleRow[] | null;
  /** Зөвхөн купоны хөнгөлөлт — `orders.discount`. */
  discount: number;
  couponCode?: string | null;
  /**
   * Хувийн купоны хувь (0199 `orders.coupon_pct`) — байвал «Купон (10%)»,
   * эс бөгөөс (мөнгөн купон, хуучин захиалга) «Купон · КОД».
   */
  couponPct?: number | null;
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

export function orderSummaryRows(
  o: OrderSummarySource,
  opts: { shipping?: boolean } = {},
): OrderSummaryRow[] {
  const bundle = bundleSavingsOf(o);
  const sales = o.saleBreakdown ?? [];
  const sale = saleTotalOf(sales);
  const rows: OrderSummaryRow[] = [];

  if (bundle > 0 || sale > 0) {
    // Үндсэн үнийн нийлбэр = багцын өмнөх дүн (`gross_subtotal`, хямдарсан
    // мөрийн үнээр) + хямдрал.
    rows.push({
      label: "Нийт үндсэн үнэ",
      value: formatPrice((o.grossSubtotal ?? o.subtotal) + sale),
    });
  } else {
    rows.push({ label: "Барааны дүн", value: formatPrice(o.subtotal) });
  }

  if (bundle > 0) {
    rows.push({
      label: "Багцын хямдрал",
      value: `−${formatPrice(bundle)}`,
      credit: true,
    });
  }

  for (const r of sales) {
    rows.push({
      label: r.label,
      value: `−${formatPrice(r.amount)}`,
      credit: true,
    });
  }

  // Хямдралын (багц, арга хэмжээ, гар хямдрал) дараах барааны дүн — купон
  // энэ дүнгээс бодогдоно (`validate_coupon`) тул купоноос ӨМНӨ (клиентийн
  // засвар 2026-11-21 сл.8, хуучин нэр нь «Хямдарсан үнэ», купоны дараа).
  if (bundle > 0 || sale > 0) {
    rows.push({
      label: "Нийт барааны үнэ",
      value: formatPrice(o.subtotal),
      strong: true,
    });
  }

  if (o.discount > 0) {
    rows.push({
      label: couponLabel(o),
      value: `−${formatPrice(o.discount)}`,
      credit: true,
    });
  }

  if (o.loyaltyUsed > 0) {
    rows.push({
      label: "V point",
      value: `−${formatPrice(o.loyaltyUsed)}`,
      credit: true,
    });
  }

  if (opts.shipping !== false) {
    rows.push({
      label: "Хүргэлт",
      value: o.shippingFee === 0 ? "Үнэгүй" : `+${formatPrice(o.shippingFee)}`,
    });
  }

  return rows;
}

/**
 * «Купон (10%)» → «Купон · КОД» → «Хөнгөлөлт». Хувь нь зөвхөн хөнгөлөлт
 * «Нийт барааны үнэ»-ийн яг тэр хувь байх үед — дээд хязгаартай
 * (`max_discount`) купон таслагдсан бол «10%» нь тоотой таарахгүй тул кодоор.
 */
function couponLabel(o: OrderSummarySource): string {
  const pct = o.couponPct;
  if (
    pct != null &&
    pct > 0 &&
    o.discount >= Math.floor((o.subtotal * pct) / 100)
  ) {
    return `Купон (${pct}%)`;
  }
  return o.couponCode ? `Купон · ${o.couponCode}` : "Хөнгөлөлт";
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
  /** 0189 — хуучин захиалга, эсвэл баганыг уншаагүй query-д байхгүй. */
  sale_breakdown?: unknown;
  discount: number;
  coupon_code?: string | null;
  /** 0199 — query уншаагүй / хуучин бол байхгүй. */
  coupon_pct?: number | null;
  loyalty_used: number;
  shipping_fee: number;
}): OrderSummarySource {
  return {
    subtotal: o.subtotal,
    grossSubtotal: o.gross_subtotal,
    saleBreakdown: parseSaleBreakdown(o.sale_breakdown),
    discount: o.discount,
    couponCode: o.coupon_code ?? null,
    couponPct: o.coupon_pct ?? null,
    loyaltyUsed: o.loyalty_used,
    shippingFee: o.shipping_fee,
  };
}
