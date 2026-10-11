import { describe, expect, it } from "vitest";
import { couponUsageLabel } from "./coupon-manager";

describe("couponUsageLabel", () => {
  it("нийт ба нэг хүний хязгаартай", () => {
    expect(
      couponUsageLabel({ used_count: 0, max_uses: 1, max_uses_per_user: 1 }),
    ).toEqual({ used: "0 / 1 удаа", limit: "Нэг хүн 1 удаа" });
  });

  it("ямар ч хязгааргүй", () => {
    expect(
      couponUsageLabel({
        used_count: 0,
        max_uses: null,
        max_uses_per_user: null,
      }),
    ).toEqual({ used: "0 удаа", limit: "Хязгааргүй" });
  });

  it("зөвхөн нийт хязгаартай", () => {
    expect(
      couponUsageLabel({
        used_count: 3,
        max_uses: 100,
        max_uses_per_user: null,
      }),
    ).toEqual({ used: "3 / 100 удаа", limit: "Нэг хүнд хязгааргүй" });
  });

  it("зөвхөн нэг хүний хязгаартай", () => {
    expect(
      couponUsageLabel({ used_count: 7, max_uses: null, max_uses_per_user: 2 }),
    ).toEqual({ used: "7 удаа", limit: "Нэг хүн 2 удаа" });
  });
});
