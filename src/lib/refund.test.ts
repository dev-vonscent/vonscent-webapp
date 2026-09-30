import { describe, expect, it } from "vitest";
import { maskAccount, refundBreakdown } from "./refund";

describe("refundBreakdown", () => {
  it("takes 1% of the whole total, in whole ₮", () => {
    expect(refundBreakdown(100_000)).toEqual({ fee: 1_000, amount: 99_000 });
    // 1% of 12,345 = 123.45 → 123; the parts still add up.
    expect(refundBreakdown(12_345)).toEqual({ fee: 123, amount: 12_222 });
  });

  it("never goes negative", () => {
    expect(refundBreakdown(0)).toEqual({ fee: 0, amount: 0 });
    expect(refundBreakdown(-5)).toEqual({ fee: 0, amount: 0 });
  });
});

describe("maskAccount", () => {
  it("keeps only the last four digits", () => {
    expect(maskAccount("5000 1234 5678")).toBe("•••• 5678");
    expect(maskAccount("MN120005005001234567")).toBe("•••• 4567");
  });
});
