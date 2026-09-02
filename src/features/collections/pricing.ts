import { BUNDLE_ML_SIZES } from "@/lib/constants";
import type { CollectionMember, CollectionPriceAtMl } from "./types";

/** Round to the nearest `step` (₮). step ≤ 1 rounds to the nearest whole ₮. */
export function roundTo(value: number, step: number): number {
  if (step <= 1) return Math.round(value);
  return Math.round(value / step) * step;
}

/**
 * Per-size discount overrides, keyed by ml. A size absent from the map is
 * charged the bundle's default `discount_pct` (0051) — that is what keeps every
 * bundle created before per-size pricing behaving as it always did.
 */
export type MlDiscounts = Record<number, number>;

/** The discount that applies at one size: the override, else the default. */
export function discountForMl(
  ml: number,
  defaultPct: number,
  overrides: MlDiscounts = {},
): number {
  const own = overrides[ml];
  return Number.isFinite(own) ? (own as number) : defaultPct;
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
  defaultDiscountPct: number,
  step = 100,
  overrides: MlDiscounts = {},
): CollectionPriceAtMl[] {
  return BUNDLE_ML_SIZES.map((ml) => {
    const rows = members.map((m) => m.variantByMl[ml]);
    const available =
      members.length > 0 && rows.every((r) => r != null && r.inStock);
    const memberSum = rows.reduce((sum, r) => sum + (r?.price ?? 0), 0);
    const discountPct = discountForMl(ml, defaultDiscountPct, overrides);
    const price = bundlePrice(memberSum, discountPct, step);
    return {
      ml,
      memberSum,
      price,
      discountPct,
      saved: memberSum - price,
      available,
    };
  });
}

/**
 * The span of discounts to advertise, e.g. «5-10%».
 *
 * Measured over the sizes the bundle can actually be bought at, so a badge
 * never promises a rate that is only available on a sold-out size. When
 * nothing is buyable there is no honest subset left, so it falls back to the
 * full table rather than reporting nothing.
 */
export function discountRange(
  prices: CollectionPriceAtMl[],
  availableMls: number[] = [],
): { min: number; max: number } {
  const scope = availableMls.length
    ? prices.filter((p) => availableMls.includes(p.ml))
    : prices;
  if (!scope.length) return { min: 0, max: 0 };
  const pcts = scope.map((p) => p.discountPct);
  return { min: Math.min(...pcts), max: Math.max(...pcts) };
}

/** «10%» when the span is flat, «5-10%» when it is not. Empty when there is none. */
export function formatDiscountRange({
  min,
  max,
}: {
  min: number;
  max: number;
}): string {
  if (max <= 0) return "";
  return min === max ? `${min}%` : `${min}-${max}%`;
}
