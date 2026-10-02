import { describe, expect, it } from "vitest";
import { nextCatalogPage } from "./catalog-infinite-grid";

const page = (page: number, total: number) => ({
  items: [],
  page,
  perPage: 24,
  total,
});

describe("nextCatalogPage", () => {
  it("asks for the next page while products remain", () => {
    expect(nextCatalogPage(page(1, 50))).toBe(2);
    expect(nextCatalogPage(page(2, 50))).toBe(3);
  });

  it("stops once the last page is loaded", () => {
    expect(nextCatalogPage(page(3, 50))).toBeUndefined();
    expect(nextCatalogPage(page(2, 48))).toBeUndefined();
    expect(nextCatalogPage(page(1, 0))).toBeUndefined();
  });
});
