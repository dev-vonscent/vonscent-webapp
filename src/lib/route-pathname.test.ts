import { describe, expect, it } from "vitest";
import { normalizeRoutePathname } from "./route-pathname";

describe("normalizeRoutePathname", () => {
  it("ISR-ийн `/index`-ийг нүүр болгоно", () => {
    expect(normalizeRoutePathname("/index")).toBe("/");
  });
  it("бусад замыг хөндөхгүй", () => {
    expect(normalizeRoutePathname("/")).toBe("/");
    expect(normalizeRoutePathname("/catalog")).toBe("/catalog");
    expect(normalizeRoutePathname("/products/index")).toBe("/products/index");
    expect(normalizeRoutePathname("/indexes")).toBe("/indexes");
  });
});
