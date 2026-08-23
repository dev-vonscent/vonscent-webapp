import { describe, expect, it } from "vitest";
import { paginationItems } from "./catalog-pagination";

describe("paginationItems", () => {
  it("lists every page when there are few", () => {
    expect(paginationItems(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("truncates the middle from the first page", () => {
    expect(paginationItems(1, 40)).toEqual([1, 2, "…", 39, 40]);
  });

  it("keeps neighbours around the current page", () => {
    expect(paginationItems(20, 40)).toEqual([1, 2, "…", 19, 20, 21, "…", 39, 40]);
  });

  it("fills a single-page gap with the page itself", () => {
    expect(paginationItems(4, 40)).toEqual([1, 2, 3, 4, 5, "…", 39, 40]);
  });

  it("truncates only the left side near the end", () => {
    expect(paginationItems(39, 40)).toEqual([1, 2, "…", 38, 39, 40]);
  });
});
