import { describe, expect, it } from "vitest";
import { catalogCanonical } from "./canonical";

describe("catalogCanonical", () => {
  it("plain catalog points to itself", () => {
    expect(catalogCanonical({}, 5)).toBe("/catalog");
  });

  it("an unfiltered page 2…last is its own canonical", () => {
    expect(catalogCanonical({ page: "2" }, 5)).toBe("/catalog?page=2");
    expect(catalogCanonical({ page: "5" }, 5)).toBe("/catalog?page=5");
  });

  it("a page past the end folds into /catalog", () => {
    expect(catalogCanonical({ page: "6" }, 5)).toBe("/catalog");
    expect(catalogCanonical({ page: "2" }, 1)).toBe("/catalog");
  });

  it.each([["1"], ["0"], ["abc"], ["1.5"], ["2abc"], [""], [["2", "3"]]])(
    "page=%j renders page 1, so it folds into /catalog",
    (page) => {
      expect(catalogCanonical({ page }, 5)).toBe("/catalog");
    },
  );

  it("filtered or sorted views fold into /catalog, with or without a page", () => {
    expect(catalogCanonical({ brand: "Dior" }, 5)).toBe("/catalog");
    expect(catalogCanonical({ page: "2", sort: "price-asc" }, 5)).toBe(
      "/catalog",
    );
    expect(catalogCanonical({ page: "2", brand: "Dior" }, 5)).toBe("/catalog");
    expect(catalogCanonical({ page: "2", q: "dior" }, 5)).toBe("/catalog");
  });

  it("ignores keys whose value is undefined", () => {
    expect(catalogCanonical({ page: "3", sort: undefined }, 5)).toBe(
      "/catalog?page=3",
    );
  });
});
