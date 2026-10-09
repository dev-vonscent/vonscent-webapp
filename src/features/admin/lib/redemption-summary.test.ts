import { describe, expect, it } from "vitest";
import { summarizeRedemptions } from "./redemption-summary";

describe("summarizeRedemptions", () => {
  it("тоо, хүн, хөнгөлөлт — цуцлагдсаныг оруулахгүй", () => {
    expect(
      summarizeRedemptions([
        { userId: "a", cancelledAt: null, discount: 8000 },
        { userId: "a", cancelledAt: null, discount: 5000 },
        { userId: "b", cancelledAt: null, discount: 3000 },
        { userId: "c", cancelledAt: "2026-10-01T00:00:00Z", discount: 9000 },
      ]),
    ).toEqual({ uses: 3, people: 2, discount: 16_000 });
  });

  it("хоосон", () => {
    expect(summarizeRedemptions([])).toEqual({
      uses: 0,
      people: 0,
      discount: 0,
    });
  });

  it("захиалга устсан (discount null) мөр тоонд орж, дүнд 0", () => {
    expect(
      summarizeRedemptions([
        { userId: "a", cancelledAt: null, discount: null },
      ]),
    ).toEqual({ uses: 1, people: 1, discount: 0 });
  });
});
