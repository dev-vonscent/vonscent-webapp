import { describe, expect, it } from "vitest";
import { variantDraftSchema, unpricedActiveSizes } from "./product";

/**
 * The rule these cover is a money rule, not a formatting one: a size marked
 * "зарна" at 0₮ publishes a free decant that still draws down real ml stock.
 * It shipped that way, so it gets a test on both sides — the schema the route
 * runs, and the predicate the forms block on.
 */
describe("variantDraftSchema", () => {
  it("accepts a priced, active size", () => {
    expect(
      variantDraftSchema.safeParse({ ml: 5, price: 24000, active: true })
        .success,
    ).toBe(true);
  });

  it("accepts an unpriced size that is not on sale", () => {
    // This is how every size starts on the create form.
    expect(
      variantDraftSchema.safeParse({ ml: 2, price: 0, active: false }).success,
    ).toBe(true);
  });

  it("refuses an active size priced at zero", () => {
    const res = variantDraftSchema.safeParse({ ml: 20, price: 0, active: true });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].path).toEqual(["price"]);
    }
  });

  it("keeps 2ml an ordinary size, not a special case", () => {
    // 2ml is priced and sold like 5/10/20 — the schema must not treat it
    // differently in either direction.
    expect(
      variantDraftSchema.safeParse({ ml: 2, price: 9000, active: true }).success,
    ).toBe(true);
    expect(
      variantDraftSchema.safeParse({ ml: 2, price: 0, active: true }).success,
    ).toBe(false);
  });

  it("refuses a size outside ML_SIZES", () => {
    expect(
      variantDraftSchema.safeParse({ ml: 30, price: 50000, active: true })
        .success,
    ).toBe(false);
  });

  it("refuses a fractional price — ₮ are integers", () => {
    expect(
      variantDraftSchema.safeParse({ ml: 5, price: 24000.5, active: true })
        .success,
    ).toBe(false);
  });
});

describe("unpricedActiveSizes", () => {
  it("names every offending size, in the order given", () => {
    expect(
      unpricedActiveSizes([
        { ml: 2, price: 0, active: true },
        { ml: 5, price: 24000, active: true },
        { ml: 10, price: 0, active: false },
        { ml: 20, price: 0, active: true },
      ]),
    ).toEqual([2, 20]);
  });

  it("is empty when nothing is wrong", () => {
    expect(
      unpricedActiveSizes([
        { ml: 5, price: 24000, active: true },
        { ml: 10, price: 0, active: false },
      ]),
    ).toEqual([]);
  });
});
