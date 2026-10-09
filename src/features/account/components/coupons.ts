/**
 * «Миний купон» — the customer's coupons, one row each.
 *
 * Pure so it can be tested without a database: the route handler builds rows
 * with `toWalletCoupon`, the page sorts them per tab with `sortForTab`.
 *
 * Coupons are never merged (0104). Grouping identical offers used to hide the
 * one thing that tells them apart — when each one ends — so two 10% codes
 * expiring a week apart looked like one.
 */

import { WALLET_HISTORY_DAYS } from "@/lib/constants";
import { formatPrice } from "@/lib/format";

export type CouponStatus = "active" | "used" | "expired";

/** The columns the wallet reads from `coupons`. */
export interface CouponRecord {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  min_subtotal: number;
  max_discount: number | null;
  ends_at: string | null;
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
  source: string;
  /** When it was switched off (0120); null while active. */
  deactivated_at?: string | null;
}

/** One redemption as the OWNER may see it — the redeemer is masked. */
export interface WalletRedemption {
  /** "self" when the owner spent it; otherwise masked name/phone. */
  by: "self" | { name: string | null; phone: string | null };
  at: string;
}

export interface WalletCoupon {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  minSubtotal: number;
  maxDiscount: number | null;
  endsAt: string | null;
  maxUses: number | null;
  usedCount: number;
  source: string;
  status: CouponStatus;
  redemptions: WalletRedemption[];
}

/**
 * Where a coupon belongs.
 *
 * `is_active` alone is not enough: a redeemed coupon keeps `is_active = true`
 * with `used_count` at its cap. Spent wins over expired — "someone used it" is
 * the more useful thing to tell the owner of a shared code. A coupon switched
 * off by the admin (or replaced by a newer wheel coupon) reads as expired.
 */
export function couponStatus(
  c: Pick<CouponRecord, "max_uses" | "used_count" | "ends_at" | "is_active">,
  now = Date.now(),
): CouponStatus {
  if (c.max_uses != null && c.used_count >= c.max_uses) return "used";
  if (!c.is_active) return "expired";
  if (c.ends_at && Date.parse(c.ends_at) <= now) return "expired";
  return "active";
}

/**
 * Whether a spent or ended coupon has been history long enough to leave the
 * wallet (`WALLET_HISTORY_DAYS`). The row stays in the database — the admin's
 * redemption log and the reports still read it; only the customer's list
 * forgets it, the way large shops keep «Миний купон» short.
 *
 * The clock starts when the coupon left the «active» tab:
 * - used    → its latest (uncancelled) redemption;
 * - expired → `ends_at` if that has passed, or when it was switched off,
 *             whichever came first.
 * With no such moment on record it stays visible — hiding needs a reason.
 */
export function hiddenFromWallet(
  c: Pick<
    CouponRecord,
    "max_uses" | "used_count" | "ends_at" | "is_active" | "deactivated_at"
  >,
  lastUsedAt: string | null,
  now = Date.now(),
): boolean {
  const status = couponStatus(c, now);
  if (status === "active") return false;
  let since: number | null = null;
  if (status === "used") {
    since = lastUsedAt ? Date.parse(lastUsedAt) : null;
  } else {
    const ended = c.ends_at ? Date.parse(c.ends_at) : NaN;
    const off =
      !c.is_active && c.deactivated_at ? Date.parse(c.deactivated_at) : NaN;
    const moments = [ended <= now ? ended : NaN, off].filter(Number.isFinite);
    since = moments.length ? Math.min(...moments) : null;
  }
  if (since === null || !Number.isFinite(since)) return false;
  return now - since > WALLET_HISTORY_DAYS * 86_400_000;
}

export function toWalletCoupon(
  c: CouponRecord,
  redemptions: WalletRedemption[],
  now = Date.now(),
): WalletCoupon {
  return {
    id: c.id,
    code: c.code,
    type: c.type,
    value: c.value,
    minSubtotal: c.min_subtotal,
    maxDiscount: c.max_discount,
    endsAt: c.ends_at,
    maxUses: c.max_uses,
    usedCount: c.used_count,
    source: c.source,
    status: couponStatus(c, now),
    // Newest first: the latest use is the one the owner is asking about.
    redemptions: [...redemptions].sort(
      (a, b) => Date.parse(b.at) - Date.parse(a.at),
    ),
  };
}

const endOf = (c: WalletCoupon) =>
  c.endsAt ? Date.parse(c.endsAt) : Number.POSITIVE_INFINITY;
const lastUse = (c: WalletCoupon) =>
  c.redemptions[0] ? Date.parse(c.redemptions[0].at) : 0;

/**
 * The coupons of one tab, in the order worth reading them.
 *
 * - Active: soonest expiry first — that is the one to spend next; a coupon
 *   with no end date can always wait.
 * - Used: most recently used first.
 * - Expired: most recently ended first.
 */
export function sortForTab(
  coupons: WalletCoupon[],
  tab: CouponStatus,
): WalletCoupon[] {
  const rows = coupons.filter((c) => c.status === tab);
  if (tab === "active") {
    return rows.sort((a, b) => {
      const d = endOf(a) - endOf(b);
      return Number.isNaN(d) ? 0 : d;
    });
  }
  if (tab === "used") return rows.sort((a, b) => lastUse(b) - lastUse(a));
  return rows.sort((a, b) => {
    const d = endOf(b) - endOf(a);
    return Number.isNaN(d) ? 0 : d;
  });
}

/** Days left, or null when the coupon has no end date or has ended. */
export function daysLeft(
  endsAt: string | null,
  now = Date.now(),
): number | null {
  if (!endsAt) return null;
  const ms = Date.parse(endsAt) - now;
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.ceil(ms / 86_400_000);
}

/**
 * Who used a coupon, as the owner reads it: «Та өөрөө», «Б*** (••2233)».
 * The name and phone are already masked by the server.
 */
export function describeRedemption(r: WalletRedemption): string {
  if (r.by === "self") return "Та өөрөө";
  const { name, phone } = r.by;
  if (name && phone) return `${name} (${phone})`;
  return name ?? phone ?? "Өөр хэрэглэгч";
}

/** The conditions attached to a coupon, in as few words as possible. */
export function couponTerms(c: {
  type: "percent" | "fixed";
  minSubtotal: number;
  maxDiscount: number | null;
}): string | null {
  const parts: string[] = [];
  if (c.minSubtotal > 0) {
    parts.push(`${formatPrice(c.minSubtotal)}-өөс дээш захиалгад`);
  }
  if (c.type === "percent" && c.maxDiscount != null) {
    parts.push(`дээд тал нь ${formatPrice(c.maxDiscount)}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}
