import { describe, it, expect } from "vitest";
import {
  roundTo,
  bundlePrice,
  memberPrices,
  discountForMl,
  discountRange,
  formatDiscountRange,
} from "./pricing";
import type { CollectionMember } from "./types";

function member(
  prices: Record<number, number>,
  inStockMls = [5, 10, 20],
): CollectionMember {
  return {
    productId: "p",
    slug: "p",
    name: "P",
    brand: "B",
    image: null,
    variantByMl: Object.fromEntries(
      Object.entries(prices).map(([ml, price]) => [
        Number(ml),
        {
          variantId: `v${ml}`,
          price,
          inStock: inStockMls.includes(Number(ml)),
        },
      ]),
    ),
  };
}

describe("roundTo", () => {
  it("rounds to the nearest step", () => {
    expect(roundTo(12345, 100)).toBe(12300);
    expect(roundTo(12355, 100)).toBe(12400);
  });
  it("rounds to whole ₮ when step ≤ 1", () => {
    expect(roundTo(99.6, 1)).toBe(100);
  });
});

describe("bundlePrice", () => {
  it("applies percent discount then rounds", () => {
    // 100000 - 5% = 95000
    expect(bundlePrice(100000, 5, 100)).toBe(95000);
  });
  it("rounds the discounted amount to the step", () => {
    // 45000 - 7% = 41850 -> nearest 100 = 41900
    expect(bundlePrice(45000, 7, 100)).toBe(41900);
  });
  it("never goes negative", () => {
    expect(bundlePrice(0, 5, 100)).toBe(0);
  });
});

describe("memberPrices", () => {
  it("sums members per ml and discounts", () => {
    const members = [
      member({ 5: 20000, 10: 35000, 20: 60000 }),
      member({ 5: 25000, 10: 40000, 20: 70000 }),
    ];
    const prices = memberPrices(members, 5, 100);
    const at5 = prices.find((p) => p.ml === 5)!;
    expect(at5.memberSum).toBe(45000);
    expect(at5.price).toBe(bundlePrice(45000, 5, 100));
    expect(at5.saved).toBe(at5.memberSum - at5.price);
    expect(at5.available).toBe(true);
  });

  it("marks an ml unavailable when any member is out of stock there", () => {
    const members = [
      member({ 5: 20000, 10: 35000, 20: 60000 }, [5, 10]), // 20 out
      member({ 5: 25000, 10: 40000, 20: 70000 }),
    ];
    const prices = memberPrices(members, 5, 100);
    expect(prices.find((p) => p.ml === 20)!.available).toBe(false);
    expect(prices.find((p) => p.ml === 5)!.available).toBe(true);
  });

  it("is unavailable with no members", () => {
    expect(memberPrices([], 5, 100).every((p) => !p.available)).toBe(true);
  });

  it("charges the per-ml override and the default elsewhere", () => {
    const members = [
      member({ 5: 20000, 10: 35000, 20: 60000 }),
      member({ 5: 25000, 10: 40000, 20: 70000 }),
    ];
    const prices = memberPrices(members, 5, 100, { 20: 15 });
    const at20 = prices.find((p) => p.ml === 20)!;
    const at5 = prices.find((p) => p.ml === 5)!;
    expect(at20.discountPct).toBe(15);
    expect(at20.price).toBe(bundlePrice(130000, 15, 100));
    // Untouched sizes keep the bundle default — this is what lets every
    // pre-0051 bundle price exactly as it did before.
    expect(at5.discountPct).toBe(5);
    expect(at5.price).toBe(bundlePrice(45000, 5, 100));
  });

  it("treats a 0% override as a real override, not as absent", () => {
    const members = [member({ 5: 20000 }), member({ 5: 25000 })];
    const at5 = memberPrices(members, 10, 100, { 5: 0 }).find(
      (p) => p.ml === 5,
    )!;
    expect(at5.discountPct).toBe(0);
    expect(at5.price).toBe(45000);
  });
});

describe("discountForMl", () => {
  it("prefers the override", () => {
    expect(discountForMl(20, 5, { 20: 12 })).toBe(12);
  });
  it("falls back to the default", () => {
    expect(discountForMl(10, 5, { 20: 12 })).toBe(5);
    expect(discountForMl(10, 5)).toBe(5);
  });
});

describe("discountRange", () => {
  const rows = (pcts: Record<number, number>) =>
    Object.entries(pcts).map(([ml, discountPct]) => ({
      ml: Number(ml),
      memberSum: 0,
      price: 0,
      discountPct,
      saved: 0,
      available: true,
    }));

  it("spans only the buyable sizes", () => {
    // 20ml discounts hardest but is sold out, so it must not be advertised.
    const r = discountRange(rows({ 2: 5, 5: 8, 10: 10, 20: 30 }), [2, 5, 10]);
    expect(r).toEqual({ min: 5, max: 10 });
  });

  it("falls back to every size when nothing is buyable", () => {
    expect(discountRange(rows({ 2: 5, 5: 10 }), [])).toEqual({
      min: 5,
      max: 10,
    });
  });
});

describe("formatDiscountRange", () => {
  it("collapses a flat span to one figure", () => {
    expect(formatDiscountRange({ min: 10, max: 10 })).toBe("10%");
  });
  it("shows a span", () => {
    expect(formatDiscountRange({ min: 5, max: 10 })).toBe("5-10%");
  });
  it("is empty when there is no discount", () => {
    expect(formatDiscountRange({ min: 0, max: 0 })).toBe("");
  });
});
