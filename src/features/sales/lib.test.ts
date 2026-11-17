import { describe, expect, it } from "vitest";
import {
  UNNAMED_SALE_ID,
  busyProducts,
  derivePcts,
  formatPcts,
  formatSalePeriod,
  memberIds,
  periodPhase,
  productsWithoutDiscount,
  summarizeSales,
  validPcts,
  type SaleProductRow,
  type SaleVariantRow,
} from "./lib";

const now = Date.parse("2026-11-17T06:00:00Z");
const future = "2026-11-21T16:00:00Z";
const past = "2026-10-31T16:00:00Z";

function v(
  ml: number,
  price: number,
  extra: Partial<SaleVariantRow> = {},
): SaleVariantRow {
  return {
    ml,
    price,
    salePrice: null,
    saleStartsAt: null,
    saleEndsAt: null,
    isActive: true,
    saleId: null,
    ...extra,
  };
}

function p(id: string, variants: SaleVariantRow[]): SaleProductRow {
  return { id, name: id, brand: "B", gender: "unisex", variants };
}

const march = { id: "s1", name: "Март 8", pcts: { "5": 10 }, startsAt: null, endsAt: future };

const products = [
  // Март 8-д: 5ml 10%.
  p("aventus", [v(5, 30000, { salePrice: 27000, saleEndsAt: future, saleId: "s1" }), v(10, 55000)]),
  // Хуучин нэргүй, дууссан (16.1-ийн The Most Wanted шиг).
  p("wanted", [v(2, 17000, { salePrice: 15300, saleEndsAt: past })]),
  // Хуучин нэргүй, хүчинтэй.
  p("sauvage", [v(5, 40000, { salePrice: 36000, saleEndsAt: future })]),
  p("plain", [v(5, 20000), v(10, 36000, { isActive: false })]),
];

describe("periodPhase", () => {
  it("эхлээгүй / хүчинтэй / дууссан", () => {
    expect(periodPhase(future, "2026-12-01T00:00:00Z", now)).toBe("scheduled");
    expect(periodPhase(null, future, now)).toBe("active");
    expect(periodPhase(null, past, now)).toBe("ended");
  });
});

describe("summarizeSales", () => {
  it("нэрт хямдрал + нэг «Нэргүй» мөр (16.6)", () => {
    const rows = summarizeSales([march], products, now);
    expect(rows.map((r) => [r.name, r.phase, r.productCount])).toEqual([
      ["Март 8", "active", 1],
      ["Нэргүй", "active", 2],
    ]);
    const unnamed = rows.find((r) => r.unnamed);
    expect(unnamed?.id).toBe(UNNAMED_SALE_ID);
    expect(unnamed?.pcts).toEqual({ "2": 10, "5": 10 });
  });

  it("нэргүй мөргүй бол «Нэргүй» мөр гарахгүй", () => {
    expect(summarizeSales([march], [products[0]], now)).toHaveLength(1);
  });
});

describe("busyProducts (16.3)", () => {
  it("өөр дуусаагүй хямдрал → нэр; дууссан нь саад биш", () => {
    const busy = busyProducts(products, [march], null, now);
    expect(Object.fromEntries(busy)).toEqual({
      aventus: "Март 8",
      sauvage: "Нэргүй",
    });
  });

  it("өөрийн хямдрал саад биш; «Нэргүй»-г засахад нэргүй мөр саад биш", () => {
    expect(busyProducts(products, [march], "s1", now).has("aventus")).toBe(false);
    const unnamed = busyProducts(products, [march], UNNAMED_SALE_ID, now);
    expect(unnamed.has("sauvage")).toBe(false);
    expect(unnamed.get("aventus")).toBe("Март 8");
  });
});

describe("memberIds", () => {
  it("нэрт / нэргүй", () => {
    expect(memberIds(products, "s1")).toEqual(["aventus"]);
    expect(memberIds(products, UNNAMED_SALE_ID)).toEqual(["wanted", "sauvage"]);
  });
});

describe("productsWithoutDiscount (16.5)", () => {
  it("хувьтай хэмжээ нь зарагдахгүй / байхгүй бараа", () => {
    const bad = productsWithoutDiscount(products, ["plain", "aventus"], { "10": 10 });
    expect(bad.map((x) => x.id)).toEqual(["plain"]);
    expect(productsWithoutDiscount(products, ["plain"], { "5": 10 })).toEqual([]);
  });
});

describe("derivePcts / validPcts", () => {
  it("100₮-ийн тоймлолттой ч хувийг олно", () => {
    // 37000 × 0.85 = 31450 → 31500 (тоймлосон) → 14.86% → 15%.
    expect(derivePcts([v(5, 37000, { salePrice: 31500 })])).toEqual({ "5": 15 });
  });

  it("зөвхөн 1..max бүхэл тоо", () => {
    expect(validPcts({ "2": "10", "5": "", "10": "95", "20": "2.5" }, 90)).toEqual({
      "2": 10,
    });
  });
});

describe("formatSalePeriod / formatPcts", () => {
  it("УБ өдрөөр, exclusive төгсгөлийг өмнөх өдөр гэж", () => {
    expect(formatSalePeriod("2026-11-12T16:00:00Z", "2026-11-21T16:00:00Z")).toBe(
      "2026.11.13 – 11.21",
    );
    expect(formatSalePeriod(null, past)).toBe("2026.10.31 хүртэл");
    expect(formatSalePeriod(null, null)).toBe("Хугацаагүй");
  });

  it("хэмжээний дарааллаар", () => {
    expect(formatPcts({ "10": 15, "2": 10 })).toBe("2ml 10% · 10ml 15%");
    expect(formatPcts({})).toBe("Хувьгүй");
  });
});
