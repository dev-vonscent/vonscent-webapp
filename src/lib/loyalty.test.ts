import { describe, it, expect } from "vitest";
import {
  DEFAULT_LOYALTY_RULES,
  parseLoyaltyRules,
  pointsEarnedFor,
  reviewPointsOf,
  DEFAULT_REVIEW_POINTS,
} from "./loyalty";

describe("parseLoyaltyRules", () => {
  it("falls back to the 1% rule when the settings row is missing", () => {
    expect(parseLoyaltyRules(null)).toEqual(DEFAULT_LOYALTY_RULES);
    expect(parseLoyaltyRules({})).toEqual(DEFAULT_LOYALTY_RULES);
  });

  it("keeps the admin's values", () => {
    expect(
      parseLoyaltyRules({ earnPer: 1000, earnPoints: 15, redeemRate: 2 }),
    ).toEqual({ earnPer: 1000, earnPoints: 15, redeemRate: 2 });
  });

  it("refuses zero and nonsense, which would divide by nothing", () => {
    expect(
      parseLoyaltyRules({ earnPer: 0, earnPoints: "x", redeemRate: -3 }),
    ).toEqual(DEFAULT_LOYALTY_RULES);
  });
});

describe("pointsEarnedFor", () => {
  it("mirrors mark_order_paid: floor(base / earnPer) * earnPoints", () => {
    expect(pointsEarnedFor(197_600, DEFAULT_LOYALTY_RULES)).toBe(1976);
    // Бүтэн алхам хүрээгүй үлдэгдэл оноо болохгүй — сан floor хийдэг.
    expect(pointsEarnedFor(199, DEFAULT_LOYALTY_RULES)).toBe(1);
    expect(pointsEarnedFor(99, DEFAULT_LOYALTY_RULES)).toBe(0);
  });

  it("never earns on a negative base", () => {
    expect(pointsEarnedFor(-5000, DEFAULT_LOYALTY_RULES)).toBe(0);
  });

  it("honours a coarser admin rule", () => {
    expect(
      pointsEarnedFor(45_000, {
        earnPer: 10_000,
        earnPoints: 50,
        redeemRate: 1,
      }),
    ).toBe(200);
  });
});

describe("reviewPointsOf", () => {
  it("falls back to the default when the setting predates 0117", () => {
    expect(reviewPointsOf({ earnPer: 100 })).toBe(DEFAULT_REVIEW_POINTS);
    expect(reviewPointsOf(null)).toBe(DEFAULT_REVIEW_POINTS);
  });

  it("keeps 0 as «off» and rejects junk", () => {
    expect(reviewPointsOf({ reviewPoints: 0 })).toBe(0);
    expect(reviewPointsOf({ reviewPoints: -10 })).toBe(0);
    expect(reviewPointsOf({ reviewPoints: "x" })).toBe(0);
    expect(reviewPointsOf({ reviewPoints: 250 })).toBe(250);
  });
});
