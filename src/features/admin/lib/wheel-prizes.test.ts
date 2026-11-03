import { describe, expect, it } from "vitest";
import type { SpinWheelPrizeRow } from "@/db/types";
import {
  blankDraft,
  prizeDetail,
  problemOf,
  toDraft,
  toPayload,
} from "./wheel-prizes";

const row: SpinWheelPrizeRow = {
  id: "p1",
  slot: 3,
  label: "5,000₮ хөнгөлөлт",
  short_label: "5,000₮",
  kind: "coupon_fixed",
  tier: "common",
  value: 5000,
  min_subtotal: 100000,
  max_discount: null,
  weight: 3.2,
  monthly_cap: null,
  fallback_slot: null,
  is_active: true,
  created_at: "2026-10-31",
};

describe("wheel-prizes", () => {
  it("мөрийг засварын хэлбэрт, буцаагаад хадгалах хэлбэрт", () => {
    expect(toPayload(toDraft(row))).toEqual({
      id: "p1",
      kind: "coupon_fixed",
      tier: "common",
      label: "5,000₮ хөнгөлөлт",
      shortLabel: "5,000₮",
      value: 5000,
      minSubtotal: 100000,
      maxDiscount: null,
      weight: 3.2,
      monthlyCap: null,
      productId: null,
      ml: null,
    });
  });

  it("төрөлд хамаарахгүй талбарыг илгээхгүй", () => {
    const none = toPayload({ ...blankDraft("none"), minSubtotal: "5000" });
    expect(none).toMatchObject({ value: 0, minSubtotal: 0, shortLabel: "" });
    const product = toPayload({
      ...blankDraft("product"),
      label: "Eau Fraiche 5мл",
      productId: "x",
      ml: 5,
      value: "999",
    });
    expect(product).toMatchObject({ value: 1, productId: "x", ml: 5 });
  });

  it("дутуу шагналыг хадгалуулахгүй", () => {
    expect(problemOf(blankDraft("product"))).toBe("Нэр бичнэ үү");
    expect(problemOf({ ...blankDraft("product"), label: "X" })).toBe(
      "Бараа ба хэмжээг сонгоно уу",
    );
    expect(problemOf({ ...blankDraft("coupon_percent"), value: "120" })).toBe(
      "Хувь 1–100 байна",
    );
    expect(problemOf({ ...blankDraft("points"), weight: "101" })).toBe(
      "Магадлал 0–100 хооронд",
    );
    expect(problemOf(blankDraft("points"))).toBeNull();
  });

  it("купоны нөхцөлийг нэг мөрөнд", () => {
    expect(prizeDetail(row)).toBe("Купон (₮) · ≥100,000₮");
  });
});
