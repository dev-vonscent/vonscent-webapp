import { describe, expect, it } from "vitest";
import { filterExtras, isBottleCategory, parseExtraFilters } from "./filter";

const item = (name: string, over: object = {}) => ({
  name,
  categoryName: "Шприц",
  categorySlug: "syringe",
  soldOut: false,
  leftover: null,
  ...over,
});

const items = [
  item("Энгийн шприц"),
  item("Хар хайрцаг", {
    categoryName: "Гоёмсог бэлгийн сав",
    categorySlug: "gift-box",
    soldOut: true,
  }),
  item("Aventus", {
    categoryName: "Шилтэй ус",
    categorySlug: "bottled",
    leftover: {
      brand: "Creed",
      productName: "Aventus",
      remainingMl: 40,
      fullMl: 100,
    },
  }),
];

const names = (f: Parameters<typeof filterExtras>[1]) =>
  filterExtras(items, f).map((i) => i.name);

describe("filterExtras", () => {
  it("шүүлтүүргүй бол бүгд", () => {
    expect(names({ cats: [], q: "", inStock: false })).toHaveLength(3);
  });
  it("олон ангиллаар", () => {
    expect(
      names({ cats: ["syringe", "bottled"], q: "", inStock: false }),
    ).toEqual(["Энгийн шприц", "Aventus"]);
  });
  it("зөвхөн байгаа нь", () => {
    expect(names({ cats: [], q: "", inStock: true })).not.toContain(
      "Хар хайрцаг",
    );
  });
  it("брэнд, ангиллын нэрээр хайна", () => {
    expect(names({ cats: [], q: "creed", inStock: false })).toEqual([
      "Aventus",
    ]);
    expect(names({ cats: [], q: "бэлгийн", inStock: false })).toEqual([
      "Хар хайрцаг",
    ]);
  });
});

describe("parseExtraFilters", () => {
  it("URL-аас уншина", () => {
    expect(
      parseExtraFilters(new URLSearchParams("cat=vial,syringe&q= x &stock=1")),
    ).toEqual({ cats: ["vial", "syringe"], q: "x", inStock: true });
  });
});

it("үнэртний шил", () => {
  expect(isBottleCategory("empty-bottle")).toBe(true);
  expect(isBottleCategory("vial")).toBe(false);
});
