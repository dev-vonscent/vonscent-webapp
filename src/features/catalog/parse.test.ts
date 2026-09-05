import { describe, expect, it } from "vitest";
import { parseFilters } from "./parse";

describe("parseFilters — featured (backlog C2)", () => {
  it("featured=1 / true → featured: true", () => {
    expect(parseFilters({ featured: "1" }).featured).toBe(true);
    expect(parseFilters({ featured: "true" }).featured).toBe(true);
  });
  it("бусад утга эсвэл байхгүй бол шүүлт тавихгүй", () => {
    expect(parseFilters({}).featured).toBeUndefined();
    expect(parseFilters({ featured: "0" }).featured).toBeUndefined();
    expect(parseFilters({ featured: ["1", "0"] }).featured).toBe(true);
  });
});
