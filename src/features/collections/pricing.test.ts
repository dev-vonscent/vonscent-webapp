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
    expect(at20.nominalDiscountPct).toBe(15);
    expect(at20.price).toBe(bundlePrice(130000, 15, 100));
    // Untouched sizes keep the bundle default — this is what lets every
    // pre-0051 bundle price exactly as it did before.
    expect(at5.discountPct).toBe(5);
    expect(at5.nominalDiscountPct).toBe(5);
    expect(at5.price).toBe(bundlePrice(45000, 5, 100));
  });

  it("keeps the nominal % flat even when ₮ rounding drifts the real %", () => {
    // memberSum = 2050, 5% off = 1947.5 -> nearest 100 = 1900 -> real
    // pct = round(150/2050*100) = 7, even though nothing was overridden.
    const members = [member({ 5: 1000 }, [5]), member({ 5: 1050 }, [5])];
    const at5 = memberPrices(members, 5, 100).find((p) => p.ml === 5)!;
    expect(at5.price).toBe(1900);
    expect(at5.discountPct).toBe(7); // ₮ rounding nudged the real %
    expect(at5.nominalDiscountPct).toBe(5); // but the promised % holds
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
    Object.entries(pcts).map(([ml, nominalDiscountPct]) => ({
      ml: Number(ml),
      nominalDiscountPct,
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

  it("collapses to one figure when sizes only differ by ₮-rounding noise", () => {
    // Бүгд нэг 5%-ийн амлалттай ч 100₮-т тэгшлэхэд бодит хувь нь ml тус
    // бүрээр өөр гарч болно (`discountPct`) — badge үүнийг харахгүй ёстой.
    const members = [
      member({ 5: 1000, 10: 20000 }, [5, 10]),
      member({ 5: 1050, 10: 20100 }, [5, 10]),
    ];
    const prices = memberPrices(members, 5, 100);
    expect(prices.find((p) => p.ml === 5)!.discountPct).toBe(7); // rounding drift
    expect(prices.find((p) => p.ml === 10)!.discountPct).toBe(5); // no drift here
    expect(discountRange(prices, [5, 10])).toEqual({ min: 5, max: 5 });
  });

  it("still shows a genuine range when sizes have real per-ml overrides", () => {
    const members = [
      member({ 5: 20000, 20: 60000 }, [5, 20]),
      member({ 5: 25000, 20: 70000 }, [5, 20]),
    ];
    const prices = memberPrices(members, 5, 100, { 20: 15 });
    expect(discountRange(prices, [5, 20])).toEqual({ min: 5, max: 15 });
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

/**
 * Preset багцын тогтмол үнэ (0054, backlog B6). Гишүүн барааны үнэ хөдөлсөн ч
 * багцын үнэ хөдлөхгүй байх нь энэ шаардлагын гол утга — тиймээс тэрийг
 * шууд тестээр барина.
 */
describe("memberPrices — тогтмол үнэ", () => {
  const members = [
    member({ 5: 20000, 10: 35000, 20: 60000 }),
    member({ 5: 25000, 10: 40000, 20: 70000 }),
  ];

  it("тогтмол үнэ өгсөн хэмжээнд хувийн тооцоог бүрэн орлоно", () => {
    const at10 = memberPrices(members, 5, 100, {}, { 10: 60000 }).find(
      (p) => p.ml === 10,
    )!;
    expect(at10.price).toBe(60000);
    expect(at10.memberSum).toBe(75000);
    expect(at10.saved).toBe(15000);
    // Харуулах хувь нь бодит хэмнэлтээс: 15000 / 75000 = 20%.
    expect(at10.discountPct).toBe(20);
    // Тогтмол үнэтэй хэмжээнд амласан % огт байхгүй тул badge-д ч бодит
    // хувиараа л орлуулна (`discountPct`-тай адил).
    expect(at10.nominalDiscountPct).toBe(20);
  });

  it("тогтмол үнэгүй хэмжээ хуучин дүрмээрээ бодогдоно", () => {
    const at5 = memberPrices(members, 5, 100, {}, { 10: 60000 }).find(
      (p) => p.ml === 5,
    )!;
    expect(at5.price).toBe(bundlePrice(45000, 5, 100));
  });

  it("гишүүний үнэ өөрчлөгдсөн ч тогтмол үнэ хөдлөхгүй", () => {
    const dearer = [
      member({ 5: 20000, 10: 50000, 20: 60000 }),
      member({ 5: 25000, 10: 55000, 20: 70000 }),
    ];
    const before = memberPrices(members, 5, 100, {}, { 10: 60000 });
    const after = memberPrices(dearer, 5, 100, {}, { 10: 60000 });
    expect(after.find((p) => p.ml === 10)!.price).toBe(
      before.find((p) => p.ml === 10)!.price,
    );
  });

  it("сөрөг үнэ гаргахгүй", () => {
    const at5 = memberPrices(members, 5, 100, {}, { 5: -100 }).find(
      (p) => p.ml === 5,
    )!;
    expect(at5.price).toBe(0);
    expect(at5.saved).toBe(45000);
  });
});
