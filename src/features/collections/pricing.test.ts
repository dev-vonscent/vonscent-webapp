import { describe, it, expect } from "vitest";
import { salePctText } from "@/features/products/sale";
import {
  bundleEventSale,
  bundleCardPrice,
  roundTo,
  bundlePrice,
  memberPrices,
  memberUnitPrice,
  discountForMl,
  discountRange,
  formatDiscountRange,
  withEventPcts,
  bundleEventSaving,
  spreadBundleTotal,
  priceWithBundleEvent,
  bundleSaleEndsAt,
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
    scentFamilies: [],
    seasons: [],
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

  it("keeps a 0% size in the span", () => {
    // Гишүүдийн 2ml хямдарсан тул тогтмол үнэтэй 2ml багц хэмнэлтгүй болсон.
    expect(discountRange(rows({ 2: 0, 5: 5, 10: 5 }), [2, 5, 10])).toEqual({
      min: 0,
      max: 5,
    });
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
    expect(formatDiscountRange({ min: 5, max: 10 })).toBe("10% хүртэл");
  });
  it("reads «up to» when a size has no cut at all", () => {
    expect(formatDiscountRange({ min: 0, max: 5 })).toBe("5% хүртэл");
  });
  it("is empty when there is no discount", () => {
    expect(formatDiscountRange({ min: 0, max: 0 })).toBe("");
  });
});

describe("memberPrices — үнийн суурь: ҮНДСЭН үнэ (plan §5.3, task 8.2)", () => {
  // Гишүүн бүр 5ml: үндсэн 40,000; эхнийх нь арга хэмжээгээр 32,000.
  const withBase = (price: number, basePrice: number): CollectionMember => ({
    ...member({ 5: price }),
    variantByMl: {
      5: { variantId: "v5", price, basePrice, inStock: true },
    },
  });
  const members = [withBase(32000, 40000), withBase(40000, 40000)];

  it("бэлэн ба угсарсан багц — үндсэн үнийн нийлбэрээс, хямдрал дамжихгүй", () => {
    const at5 = memberPrices(members, 10, 100).find((p) => p.ml === 5)!;
    // (40,000 + 40,000) × 0.9 = 72,000 — өмнөх B5 «давхарлах» дүрмээр
    // (32,000 + 40,000) × 0.9 = 64,800 болдог байсан.
    expect(at5.memberSum).toBe(80000);
    expect(at5.price).toBe(72000);
  });

  it("basePrice байхгүй (хуучин өгөгдөл) бол price", () => {
    const at5 = memberPrices([member({ 5: 30000 })], 10, 100).find(
      (p) => p.ml === 5,
    )!;
    expect(at5.memberSum).toBe(30000);
  });

  it("override нь суурь хувийг орлоно, нэмэгдэхгүй (16.7-д өргөтгөх загвар)", () => {
    // 100,000₮, суурь 5% → 95,000₮; хэмжээний хувь 10% → 90,000₮.
    const one = [withBase(50000, 50000), withBase(50000, 50000)];
    expect(memberPrices(one, 5, 100).find((p) => p.ml === 5)!.price).toBe(
      95000,
    );
    expect(
      memberPrices(one, 5, 100, { 5: 10 }).find((p) => p.ml === 5)!.price,
    ).toBe(90000);
  });

  it("memberUnitPrice: үргэлж үндсэн үнэ", () => {
    expect(memberUnitPrice({ price: 32000, basePrice: 40000 })).toBe(40000);
    expect(memberUnitPrice({ price: 30000 })).toBe(30000);
  });
});

