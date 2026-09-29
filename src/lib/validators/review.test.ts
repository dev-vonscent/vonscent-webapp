import { describe, expect, it } from "vitest";
import { reviewInputSchema, reviewPageSchema } from "./review";

const P = "6f1c1e8e-1d0b-4a8e-9f55-0c1f3b7a2d11";
const C = "0589d723-5b37-4e0c-9ca1-3b197178d142";

describe("review validators — ус эсвэл багц (0107)", () => {
  it("accepts a product review and a collection review", () => {
    expect(
      reviewInputSchema.safeParse({ productId: P, rating: 5 }).success,
    ).toBe(true);
    expect(
      reviewInputSchema.safeParse({ collectionId: C, rating: 4 }).success,
    ).toBe(true);
  });

  it("needs exactly one target", () => {
    expect(reviewInputSchema.safeParse({ rating: 5 }).success).toBe(false);
    expect(
      reviewInputSchema.safeParse({ productId: P, collectionId: C, rating: 5 })
        .success,
    ).toBe(false);
  });

  it("pages either target", () => {
    expect(
      reviewPageSchema.safeParse({ collectionId: C, offset: "5" }).success,
    ).toBe(true);
    expect(reviewPageSchema.safeParse({ offset: 0 }).success).toBe(false);
  });
});
