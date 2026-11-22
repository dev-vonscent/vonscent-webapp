import { describe, it, expect } from "vitest";
import {
  DEFAULT_LOYALTY_RULES,
  parseLoyaltyRules,
  pointsEarnedFor,
  rewardBaseOf,
  reviewPointsOf,
  DEFAULT_REVIEW_POINTS,
  profilePointsOf,
} from "./loyalty";
import { DEFAULT_PROFILE_POINTS } from "./constants";

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

describe("profilePointsOf", () => {
  it("falls back to the 0163 seed when the setting predates it", () => {
    expect(profilePointsOf({ earnPer: 100 })).toBe(DEFAULT_PROFILE_POINTS);
    expect(profilePointsOf(null)).toBe(DEFAULT_PROFILE_POINTS);
  });

  it("keeps 0 as «off», floors, and rejects junk", () => {
    expect(profilePointsOf({ profilePoints: 0 })).toBe(0);
    expect(profilePointsOf({ profilePoints: -5 })).toBe(0);
    expect(profilePointsOf({ profilePoints: "x" })).toBe(0);
    expect(profilePointsOf({ profilePoints: 300.7 })).toBe(300);
  });
});

describe("rewardBaseOf — QPay-ээр төлсөн дүн (0189, task 8.4 / 9.1 / 9.2)", () => {
  /**
   * §1 жишээ: барааны дүн 270,000₮ (багц, арга хэмжээний дараа), купон
   * 27,000₮, V point 10,000₮, хүргэлт 7,000₮ → QPay 240,000₮.
   * Өмнөх суурь: оноо/купон 243,000₮ (subtotal − discount), хүрд 250,000₮.
   */
  const total = 270_000 - 27_000 - 10_000 + 7_000;

  it("суурь = orders.total (хүргэлттэй, V point хассан)", () => {
    expect(rewardBaseOf(total)).toBe(240_000);
    expect(pointsEarnedFor(total, DEFAULT_LOYALTY_RULES)).toBe(2_400);
    // Хүрд: 100,000₮ тутамд 1 (grant_order_spins) → 2.
    expect(Math.floor(rewardBaseOf(total) / 100_000)).toBe(2);
  });

  it("бэлгийн картын V point-оор барааг бүтэн төлсөн бол зөвхөн хүргэлт үлдэнэ", () => {
    // 95,000₮ бараа бүгд V point-оор, хүргэлт 7,000₮ QPay-ээр.
    const paid = 95_000 - 95_000 + 7_000;
    expect(rewardBaseOf(paid)).toBe(7_000);
    // 100,000₮ босготой автомат купон, хүрдний эрх олгогдохгүй.
    expect(rewardBaseOf(paid) >= 100_000).toBe(false);
  });

  it("сөрөг дүн 0", () => {
    expect(rewardBaseOf(-1)).toBe(0);
  });
});
