import { describe, expect, it } from "vitest";
import { dedupe, type AvailableCoupon } from "./route";

function coupon(over: Partial<AvailableCoupon> = {}): AvailableCoupon {
  return {
    code: "VW-A",
    type: "fixed",
    value: 5000,
    discount: 5000,
    minSubtotal: 100000,
    endsAt: null,
    personal: true,
    ...over,
  };
}

describe("dedupe", () => {
  it("collapses identical offers to one", () => {
    // The wheel now lets coupons accumulate, so six identical 5,000₮ codes in
    // one wallet is ordinary (docs/lucky-wheel.md §0 №1).
    const out = dedupe([
      coupon({ code: "VW-A" }),
      coupon({ code: "VW-B" }),
      coupon({ code: "VW-C" }),
    ]);
    expect(out).toHaveLength(1);
  });

  it("keeps the one expiring soonest", () => {
    const out = dedupe([
      coupon({ code: "LATE", endsAt: "2026-12-01T00:00:00Z" }),
      coupon({ code: "SOON", endsAt: "2026-09-20T00:00:00Z" }),
      coupon({ code: "NEVER", endsAt: null }),
    ]);
    expect(out.map((c) => c.code)).toEqual(["SOON"]);
  });

  it("treats different offers as different", () => {
    const out = dedupe([
      coupon({ code: "FIVE-K", type: "fixed", value: 5000, discount: 5000 }),
      coupon({ code: "TEN-PC", type: "percent", value: 10, discount: 15000 }),
      // Same value, different minimum — a different offer to the customer.
      coupon({ code: "FIVE-K-NOMIN", minSubtotal: 0 }),
    ]);
    expect(out.map((c) => c.code).sort()).toEqual([
      "FIVE-K",
      "FIVE-K-NOMIN",
      "TEN-PC",
    ]);
  });

  it("preserves the order it was given, so best-first survives", () => {
    const out = dedupe([
      coupon({ code: "BIG", discount: 15000 }),
      coupon({ code: "SMALL", discount: 5000 }),
      coupon({ code: "SMALL-DUP", discount: 5000 }),
    ]);
    expect(out.map((c) => c.code)).toEqual(["BIG", "SMALL"]);
  });
});
