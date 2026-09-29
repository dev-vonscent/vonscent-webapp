import { describe, expect, it } from "vitest";
import {
  couponStatus,
  couponTerms,
  daysLeft,
  describeRedemption,
  sortForTab,
  toWalletCoupon,
  type CouponRecord,
  type WalletCoupon,
  type WalletRedemption,
} from "./coupons";
import { couponLabel } from "./coupon-ticket";

const NOW = Date.parse("2026-09-08T00:00:00Z");
const inDays = (n: number) => new Date(NOW + n * 86_400_000).toISOString();

function record(over: Partial<CouponRecord> = {}): CouponRecord {
  return {
    id: over.code ?? crypto.randomUUID(),
    code: "VW-AAAA",
    type: "percent",
    value: 10,
    min_subtotal: 0,
    max_discount: null,
    ends_at: inDays(30),
    max_uses: 1,
    used_count: 0,
    is_active: true,
    source: "manual",
    ...over,
  };
}

function wallet(
  over: Partial<CouponRecord> = {},
  redemptions: WalletRedemption[] = [],
): WalletCoupon {
  return toWalletCoupon(record(over), redemptions, NOW);
}

describe("couponStatus", () => {
  it("is active while unused, switched on and not yet ended", () => {
    expect(couponStatus(record(), NOW)).toBe("active");
    expect(couponStatus(record({ ends_at: null, max_uses: null }), NOW)).toBe(
      "active",
    );
  });

  it("is used once the cap is reached — even though is_active stays true", () => {
    expect(couponStatus(record({ used_count: 1, max_uses: 1 }), NOW)).toBe(
      "used",
    );
  });

  it("is expired past its end date or when switched off", () => {
    expect(couponStatus(record({ ends_at: inDays(-1) }), NOW)).toBe("expired");
    expect(couponStatus(record({ is_active: false }), NOW)).toBe("expired");
  });

  it("prefers used over expired — who used it is the news", () => {
    expect(
      couponStatus(
        record({ used_count: 1, max_uses: 1, ends_at: inDays(-5) }),
        NOW,
      ),
    ).toBe("used");
  });
});

describe("sortForTab", () => {
  it("never merges identical coupons", () => {
    // Three 10% codes, three expiry dates — three rows (0104).
    const rows = sortForTab(
      [
        wallet({ code: "A", ends_at: inDays(20) }),
        wallet({ code: "B", ends_at: inDays(10) }),
        wallet({ code: "C", ends_at: inDays(30) }),
      ],
      "active",
    );
    expect(rows.map((c) => c.code)).toEqual(["B", "A", "C"]);
  });

  it("puts a never-ending coupon last among the active ones", () => {
    const rows = sortForTab(
      [
        wallet({ code: "NEVER", ends_at: null }),
        wallet({ code: "SOON", ends_at: inDays(1) }),
      ],
      "active",
    );
    expect(rows.map((c) => c.code)).toEqual(["SOON", "NEVER"]);
  });

  it("keeps each tab to its own status", () => {
    const all = [
      wallet({ code: "LIVE" }),
      wallet({ code: "SPENT", used_count: 1 }),
      wallet({ code: "OVER", ends_at: inDays(-1) }),
    ];
    expect(sortForTab(all, "active").map((c) => c.code)).toEqual(["LIVE"]);
    expect(sortForTab(all, "used").map((c) => c.code)).toEqual(["SPENT"]);
    expect(sortForTab(all, "expired").map((c) => c.code)).toEqual(["OVER"]);
  });

  it("shows the most recently used first", () => {
    const rows = sortForTab(
      [
        wallet({ code: "OLD", used_count: 1 }, [
          { by: "self", at: inDays(-10) },
        ]),
        wallet({ code: "NEW", used_count: 1 }, [
          { by: "self", at: inDays(-1) },
        ]),
      ],
      "used",
    );
    expect(rows.map((c) => c.code)).toEqual(["NEW", "OLD"]);
  });
});

describe("describeRedemption", () => {
  it("names the owner as «Та өөрөө»", () => {
    expect(describeRedemption({ by: "self", at: inDays(0) })).toBe("Та өөрөө");
  });

  it("shows a friend only masked", () => {
    expect(
      describeRedemption({
        by: { name: "Б***", phone: "••2233" },
        at: inDays(0),
      }),
    ).toBe("Б*** (••2233)");
    expect(
      describeRedemption({ by: { name: null, phone: null }, at: inDays(0) }),
    ).toBe("Өөр хэрэглэгч");
  });
});

describe("couponTerms", () => {
  it("lists the minimum and a percent coupon's cap", () => {
    expect(
      couponTerms({ type: "percent", minSubtotal: 100000, maxDiscount: 20000 }),
    ).toBe("100,000₮-өөс дээш захиалгад · дээд тал нь 20,000₮");
  });

  it("is null when there are no conditions", () => {
    expect(
      couponTerms({ type: "fixed", minSubtotal: 0, maxDiscount: 5000 }),
    ).toBeNull();
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
