import { GIFT_THRESHOLD } from "@/lib/constants";

/**
 * 1мл бэлгийн дээжийн эрхийн тоо (2026-09-24 шийдвэр):
 *
 *   цэвэр дүн = барааны дүн − купоны хямдрал
 *   эрх       = ⌊цэвэр дүн ÷ 200,000⌋
 *
 * Хүргэлтийн төлбөр тооцогдохгүй. Оноогоор төлсөн хэсгийг хэрэглэгчийн өөрийн
 * мөнгө гэж үздэг тул хасахгүй. Багц (preset ч, custom ч, ямар ч хэмжээтэй)
 * тусдаа эрх өгөхгүй — багцын үнэ бусад бараатай адил дүнд л нэмэгдэнэ.
 *
 * Жишээ: 199,999₮ → 0 · 200,000₮ → 1 · 399,999₮ → 1 · 400,000₮ → 2 ·
 * preset 10мл багц 150K → 0 · 220K − 10% купон (198K) → 0.
 */
export function giftAllowanceFor(goodsAfterDiscount: number): number {
  return Math.floor(Math.max(goodsAfterDiscount, 0) / GIFT_THRESHOLD);
}

/** Сагс, checkout дээрх «X₮ дутуу» сануулгын тоо. */
export interface GiftProgress {
  /** Одоогийн дүнгээр авах бэлгийн эрх. */
  allowance: number;
  /** Дараагийн нэг эрх хүртэл дутуу дүн (₮, үргэлж > 0). */
  toNext: number;
}

export function giftProgress(goodsAfterDiscount: number): GiftProgress {
  const goods = Math.max(goodsAfterDiscount, 0);
  return {
    allowance: giftAllowanceFor(goods),
    toNext: GIFT_THRESHOLD - (goods % GIFT_THRESHOLD),
  };
}
