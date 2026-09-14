/**
 * V point-ийн дүрмүүд — `settings.loyalty` мөрийн клиент тал дахь толь.
 *
 * Оноо олгох тооцоо нь ҮНЭНДЭЭ санд байдаг (`mark_order_paid`, 0016/0024) ба
 * зөвхөн төлбөр батлагдсаны дараа бичигддэг. Энд байгаа нь түүнийг ДАВТАН
 * бодож байгаа юм биш — захиалга өгөхийн ӨМНӨ «энэ худалдан авалтаас хэд
 * цуглах вэ» гэдгийг харуулах цорын ганц зорилготой. Тиймээс томьёо нь SQL-тэй
 * үсэг үсгээрээ таарах ёстой: суурь нь купоны дараах БАРААНЫ дүн (хүргэлт
 * ороогүй), оноогоор төлсөн хэсгийг хасахгүй.
 */

export interface LoyaltyRules {
  /** Хэдэн ₮ тутамд оноо олгох вэ. */
  earnPer: number;
  /** Тэр тутамд хэдэн оноо олгох вэ. */
  earnPoints: number;
  /** 1 оноо = хэдэн ₮ (эргүүлж зарцуулахад). */
  redeemRate: number;
}

/** 0016-ийн анхдагч дүрэм: 1% (100₮ тутамд 1 оноо). */
export const DEFAULT_LOYALTY_RULES: LoyaltyRules = {
  earnPer: 100,
  earnPoints: 1,
  redeemRate: 1,
};

/** `settings.loyalty.value`-г дүрэм болгож уншина (дутуу талбарыг нөхнө). */
export function parseLoyaltyRules(value: unknown): LoyaltyRules {
  const v = (value ?? {}) as Partial<Record<keyof LoyaltyRules, unknown>>;
  const num = (raw: unknown, fallback: number) => {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  return {
    earnPer: num(v.earnPer, DEFAULT_LOYALTY_RULES.earnPer),
    earnPoints: num(v.earnPoints, DEFAULT_LOYALTY_RULES.earnPoints),
    redeemRate: num(v.redeemRate, DEFAULT_LOYALTY_RULES.redeemRate),
  };
}

/**
 * Купоны дараах барааны дүнгээс хуримтлагдах оноо.
 *
 * `mark_order_paid`-ийн `floor(v_base / earnPer) * earnPoints`-ийн яг хуулбар.
 * Хүргэлтийн төлбөр суурьт ОРОХГҮЙ, оноогоор төлсөн хэсэг нь суурийг
 * БУУРУУЛАХГҮЙ — хоёулаа сангийн одоогийн зан төлөв.
 */
export function pointsEarnedFor(
  goodsAfterDiscount: number,
  rules: LoyaltyRules,
): number {
  if (rules.earnPer <= 0) return 0;
  const base = Math.max(Math.round(goodsAfterDiscount), 0);
  return Math.floor(base / rules.earnPer) * rules.earnPoints;
}