describe("арга хэмжээнд орсон багц (task 16.7)", () => {
  // 2 гишүүн × 10ml, үндсэн 50,000 → нийлбэр 100,000₮.
  const at10 = (price: number, basePrice: number): CollectionMember => ({
    ...member({ 10: price }),
    variantByMl: {
      10: { variantId: "v10", price, basePrice, inStock: true },
    },
  });
  const bundle = [at10(50000, 50000), at10(50000, 50000)];
  const priceAt = (defaultPct: number, overrides = {}) =>
    memberPrices(bundle, defaultPct, 100, overrides).find((p) => p.ml === 10)!;

  it("event хувь суурийг ОРЛОНО: 100,000₮, суурь 5% → 95,000₮, Black Friday 10% → 90,000₮", () => {
    expect(priceAt(5).price).toBe(95000);
    const o = withEventPcts(5, {}, { 10: 10 });
    expect(o).toEqual({ 10: 10 });
    expect(priceAt(5, o).price).toBe(90000);
    // Задаргаа: «Багцын хямдрал» 5,000 + «Black Friday» 5,000.
    expect(bundleEventSaving(100000, 5, 90000, 100)).toBe(5000);
    expect(100000 - 90000 - bundleEventSaving(100000, 5, 90000, 100)).toBe(
      5000,
    );
  });

  it("greatest хамгаалалт: суурь 15% / event 10% → 15% хэвээр (үнэтэй болохгүй)", () => {
    const o = withEventPcts(15, {}, { 10: 10 });
    expect(o).toEqual({ 10: 15 });
    expect(priceAt(15, o).price).toBe(85000);
    expect(bundleEventSaving(100000, 15, 85000, 100)).toBe(0);
  });

  it("хэмжээний override-той: суурь 5%, 10ml-д 12% → event 10% нь 12%-ийг давж чадахгүй", () => {
    expect(withEventPcts(5, { 10: 12 }, { 10: 10 })).toEqual({ 10: 12 });
    expect(withEventPcts(5, { 10: 12 }, { 10: 20 })).toEqual({ 10: 20 });
  });

  it("event-д ороогүй хэмжээ суурь хувиараа үлдэнэ", () => {
    const o = withEventPcts(5, { 2: 8 }, { 10: 10 });
    expect(o).toEqual({ 2: 8, 10: 10 });
    expect(discountForMl(5, 5, o)).toBe(5);
  });

  it("гишүүн үнэртэн мөн event-д орсон ч давхар хямдрахгүй (үндсэн үнээс)", () => {
    // Гишүүн бүр event-ээр 40,000 болсон — багц үндсэн 100,000-аас бодно.
    const discounted = [at10(40000, 50000), at10(40000, 50000)];
    const p = memberPrices(
      discounted,
      5,
      100,
      withEventPcts(5, {}, { 10: 10 }),
    ).find((x) => x.ml === 10)!;
    expect(p.memberSum).toBe(100000);
    expect(p.price).toBe(90000); // 72,000 биш (80,000 × 0.9)
  });

  it("event хоосон (туг хаалттай) бол overrides өөрчлөгдөхгүй", () => {
    expect(withEventPcts(5, { 2: 8 }, {})).toEqual({ 2: 8 });
    expect(priceAt(5, withEventPcts(5, {}, {})).price).toBe(95000);
  });

  it("тэгшлэлт: 123,400₮, суурь 5% → 117,200; event 10% → 111,100 (зөрүү 6,100)", () => {
    expect(bundlePrice(123400, 5, 100)).toBe(117200);
    expect(bundlePrice(123400, 10, 100)).toBe(111100);
    expect(bundleEventSaving(123400, 5, 111100, 100)).toBe(6100);
  });
});

describe("spreadBundleTotal — гишүүдийн unit_price", () => {
  it("4 × 25,000, багц 90,000 → 22,500 бүр, нийлбэр яг 90,000", () => {
    expect(spreadBundleTotal([25000, 25000, 25000, 25000], 90000)).toEqual([
      22500, 22500, 22500, 22500,
    ]);
  });
  it("тэгшлэлтийн үлдэгдлийг сүүлийн гишүүн авна", () => {
    const u = spreadBundleTotal([30000, 33000, 40100], 98000);
    expect(u.reduce((s, x) => s + x, 0)).toBe(98000);
    expect(u).toEqual([28516, 31368, 38116]);
  });
});

