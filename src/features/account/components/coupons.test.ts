import { describe, expect, it } from "vitest";
import { daysLeft, groupCoupons, usable, type CouponRecord } from "./coupons";
import { couponLabel } from "./coupon-ticket";

const NOW = Date.parse("2026-09-08T00:00:00Z");
const inDays = (n: number) => new Date(NOW + n * 86_400_000).toISOString();

function coupon(over: Partial<CouponRecord> = {}): CouponRecord {
  return {
    id: crypto.randomUUID(),
    code: "VW-AAAA",
    type: "fixed",
    value: 5000,
    min_subtotal: 100000,
    ends_at: inDays(30),
    max_uses: 1,
    used_count: 0,
    user_id: "u1",
    ...over,
  };
}

describe("usable", () => {
  it("drops a coupon that has already been redeemed", () => {
    // The bug this fixes: `is_active` stays true after redemption, so the
    // account page listed spent wheel codes under "Идэвхтэй купонууд".
    const out = usable(
      [
        coupon({ code: "SPENT", max_uses: 1, used_count: 1 }),
        coupon({ code: "FRESH", max_uses: 1, used_count: 0 }),
      ],
      NOW,
    );
    expect(out.map((c) => c.code)).toEqual(["FRESH"]);
  });

  it("drops a coupon whose end date has passed", () => {
    const out = usable(
      [
        coupon({ code: "OVER", ends_at: inDays(-1) }),
        coupon({ code: "LIVE", ends_at: inDays(1) }),
      ],
      NOW,
    );
    expect(out.map((c) => c.code)).toEqual(["LIVE"]);
  });

  it("keeps a coupon with no usage cap and no end date", () => {
    expect(
      usable([coupon({ max_uses: null, ends_at: null })], NOW),
    ).toHaveLength(1);
  });
});

describe("groupCoupons", () => {
  it("collapses identical offers into one row that keeps every code", () => {
    const groups = groupCoupons(
      [
        coupon({ code: "A", ends_at: inDays(20) }),
        coupon({ code: "B", ends_at: inDays(10) }),
        coupon({ code: "C", ends_at: inDays(30) }),
      ],
      NOW,
    );
    expect(groups).toHaveLength(1);
    // Soonest expiry leads — that is the one worth spending next.
    expect(groups[0].coupons.map((c) => c.code)).toEqual(["B", "A", "C"]);
  });

  it("keeps different offers apart", () => {
    const groups = groupCoupons(
      [
        coupon({ code: "PCT", type: "percent", value: 10, min_subtotal: 0 }),
        coupon({ code: "FIX", type: "fixed", value: 5000 }),
        // Same amount, different minimum — a different offer to the customer.
        coupon({ code: "FIX0", type: "fixed", value: 5000, min_subtotal: 0 }),
      ],
      NOW,
    );
    expect(groups).toHaveLength(3);
    // Percent first, then the larger amount.
    expect(groups[0].coupons[0].code).toBe("PCT");
  });

  it("orders amounts largest first", () => {
    const groups = groupCoupons(
      [
        coupon({ code: "SMALL", value: 5000 }),
        coupon({ code: "BIG", value: 10000 }),
      ],
      NOW,
    );
    expect(groups.map((g) => g.value)).toEqual([10000, 5000]);
  });

  it("marks a personal coupon and never merges it with a public one", () => {
    const groups = groupCoupons(
      [
        coupon({ code: "MINE", user_id: "u1" }),
        coupon({ code: "PUBLIC", user_id: null }),
      ],
      NOW,
    );
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.personal).sort()).toEqual([false, true]);
  });

  it("excludes spent coupons from the grouping too", () => {
    const groups = groupCoupons(
      [coupon({ used_count: 1, max_uses: 1 }), coupon({ code: "OK" })],
      NOW,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].coupons).toHaveLength(1);
  });
});

describe("daysLeft", () => {
  it("rounds up to whole days", () => {
    expect(daysLeft(inDays(2.2), NOW)).toBe(3);
  });

  it("is null with no end date or once it has passed", () => {
    expect(daysLeft(null, NOW)).toBeNull();
    expect(daysLeft(inDays(-1), NOW)).toBeNull();
  });
});

describe("couponLabel", () => {
  it("renders a percentage as-is", () => {
    expect(couponLabel("percent", 10)).toBe("10%");
    expect(couponLabel("percent", 5)).toBe("5%");
  });

  it("shortens round thousands, which is all the card has room for", () => {
    expect(couponLabel("fixed", 5000)).toBe("5k");
    expect(couponLabel("fixed", 10000)).toBe("10k");
  });

  it("spells out an amount that is not a round thousand", () => {
    expect(couponLabel("fixed", 7500)).toBe("7,500₮");
    expect(couponLabel("fixed", 500)).toBe("500₮");
  });
});
