import { describe, expect, it } from "vitest";
import { bestValueOf } from "./best-value";

const v = (ml: number, price: number, extra: object = {}) => ({
  id: `${ml}`,
  ml,
  price,
  ...extra,
});

describe("bestValueOf", () => {
  it("picks the lowest ₮/ml", () => {
    const sizes = [v(2, 12000), v(5, 25000), v(10, 45000), v(20, 80000)];
    expect(bestValueOf(sizes)?.ml).toBe(20);
  });

  it("stays on the cheapest ₮/ml even when that size is sold out", () => {
    // Урьд нь зөвхөн нөөцтэй хэмжээнээс сонгодог байсан тул 20ml дуусахад
    // тэмдэг 10ml руу үсэрдэг байв (клиент, 2026-09 UG).
    const sizes = [
      v(5, 25000, { inStock: true }),
      v(10, 45000, { inStock: true }),
      v(20, 80000, { inStock: false }),
    ];
    expect(bestValueOf(sizes)?.ml).toBe(20);
  });

  it("prefers the larger size on a tie", () => {
    expect(bestValueOf([v(5, 20000), v(10, 40000)])?.ml).toBe(10);
  });

  it("returns null when there is nothing to compare", () => {
    expect(bestValueOf([])).toBeNull();
    expect(bestValueOf([v(5, 20000)])).toBeNull();
  });

  it("ignores unpriced sizes", () => {
    expect(bestValueOf([v(5, 20000), v(20, 0)])).toBeNull();
    expect(bestValueOf([v(2, 0), v(5, 20000), v(10, 30000)])?.ml).toBe(10);
  });
});
