import { BUNDLE_ML_SIZES } from "@/lib/constants";
import type { CollectionMember, CollectionPriceAtMl } from "./types";

/** Round to the nearest `step` (₮). step ≤ 1 rounds to the nearest whole ₮. */
export function roundTo(value: number, step: number): number {
  if (step <= 1) return Math.round(value);
  return Math.round(value / step) * step;
}

/**
 * Bundle price at a given member sum: apply the % discount, then round.
 * Discount is % only (client decision §14.7).
 */
export function bundlePrice(
  memberSum: number,
  discountPct: number,
  step = 100,
): number {
  const discounted = memberSum * (1 - discountPct / 100);
  return Math.max(0, roundTo(discounted, step));
}

/**
 * Compute the bundle price for every ml the shop sells. A size is `available`
 * only when *every* member has an active, in-stock variant of it (§3.2).
 */
export function memberPrices(
  members: CollectionMember[],
  discountPct: number,
  step = 100,
): CollectionPriceAtMl[] {
  return BUNDLE_ML_SIZES.map((ml) => {
    const rows = members.map((m) => m.variantByMl[ml]);
    const available =
      members.length > 0 && rows.every((r) => r != null && r.inStock);
    const memberSum = rows.reduce((sum, r) => sum + (r?.price ?? 0), 0);
    const price = bundlePrice(memberSum, discountPct, step);
    return { ml, memberSum, price, saved: memberSum - price, available };
  });
}
