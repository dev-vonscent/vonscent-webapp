/**
 * Grouping the customer's coupons for display.
 *
 * Pure so it can be tested without a database — the component below is a thin
 * shell around it.
 */

export interface CouponRecord {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  min_subtotal: number;
  ends_at: string | null;
  max_uses: number | null;
  used_count: number;
  /** Set = issued to this customer alone (0020_user_coupons). */
  user_id: string | null;
}

export interface CouponGroup {
  key: string;
  type: "percent" | "fixed";
  value: number;
  minSubtotal: number;
  personal: boolean;
  /** Soonest-expiring first — the one to spend, and the row's headline code. */
  coupons: CouponRecord[];
}

/**
 * Drop the coupons a customer can no longer spend.
 *
 * `is_active` alone is not enough, and the gap shows: a wheel coupon that has
 * already been redeemed keeps `is_active = true` with `used_count` at its cap,
 * so the account page listed spent codes under "Идэвхтэй купонууд". Same for
 * one whose `ends_at` has passed.
 */
export function usable(rows: CouponRecord[], now = Date.now()): CouponRecord[] {
  return rows.filter((c) => {
    if (c.max_uses != null && c.used_count >= c.max_uses) return false;
    if (c.ends_at && Date.parse(c.ends_at) <= now) return false;
    return true;
  });
}

/**
 * Collapse coupons that are the same offer into one row.
 *
 * The lucky wheel stopped replacing unused coupons (docs/lucky-wheel.md §0 №1),
 * so holding six identical 5,000₮ codes is ordinary — and six identical rows
 * is a wall that hides the 10% sitting under it. The row keeps every code, so
 * nothing is lost: the count is shown, and the list expands.
 */
export function groupCoupons(
  rows: CouponRecord[],
  now = Date.now(),
): CouponGroup[] {
  const groups = new Map<string, CouponGroup>();
  for (const c of usable(rows, now)) {
    const key = `${c.type}:${c.value}:${c.min_subtotal}:${c.user_id ? "p" : "x"}`;
    const held = groups.get(key);
    if (held) {
      held.coupons.push(c);
      continue;
    }
    groups.set(key, {
      key,
      type: c.type,
      value: c.value,
      minSubtotal: c.min_subtotal,
      personal: c.user_id != null,
      coupons: [c],
    });
  }

  for (const g of groups.values()) {
    // Soonest expiry first: that is the one worth spending next, and a code
    // with no end date can always wait.
    g.coupons.sort(
      (a, b) =>
        (a.ends_at ? Date.parse(a.ends_at) : Infinity) -
        (b.ends_at ? Date.parse(b.ends_at) : Infinity),
    );
  }

  // Percent coupons first, then the largest amount — roughly "best" without
  // knowing a cart total, which this page does not have.
  return [...groups.values()].sort((a, b) => {
    if (a.type !== b.type) return a.type === "percent" ? -1 : 1;
    return b.value - a.value;
  });
}

/** Days left, or null when the end is too far off to be worth mentioning. */
export function daysLeft(
  endsAt: string | null,
  now = Date.now(),
): number | null {
  if (!endsAt) return null;
  const ms = Date.parse(endsAt) - now;
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.ceil(ms / 86_400_000);
}
