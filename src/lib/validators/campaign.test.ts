import { describe, expect, it } from "vitest";
import { campaignFieldErrors, campaignInputSchema } from "./campaign";

const base = {
  name: "Бүртгэлийн бэлэг",
  startsOn: "2026-10-15",
  endsOn: "2026-10-31",
  couponValue: 5000,
  minSubtotal: 30000,
  couponValidDays: 30,
};

describe("campaignInputSchema", () => {
  it("анхдагч утгууд: signup_coupon, унтраалттай", () => {
    const parsed = campaignInputSchema.parse(base);
    expect(parsed.type).toBe("signup_coupon");
    expect(parsed.isActive).toBe(false);
    expect(parsed.description).toBe("");
  });

  it("нэг өдрийн кампанит ажлыг зөвшөөрнө", () => {
    expect(
      campaignInputSchema.safeParse({ ...base, endsOn: base.startsOn }).success,
    ).toBe(true);
  });

  it("дуусах өдөр эхлэхээс өмнө байвал endsOn талбарт алдаа", () => {
    const r = campaignInputSchema.safeParse({ ...base, endsOn: "2026-10-01" });
    expect(r.success).toBe(false);
    if (!r.success) expect(campaignFieldErrors(r.error).endsOn).toBeTruthy();
  });

  it("мөнгөн дүн бүхэл ₮ байна", () => {
    expect(
      campaignInputSchema.safeParse({ ...base, couponValue: 5000.5 }).success,
    ).toBe(false);
    expect(
      campaignInputSchema.safeParse({ ...base, minSubtotal: -1 }).success,
    ).toBe(false);
  });

  it("хүчинтэй хоног 1–365", () => {
    for (const bad of [{ couponValidDays: 0 }, { couponValidDays: 366 }]) {
      expect(campaignInputSchema.safeParse({ ...base, ...bad }).success).toBe(
        false,
      );
    }
  });

  it("бүртгэлгүй төрлийг хүлээж авахгүй", () => {
    expect(
      campaignInputSchema.safeParse({ ...base, type: "referral" }).success,
    ).toBe(false);
  });
});
