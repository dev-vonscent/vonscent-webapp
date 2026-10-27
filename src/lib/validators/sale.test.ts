import { describe, expect, it } from "vitest";
import { bulkSalePrice, bulkSaleSchema } from "./sale";

const id = "11111111-1111-4111-8111-111111111111";

describe("bulkSalePrice", () => {
  it("хувиар хасаад 100₮-д дугуйрна", () => {
    expect(bulkSalePrice(123000, 10)).toBe(110700);
    expect(bulkSalePrice(54000, 15)).toBe(45900);
    expect(bulkSalePrice(12345, 10)).toBe(11100);
  });

  it("ойрын 100 руу: 10560 → 10600, 10540 → 10500, 10550 → 10600", () => {
    expect(bulkSalePrice(11734, 10)).toBe(10600); // 10560.6
    expect(bulkSalePrice(11712, 10)).toBe(10500); // 10540.8
    expect(bulkSalePrice(21100, 50)).toBe(10600); // 10550 — тэнцүү бол дээш
  });
});

describe("bulkSaleSchema", () => {
  const base = {
    productIds: [id],
    pcts: { "5": 10 },
    startsAt: null,
    endsAt: "2026-11-01T00:00:00+08:00",
  };

  it("зөв хүсэлт", () => {
    expect(bulkSaleSchema.safeParse(base).success).toBe(true);
  });

  it("хувьгүй, эсвэл 90%-иас их бол татгалзана", () => {
    expect(bulkSaleSchema.safeParse({ ...base, pcts: {} }).success).toBe(false);
    expect(
      bulkSaleSchema.safeParse({ ...base, pcts: { "5": 95 } }).success,
    ).toBe(false);
  });

  it("байхгүй хэмжээ (1ml) татгалзана", () => {
    expect(
      bulkSaleSchema.safeParse({ ...base, pcts: { "1": 10 } }).success,
    ).toBe(false);
  });

  it("дуусах нь эхлэхээс өмнө бол татгалзана", () => {
    expect(
      bulkSaleSchema.safeParse({
        ...base,
        startsAt: "2026-11-02T00:00:00+08:00",
      }).success,
    ).toBe(false);
  });
});
