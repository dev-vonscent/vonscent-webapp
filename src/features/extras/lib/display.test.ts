import { describe, expect, it } from "vitest";
import { bottleSizeText, stockText } from "./display";

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
  it("тоо, үлдэгдэлгүй, хязгааргүй", () => {
    expect(
      stockText({ mode: "local_quantity", stock: 6, soldOut: false }),
    ).toBe("Үлдэгдэл: 6 ширхэг");
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
