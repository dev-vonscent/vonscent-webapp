import { describe, expect, it } from "vitest";
import { bottleSizeText, eyebrowText, stockText } from "./display";

describe("bottleSizeText", () => {
  it("хоосон шил 0/N, бүтэн шил N/N", () => {
    expect(
      bottleSizeText({
        bottleMl: 125,
        categorySlug: "empty-bottle",
        mode: "local_quantity",
      }),
    ).toBe("0/125ml");
    expect(
      bottleSizeText({
        bottleMl: 100,
        categorySlug: "bottled",
        mode: "local_quantity",
      }),
    ).toBe("100/100ml");
  });
  it("хэмжээгүй эсвэл үлдэгдэлтэй шил — null", () => {
    expect(
      bottleSizeText({
        bottleMl: null,
        categorySlug: "empty-bottle",
        mode: "local_quantity",
      }),
    ).toBeNull();
    expect(
      bottleSizeText({
        bottleMl: 100,
        categorySlug: "bottled",
        mode: "leftover_liquid",
      }),
    ).toBeNull();
  });
});

describe("stockText", () => {
  it("цөөн үлдсэн, олон, үлдэгдэлгүй, хязгааргүй", () => {
    expect(
      stockText({ mode: "local_quantity", stock: 2, soldOut: false }),
    ).toBe("Сүүлийн 2 ширхэг");
    expect(
      stockText({ mode: "local_quantity", stock: 210, soldOut: false }),
    ).toBeNull();
    expect(stockText({ mode: "local_quantity", stock: 0, soldOut: true })).toBe(
      "Дууссан",
    );
    expect(
      stockText({ mode: "shared_vial", stock: null, soldOut: false }),
    ).toBeNull();
    expect(
      stockText({ mode: "leftover_liquid", stock: 1, soldOut: false }),
    ).toBeNull();
  });
});

describe("eyebrowText", () => {
  const base = { leftover: null, categoryName: "Шилтэй ус" } as const;
  it("лацтай шил «Бүтэн ус», үлдэгдэлтэй шил брэнд, бусад ангилал", () => {
    expect(
      eyebrowText({ ...base, categorySlug: "bottled", mode: "local_quantity" }),
    ).toBe("Бүтэн ус");
    expect(
      eyebrowText({
        ...base,
        categorySlug: "bottled",
        mode: "leftover_liquid",
        leftover: {
          brand: "Versace",
          productName: "",
          remainingMl: 10,
          fullMl: 100,
        },
      }),
    ).toBe("Versace");
    expect(
      eyebrowText({
        leftover: null,
        categoryName: "Хоосон шил",
        categorySlug: "empty-bottle",
        mode: "local_quantity",
      }),
    ).toBe("Хоосон шил");
  });
});
