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
}

/**
 * Order checkout offers: soonest expiry first, then the bigger discount.
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
    const byEnd = end(a) - end(b);
    if (byEnd !== 0 && !Number.isNaN(byEnd)) return byEnd;
    return b.discount - a.discount;
  });
}
