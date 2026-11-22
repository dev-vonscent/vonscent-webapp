import { describe, expect, it } from "vitest";
import {
  brandCounts,
  countBottleTabs,
  extraSection,
  filterBottles,
  legacyExtrasHref,
  parseBottleFilters,
  resolveBottleTab,
} from "./sections";

const bottle = (
  name: string,
  categorySlug: string,
  mode: "local_quantity" | "leftover_liquid" = "local_quantity",
  brand: string | null = null,
  soldOut = false,
) => ({
  name,
  categorySlug,
  mode,
  soldOut,
  fromPrice: 10000,
  perfume: brand ? { brand, name } : null,
});

describe("extraSection", () => {
  it("шил «Үнэртний шил»-д, бусад нь «Дагалдах хэрэгсэл»-д", () => {
    expect(extraSection(bottle("a", "empty-bottle"))).toBe("bottles");
    expect(extraSection(bottle("a", "bottled"))).toBe("bottles");
    expect(extraSection(bottle("a", "bottled", "leftover_liquid"))).toBe(
      "bottles",
    );
    for (const slug of ["syringe", "vial", "gift-box", "шинэ-ангилал"])
      expect(extraSection(bottle("a", slug))).toBe("accessories");
  });
});

describe("tab", () => {
  const items = [
    bottle("a", "empty-bottle"),
    bottle("b", "empty-bottle"),
    bottle("c", "bottled", "leftover_liquid"),
  ];
  it("горимоор тоолно", () => {
    expect(countBottleTabs(items)).toEqual({
      sealed: 0,
      leftover: 1,
      empty: 2,
    });
  });
  it("URL-ийн tab бараатай бол түүнийг, үгүй бол бараатай эхнийг", () => {
    const counts = countBottleTabs(items);
    expect(resolveBottleTab("empty", counts)).toBe("empty");
    expect(resolveBottleTab("sealed", counts)).toBe("leftover");
    expect(resolveBottleTab("буруу", counts)).toBe("leftover");
    expect(resolveBottleTab(null, { sealed: 0, leftover: 0, empty: 0 })).toBe(
      null,
    );
  });
});

describe("брэнд", () => {
  it("олноос цөөн рүү, холбоогүйг алгасна", () => {
    expect(
      brandCounts([
        bottle("a", "empty-bottle", "local_quantity", "Creed"),
        bottle("b", "empty-bottle", "local_quantity", "Dior"),
        bottle("c", "empty-bottle", "local_quantity", "Dior"),
        bottle("d", "empty-bottle"),
      ]),
    ).toEqual([
      { brand: "Dior", count: 2 },
      { brand: "Creed", count: 1 },
    ]);
  });
});

describe("filterBottles", () => {
  const items = [
    bottle("Sauvage", "empty-bottle", "local_quantity", "Dior"),
    bottle("Aventus", "empty-bottle", "local_quantity", "Creed", true),
    bottle("Нэргүй шил", "empty-bottle"),
  ];
  const f = (qs: string) =>
    filterBottles(items, parseBottleFilters(new URLSearchParams(qs))).map(
      (e) => e.name,
    );
  it("брэнд, хайлт (брэндээр ч), байгаа бараа", () => {
    expect(f("")).toHaveLength(3);
    expect(f("brand=Dior,Creed")).toEqual(["Sauvage", "Aventus"]);
    expect(f("q=creed")).toEqual(["Aventus"]);
    expect(f("q=xyz")).toEqual([]);
    expect(f("stock=1")).toEqual(["Sauvage", "Нэргүй шил"]);
  });
});

describe("filterBottles — каталог маягийн шинж", () => {
  const withFacets = (
    name: string,
    fromPrice: number,
    gender: string,
    families: string[],
    seasons: string[],
  ) => ({
    ...bottle(name, "bottled", "local_quantity", "Creed"),
    fromPrice,
    facets: { gender, families, seasons },
  });
  const items = [
    withFacets("A", 750000, "male", ["woody"], ["winter"]),
    withFacets("B", 120000, "female", ["floral"], ["all"]),
    { ...bottle("C", "bottled"), facets: null },
  ];
  const f = (qs: string) =>
    filterBottles(items, parseBottleFilters(new URLSearchParams(qs))).map(
      (e) => e.name,
    );
  it("хүйс, үнэрийн төрөл, үнэ; «Бүх улирал» дан улиралд тохирно", () => {
    expect(f("gender=male")).toEqual(["A"]);
    expect(f("family=floral,woody")).toEqual(["A", "B"]);
    expect(f("season=winter")).toEqual(["A", "B"]);
    expect(f("season=summer")).toEqual(["B"]);
    expect(f("maxPrice=200000")).toEqual(["B", "C"]);
    expect(f("minPrice=200000")).toEqual(["A"]);
  });
});

describe("legacyExtrasHref", () => {
  it("шилний ангилал «Үнэртний шил» руу, бусад «Дагалдах хэрэгсэл» руу", () => {
    expect(legacyExtrasHref({})).toBe("/accessories");
    expect(legacyExtrasHref({ cat: "empty-bottle", q: "dior" })).toBe(
      "/bottles?type=empty&q=dior",
    );
    expect(legacyExtrasHref({ cat: "bottled", tab: "extras" })).toBe(
      "/bottles",
    );
    expect(legacyExtrasHref({ cat: "gift-box", q: "x" })).toBe("/accessories");
    expect(legacyExtrasHref({ cat: "gift-box,empty-bottle" })).toBe(
      "/accessories",
    );
  });
});
