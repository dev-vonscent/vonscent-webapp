/**
 * Купоны түүхийн дээд талын тоонууд. Цуцлагдсан ашиглалт (захиалга
 * цуцлагдаж/буцаагдаж купон эзэндээ буцсан) тооцоонд орохгүй — жагсаалтад
 * харагдсаар ч бодит хөнгөлөлт болоогүй.
 */
export interface RedemptionSummary {
  /** Цуцлагдаагүй ашиглалтын тоо. */
  uses: number;
  /** Ашигласан өөр өөр хүний тоо. */
  people: number;
  /** Захиалгуудын купоны хөнгөлөлтийн нийлбэр, ₮. */
  discount: number;
}

export function summarizeRedemptions(
  rows: readonly {
    userId: string | null;
    cancelledAt: string | null;
    discount: number | null;
  }[],
): RedemptionSummary {
  const live = rows.filter((r) => !r.cancelledAt);
  return {
    uses: live.length,
    people: new Set(live.map((r) => r.userId).filter(Boolean)).size,
    discount: live.reduce((sum, r) => sum + (r.discount ?? 0), 0),
  };
}