describe("багцын тоолуурын мөч — priceWithBundleEvent + bundleSaleEndsAt (2.2)", () => {
  const members = [
    member({ 5: 40000, 10: 70000 }),
    member({ 5: 60000, 10: 90000 }),
  ];
  const bf = {
    slug: "black-friday",
    name: "Black Friday",
    pcts: { 5: 10, 10: 10 },
    endsAt: "2026-11-21T16:00:00Z",
  };

  it("event-д орсон (хувь > суурь) багц → event-ийн дуусах мөч", () => {
    const { prices, event } = priceWithBundleEvent(members, 5, {}, 100, bf);
    expect(prices.find((p) => p.ml === 5)?.price).toBe(90000);
    expect(event).toBe(bf);
    expect(bundleSaleEndsAt({ event })).toBe("2026-11-21T16:00:00Z");
  });

  it("зөвхөн суурь хувьтай (event-гүй) багц → хугацаагүй", () => {
    const { prices, event } = priceWithBundleEvent(members, 5, {}, 100, null);
    expect(prices.find((p) => p.ml === 5)?.price).toBe(95000);
    expect(event).toBeNull();
    expect(bundleSaleEndsAt({ event })).toBeNull();
  });

  it("event хувь ≤ суурь хувь (greatest — үйлчлэхгүй) → хугацаагүй", () => {
    const low = { ...bf, pcts: { 5: 10, 10: 10 } };
    const { prices, event } = priceWithBundleEvent(members, 15, {}, 100, low);
    expect(prices.find((p) => p.ml === 5)?.price).toBe(85000);
    expect(event).toBeNull();
    expect(bundleSaleEndsAt({ event })).toBeNull();
    // Тэнцүү хувь ч мөн адил.
    expect(priceWithBundleEvent(members, 10, {}, 100, low).event).toBeNull();
  });
});

describe("bundleCardPrice (task 2.5, сл.4–6)", () => {
  const row = (ml: number, pct: number, available = true) => {
    const memberSum = ml * 10_000;
    return {
      ml,
      memberSum,
      price: Math.round(memberSum * (1 - pct / 100)),
      nominalDiscountPct: pct,
      available,
    };
  };

  it("хамгийн их хувьтай хэмжээ (суурь 5%, event 10ml-д 10%) → 10ml", () => {
    expect(bundleCardPrice([row(2, 5), row(5, 5), row(10, 10)])).toEqual({
      ml: 10,
      price: 90_000,
      memberSum: 100_000,
      pct: 10,
    });
  });

  it("хувь тэнцвэл жижиг хэмжээ (энгийн 5% багц → 2ml)", () => {
    expect(bundleCardPrice([row(5, 5), row(2, 5)])).toMatchObject({
      ml: 2,
      pct: 5,
    });
  });

  it("хямдралгүй (0%) багц → null", () => {
    expect(bundleCardPrice([row(2, 0), row(5, 0)])).toBeNull();
  });

  it("дууссан хэмжээг тооцохгүй", () => {
    expect(bundleCardPrice([row(2, 5), row(5, 20, false)])).toMatchObject({
      ml: 2,
    });
  });
});

describe("bundleEventSale — багцын event chip-ийн хувь (2.4 дүрэм)", () => {
  const prices = [2, 5, 10, 20].map((ml) => ({ ml, available: true }));
  const base = { prices, discountPct: 5, mlDiscounts: {} };

  it("event бүх хэмжээнд 10% → «10%»", () => {
    const s = bundleEventSale({
      ...base,
      event: { pcts: { 2: 10, 5: 10, 10: 10, 20: 10 } },
    });
    expect(salePctText(s)).toBe("10%");
  });

  it("суурь 5% нь хямдралгүйд тооцогдоно → «~10%»", () => {
    const s = bundleEventSale({ ...base, event: { pcts: { 2: 10, 5: 10 } } });
    expect(salePctText(s)).toBe("~10%");
  });

  it("хэмжээний суурь хувь (mlDiscounts) event-ээс их бол тэр хэмжээ хямдралгүй", () => {
    const s = bundleEventSale({
      ...base,
      mlDiscounts: { 20: 12 },
      event: { pcts: { 2: 10, 5: 10, 10: 10, 20: 10 } },
    });
    expect(salePctText(s)).toBe("~10%");
  });

  it("зарагдахгүй хэмжээг тооцохгүй", () => {
    const s = bundleEventSale({
      ...base,
      prices: prices.map((p) => ({ ...p, available: p.ml !== 20 })),
      event: { pcts: { 2: 10, 5: 10, 10: 10, 20: 30 } },
    });
    expect(salePctText(s)).toBe("10%");
  });

  it("event хувь ≤ суурь, эсвэл event-гүй → null", () => {
    expect(
      bundleEventSale({ ...base, event: { pcts: { 2: 5, 5: 4 } } }),
    ).toBeNull();
    expect(bundleEventSale({ ...base, event: null })).toBeNull();
  });
});
