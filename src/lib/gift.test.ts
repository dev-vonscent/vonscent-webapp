import { describe, expect, it } from "vitest";
import { giftAllowanceFor } from "./gift";

// requirement_final.md «Тодруулга» жишээнүүд шууд кейс болсон.
describe("giftAllowanceFor", () => {
  it("190k loose items, no bundle → 0", () => {
    expect(giftAllowanceFor(190_000, 0)).toBe(0);
  });

  it("200k loose items → 1; 400k → 2", () => {
    expect(giftAllowanceFor(200_000, 0)).toBe(1);
    expect(giftAllowanceFor(400_000, 0)).toBe(2);
  });

  it("one bundle under 200k still grants 1", () => {
    expect(giftAllowanceFor(150_000, 1)).toBe(1);
  });

  it("one bundle over 400k grants 2 (value wins)", () => {
    expect(giftAllowanceFor(420_000, 1)).toBe(2);
  });

  it("two bundles below 400k grant 2 (count wins)", () => {
    expect(giftAllowanceFor(380_000, 2)).toBe(2);
  });

  it("two bundles at 600k+ grant 3", () => {
    expect(giftAllowanceFor(610_000, 2)).toBe(3);
  });

  it("197k + delivery would pass 200k, but delivery is excluded upstream", () => {
    // Caller passes goods-only value; this documents that 197k stays 0.
    expect(giftAllowanceFor(197_000, 0)).toBe(0);
  });

  it("never negative", () => {
    expect(giftAllowanceFor(-5000, 0)).toBe(0);
    expect(giftAllowanceFor(100_000, -2)).toBe(0);
  });
});
