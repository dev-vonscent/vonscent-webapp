import { describe, expect, it } from "vitest";
import {
  deliveryBlackoutSchema,
  firstOpenDay,
  normalizeBlackout,
} from "./delivery-blackout";

describe("normalizeBlackout", () => {
  it("dedupes, sorts and drops junk", () => {
    expect(
      normalizeBlackout({
        days: ["2026-11-20", "2026-11-18", "2026-11-20", "x", 5, "2026-02-30"],
      }),
    ).toEqual(["2026-11-18", "2026-11-20"]);
  });

  it("treats a missing or malformed row as nothing blocked", () => {
    expect(normalizeBlackout(null)).toEqual([]);
    expect(normalizeBlackout({})).toEqual([]);
    expect(normalizeBlackout({ days: "2026-11-18" })).toEqual([]);
  });
});

describe("deliveryBlackoutSchema", () => {
  it("rejects impossible dates", () => {
    expect(
      deliveryBlackoutSchema.safeParse({ days: ["2026-02-30"] }).success,
    ).toBe(false);
    expect(
      deliveryBlackoutSchema.safeParse({ days: ["2026-11-18"] }).success,
    ).toBe(true);
  });
});

describe("firstOpenDay", () => {
  const days = ["2026-11-16", "2026-11-17", "2026-11-18"];
  it("skips blocked days", () => {
    expect(firstOpenDay(days, new Set(["2026-11-16"]))).toBe("2026-11-17");
  });
  it("returns null when every day is blocked", () => {
    expect(firstOpenDay(days, new Set(days))).toBeNull();
  });
});
