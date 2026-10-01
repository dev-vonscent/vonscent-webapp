import { REFUND_FEE_PCT } from "@/lib/constants";

/**
 * Хэрэглэгчийн хүсэлтээр цуцалсан, төлсөн захиалгын буцаалт: нийт дүнгээс
 * банкны шимтгэлийг (`REFUND_FEE_PCT`) хасна. Integer ₮ — шимтгэлийг ₮-т
 * тэгшилнэ, буцаах дүн нь үлдэгдэл, тиймээс хоёрын нийлбэр яг `total`.
 *
 * `server-only` БИШ: хэрэглэгчийн цуцлах цонх, админы буцаалтын хэсэг,
 * имэйл гурав нэг тоог харуулна.
 */
export function refundBreakdown(total: number): {
  fee: number;
  amount: number;
} {
  const safe = Math.max(0, Math.round(total));
  const fee = Math.round((safe * REFUND_FEE_PCT) / 100);
  return { fee, amount: safe - fee };
}

/**
 * Хүргэгдсэний дараах буцаалт (клиент, 2026-10-01): шимтгэлгүй, гэхдээ
 * хүргэлтийн төлбөр буцаагдахгүй. Курьер аль хэдийн хүргэсэн, клиент түүнд
 * төлсөн тул тэр мөнгө дэлгүүрийнх биш. Буцаах дүн = барааны цэвэр дүн
 * (`total − shipping_fee`); V point ба купон мөнгөөр биш, өөрөө буцна.
 * `mark_order_refunded` (0114) яг ижил дүнг `refund_amount`-д бичнэ.
 */
export function deliveredRefund(
  total: number,
  shippingFee: number,
): { fee: 0; shipping: number; amount: number } {
  const safe = Math.max(0, Math.round(total));
  const shipping = Math.min(Math.max(0, Math.round(shippingFee)), safe);
  return { fee: 0, shipping, amount: safe - shipping };
}

/** «•••• 5678» — дансны дугаарыг жагсаалт, имэйлд бүтнээр нь ил гаргахгүй. */
export function maskAccount(account: string): string {
  const digits = account.replace(/\s+/g, "");
  return digits.length <= 4 ? digits : `•••• ${digits.slice(-4)}`;
}
