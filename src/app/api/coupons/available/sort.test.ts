import { describe, expect, it } from "vitest";
import { sortOffers, type AvailableCoupon } from "./sort";

function coupon(over: Partial<AvailableCoupon> = {}): AvailableCoupon {
  return {
    id: over.code ?? "id",
    code: "VW-A",
    type: "percent",
    value: 10,
    discount: 5000,
    minSubtotal: 0,
    maxDiscount: null,
    endsAt: null,
    personal: true,
    eligible: true,
    shortfall: 0,
    ...over,
  };
}

describe("sortOffers", () => {
  it("keeps identical offers as separate rows", () => {
    const out = sortOffers([
      coupon({ code: "A", endsAt: "2026-10-10T00:00:00Z" }),
      coupon({ code: "B", endsAt: "2026-10-20T00:00:00Z" }),
      coupon({ code: "C", endsAt: "2026-10-30T00:00:00Z" }),
    ]);
    expect(out.map((c) => c.code)).toEqual(["A", "B", "C"]);
  });

  it("puts the soonest expiry first and never-expiring last", () => {
    const out = sortOffers([
      coupon({ code: "NEVER", endsAt: null }),
      coupon({ code: "LATE", endsAt: "2026-12-01T00:00:00Z" }),
      coupon({ code: "SOON", endsAt: "2026-10-01T00:00:00Z" }),
    ]);
    expect(out.map((c) => c.code)).toEqual(["SOON", "LATE", "NEVER"]);
  });

  it("breaks ties by the bigger discount", () => {
    const out = sortOffers([
      coupon({ code: "SMALL", discount: 3000 }),
      coupon({ code: "BIG", discount: 9000 }),
    ]);
    expect(out.map((c) => c.code)).toEqual(["BIG", "SMALL"]);
  });

  it("lists usable coupons before ones still below their minimum", () => {
    const out = sortOffers([
      coupon({
        code: "LOCKED",
        eligible: false,
        endsAt: "2026-10-01T00:00:00Z",
      }),
      coupon({ code: "OK", endsAt: "2026-12-01T00:00:00Z" }),
    ]);
    expect(out.map((c) => c.code)).toEqual(["OK", "LOCKED"]);
  });

  it("does not mutate its input", () => {
    const input = [
      coupon({ code: "B", discount: 1 }),
      coupon({ code: "A", discount: 2 }),
    ];
    sortOffers(input);
    expect(input.map((c) => c.code)).toEqual(["B", "A"]);
  });
});
