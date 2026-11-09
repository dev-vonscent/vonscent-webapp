import { describe, expect, it } from "vitest";
import {
  BLANK_COLOR,
  COMMON_COLOR,
  GRAND_COLOR,
  RARE_COLOR,
  colorOf,
  prizeColors,
} from "./palette";
import type { WheelPrize } from "./types";

function prize(over: Partial<WheelPrize>): WheelPrize {
  return {
    slot: 1,
    label: "",
    shortLabel: "",
    kind: "points",
    tier: "common",
    value: 0,
    minSubtotal: 0,
    maxDiscount: null,
    ...over,
  };
}

const wheel = [
  prize({ kind: "bundle", tier: "grand", value: 1 }),
  prize({ kind: "none" }),
  prize({ kind: "points", value: 1000 }),
  prize({ kind: "points", value: 10000, tier: "rare" }),
  prize({ kind: "coupon_fixed", value: 5000 }),
  prize({ kind: "points", value: 1000 }),
];

describe("prizeColors", () => {
  const colors = prizeColors(wheel);

  it("keeps gold for the grand prize alone", () => {
    expect(colorOf(colors, wheel[0])).toBe(GRAND_COLOR);
    expect(GRAND_COLOR.fill).toBe("var(--wheel-gold)");
  });

  it("steps the rest in the theme's own greys by tier", () => {
    expect(colorOf(colors, wheel[1])).toBe(BLANK_COLOR);
    expect(colorOf(colors, wheel[2])).toBe(COMMON_COLOR);
    expect(colorOf(colors, wheel[3])).toBe(RARE_COLOR);
    expect(colorOf(colors, wheel[4])).toBe(COMMON_COLOR);
    for (const c of [BLANK_COLOR, COMMON_COLOR, RARE_COLOR]) {
      expect(c.fill).toMatch(/var\(--foreground\).*var\(--background\)/);
    }
  });

  it("matches repeated wedges to one colour", () => {
    expect(colorOf(colors, wheel[5])).toBe(colorOf(colors, wheel[2]));
  });
});
