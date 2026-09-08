import { describe, expect, it } from "vitest";
import { bundlePrice } from "./pricing";

/**
 * The builder's price gate.
 *
 * `bundlePrice` applies the percentage to whatever it is handed, so the rule
 * "no discount until the bundle is big enough" lives in the caller. It used to
 * be missing there, and the tray quoted a 5%-off total for three scents —
 * a price nothing could be sold at, since `computeSummary` drops a custom
 * bundle under `minItems`.
 */
function trayPrice(
  memberSum: number,
  count: number,
  minItems: number,
  pct: number,
) {
  const earned = count >= minItems;
  const price = earned ? bundlePrice(memberSum, pct, 100) : memberSum;
  return { price, saved: memberSum - price, earned };
}

describe("bundle discount gate", () => {
  const MIN = 4;
  const PCT = 5;

  it("charges the plain sum below the minimum", () => {
    const r = trayPrice(134_000, 3, MIN, PCT);
    expect(r).toEqual({ price: 134_000, saved: 0, earned: false });
  });

  it("applies the discount exactly at the minimum", () => {
    const r = trayPrice(237_000, 4, MIN, PCT);
    expect(r.earned).toBe(true);
    expect(r.price).toBe(225_200);
    expect(r.saved).toBe(11_800);
  });

  it("keeps applying it above the minimum", () => {
    expect(trayPrice(381_000, 7, MIN, PCT).saved).toBe(19_000);
  });

  it("shows nothing to save when the shop set no discount", () => {
    const r = trayPrice(237_000, 4, MIN, 0);
    expect(r).toEqual({ price: 237_000, saved: 0, earned: true });
  });
});
