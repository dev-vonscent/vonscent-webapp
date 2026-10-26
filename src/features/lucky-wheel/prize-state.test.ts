import { describe, expect, it } from "vitest";
import { daysLeft, grandPrizeState, isPrizeOpen } from "./prize-state";

const NOW = new Date("2026-10-27T12:00:00Z");
const row = {
  bundle_collection_id: null,
  claim_order_id: null,
  fulfilled_at: null,
  expires_at: "2026-12-01T00:00:00Z",
};

describe("grandPrizeState", () => {
  it("walks choose → ready → in_order → delivered", () => {
    expect(grandPrizeState(row, NOW)).toBe("choose");
    expect(grandPrizeState({ ...row, bundle_collection_id: "c" }, NOW)).toBe(
      "ready",
    );
    expect(
      grandPrizeState(
        { ...row, bundle_collection_id: "c", claim_order_id: "o" },
        NOW,
      ),
    ).toBe("in_order");
    expect(
      grandPrizeState(
        { ...row, claim_order_id: "o", fulfilled_at: "2026-10-30" },
        NOW,
      ),
    ).toBe("delivered");
  });

  it("expires only while it is still waiting on the customer", () => {
    const past = { ...row, expires_at: "2026-10-01T00:00:00Z" };
    expect(grandPrizeState(past, NOW)).toBe("expired");
    expect(grandPrizeState({ ...past, bundle_collection_id: "c" }, NOW)).toBe(
      "expired",
    );
    // Already in an order: the order decides, not the date.
    expect(grandPrizeState({ ...past, claim_order_id: "o" }, NOW)).toBe(
      "in_order",
    );
    // A staff mark wins over everything.
    expect(grandPrizeState({ ...past, fulfilled_at: "2026-10-02" }, NOW)).toBe(
      "delivered",
    );
  });

  it("counts open prizes and the days left", () => {
    expect(isPrizeOpen("choose")).toBe(true);
    expect(isPrizeOpen("ready")).toBe(true);
    expect(isPrizeOpen("in_order")).toBe(false);
    expect(daysLeft("2026-10-29T12:00:00Z", NOW)).toBe(2);
    expect(daysLeft("2026-10-01T00:00:00Z", NOW)).toBe(0);
    expect(daysLeft(null, NOW)).toBeNull();
  });
});
