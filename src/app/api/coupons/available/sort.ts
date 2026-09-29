export interface AvailableCoupon {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  discount: number;
  minSubtotal: number;
  /** Cap on a percent coupon's ₮ discount; null = uncapped. */
  maxDiscount: number | null;
  endsAt: string | null;
  /** Issued to this customer. */
  personal: boolean;
  /**
   * false = the cart is below `minSubtotal`. Still listed — hiding it made a
   * customer think the coupon was gone — but it cannot be picked yet.
   */
  eligible: boolean;
  /** ₮ still to add before it applies; 0 when eligible. */
  shortfall: number;
}

/**
 * Order checkout offers: usable ones first, then soonest expiry, then the
 * bigger discount.
 *
 * Every coupon is its own row — two 10% codes that expire on different days
 * are different things to the customer (the one ending tomorrow is the one to
 * spend), and merging them hid that. A coupon with no end date can always
 * wait, so it goes last.
 */
export function sortOffers(coupons: AvailableCoupon[]): AvailableCoupon[] {
  const end = (c: AvailableCoupon) =>
    c.endsAt ? Date.parse(c.endsAt) : Number.POSITIVE_INFINITY;
  return [...coupons].sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    const byEnd = end(a) - end(b);
    if (byEnd !== 0 && !Number.isNaN(byEnd)) return byEnd;
    return b.discount - a.discount;
  });
}
