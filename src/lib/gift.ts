import {
  GIFT_MAX_SAMPLES,
  GIFT_PER_PRODUCT_LIMIT,
  GIFT_THRESHOLD,
} from "@/lib/constants";

/**
 * 1мл бэлгийн дээжийн эрхийн тоо (2026-09-24 шийдвэр):
 *
 *   цэвэр дүн = барааны дүн − купоны хямдрал
 *   эрх       = min(⌊цэвэр дүн ÷ 200,000⌋, GIFT_MAX_SAMPLES)
 *
 * Хүргэлтийн төлбөр тооцогдохгүй. Оноогоор төлсөн хэсгийг хэрэглэгчийн өөрийн
 * мөнгө гэж үздэг тул хасахгүй. Багц (preset ч, custom ч, ямар ч хэмжээтэй)
 * тусдаа эрх өгөхгүй — багцын үнэ бусад бараатай адил дүнд л нэмэгдэнэ.
 *
 * Жишээ: 199,999₮ → 0 · 200,000₮ → 1 · 399,999₮ → 1 · 400,000₮ → 2 ·
 * 1,000,000₮ → 5 · 3,000,000₮ → 5 (тагласан) · preset 10мл багц 150K → 0 ·
 * 220K − 10% купон (198K) → 0.
 */
export function giftAllowanceFor(goodsAfterDiscount: number): number {
  const earned = Math.floor(Math.max(goodsAfterDiscount, 0) / GIFT_THRESHOLD);
  return Math.min(earned, GIFT_MAX_SAMPLES);
}

/**
 * Бэлгийн сан хэдэн дээж гаргаж чадах вэ — нэг уснаас хамгийн ихдээ
 * `GIFT_PER_PRODUCT_LIMIT`. Эрх нь үүнээс давбал захиалга дээр биелэхгүй тул
 * хэрэглэгчид тэр тоог хэзээ ч харуулахгүй (`giftSlotsFor`).
 */
export function giftCapacity(poolSize: number): number {
  return Math.max(poolSize, 0) * GIFT_PER_PRODUCT_LIMIT;
}

export interface GiftSlots {
  /** Дүнгээс олсон эрх (тагтай). */
  earned: number;
  /** Бодитоор сонгож болох тоо — сангийн багтаамжаар хумигдсан. */
  allowance: number;
  /** Сан хүрэлцэхгүйн улмаас хумигдсан эсэх — хэрэглэгчид тайлбарлана. */
  cappedByPool: boolean;
}

/**
 * Хэрэглэгчид харуулах ЭЦСИЙН тоо. «5 эрхтэй» гэж бичээд 4-ийн дараа
 * мухардуулах нь хамгийн муу хувилбар тул харагдах тоо нь үргэлж биелж
 * чадахуйц байх ёстой (сангийн ус × нэг уснаас авах дээд тоо).
 */
export function giftSlotsFor(
  goodsAfterDiscount: number,
  poolSize: number,
): GiftSlots {
  const earned = giftAllowanceFor(goodsAfterDiscount);
  const allowance = Math.min(earned, giftCapacity(poolSize));
  return { earned, allowance, cappedByPool: allowance < earned };
}

/** Сагс, checkout дээрх «X₮ дутуу» сануулгын тоо. */
export interface GiftProgress {
  /** Одоогийн дүнгээр авах бэлгийн эрх. */
  allowance: number;
  /** Дараагийн нэг эрх хүртэл дутуу дүн (₮). Тагт хүрсэн үед 0. */
  toNext: number;
  /** Эрх дээд хязгаартаа хүрсэн — «дахиад нэмбэл» гэж амлахаа болино. */
  atMax: boolean;
}

export function giftProgress(goodsAfterDiscount: number): GiftProgress {
  const goods = Math.max(goodsAfterDiscount, 0);
  const allowance = giftAllowanceFor(goods);
  const atMax = allowance >= GIFT_MAX_SAMPLES;
  return {
    allowance,
    toNext: atMax ? 0 : GIFT_THRESHOLD - (goods % GIFT_THRESHOLD),
    atMax,
  };
}

/**
 * Сонголтын жагсаалтыг (нэг ус олон удаа орж болно) серверийн дүрмээр шүүнэ:
 * нийт эрх, нэг уснаас авах дээд тоо, санд байгаа эсэх. Client, server хоёр
 * ижил дүн гаргахын тулд энэ ганц газраас.
 *
 * `isAllowed` нь тухайн уснаас аль хэдийн авсан тоог хүлээж авдаг — сервер
 * талд үлдэгдэл ml нь авах болгонд хорогддог тул (`priceGiftLines`).
 *
 * @returns productId → хэдэн ширхэг, оруулсан дараалал хадгалагдана.
 */
export function limitGiftPicks(
  picks: readonly string[],
  allowance: number,
  isAllowed: (id: string, taken: number) => boolean = () => true,
): Map<string, number> {
  const taken = new Map<string, number>();
  let total = 0;
  for (const id of picks) {
    if (total >= allowance) break;
    const n = taken.get(id) ?? 0;
    if (n >= GIFT_PER_PRODUCT_LIMIT || !isAllowed(id, n)) continue;
    taken.set(id, n + 1);
    total += 1;
  }
  return taken;
}
