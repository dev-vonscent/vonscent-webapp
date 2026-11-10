import { describe, expect, it } from "vitest";
import {
  giftCardPurchaseSchema,
  giftCardRedeemSchema,
  giftCardSendAt,
} from "./gift-card";

const base = {
  amount: 100000,
  designId: "birthday",
  recipientName: "Сараа",
  message: "Төрсөн өдрийн мэнд!",
  fromName: "Болд",
  delivery: "email" as const,
  recipientEmail: "saraa@example.com",
  sendDay: "",
};

describe("giftCardPurchaseSchema", () => {
  it("зөв утгыг зөвшөөрнө", () => {
    expect(giftCardPurchaseSchema.safeParse(base).success).toBe(true);
  });

  it("жагсаалтад байхгүй дүнг татгалзана", () => {
    const r = giftCardPurchaseSchema.safeParse({ ...base, amount: 150000 });
    expect(r.success).toBe(false);
  });

  it("имэйлээр илгээхэд имэйл заавал", () => {
    const r = giftCardPurchaseSchema.safeParse({ ...base, recipientEmail: "" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.flatten().fieldErrors.recipientEmail?.[0]).toMatch(
        /имэйл/u,
      );
    }
  });

  it("«Өөрөө өгнө» үед имэйлгүй болно", () => {
    const r = giftCardPurchaseSchema.safeParse({
      ...base,
      delivery: "self",
      recipientEmail: "",
    });
    expect(r.success).toBe(true);
  });

  it("мэндчилгээ 120 тэмдэгтээс урт бол татгалзана", () => {
    const r = giftCardPurchaseSchema.safeParse({
      ...base,
      message: "а".repeat(121),
    });
    expect(r.success).toBe(false);
  });
});

describe("товлосон илгээлт", () => {
  it("өдөргүй бол татгалзана", () => {
    const r = giftCardPurchaseSchema.safeParse({ ...base, delivery: "scheduled" });
    expect(r.success).toBe(false);
  });

  it("өнгөрсөн өдрийг татгалзана", () => {
    const r = giftCardPurchaseSchema.safeParse({
      ...base,
      delivery: "scheduled",
      sendDay: "2020-01-01",
    });
    expect(r.success).toBe(false);
  });

  it("ирэх өдөр + имэйлтэй бол зөвшөөрнө, 09:00 УБ", () => {
    const day = new Date(Date.now() + 5 * 86400e3).toISOString().slice(0, 10);
    const r = giftCardPurchaseSchema.safeParse({
      ...base,
      delivery: "scheduled",
      sendDay: day,
    });
    expect(r.success).toBe(true);
    expect(giftCardSendAt("2026-12-01")).toBe("2026-12-01T09:00:00+08:00");
  });
});

describe("giftCardRedeemSchema", () => {
  it("код эсвэл token заавал", () => {
    expect(giftCardRedeemSchema.safeParse({}).success).toBe(false);
    expect(giftCardRedeemSchema.safeParse({ code: "von 7k4p q9xm" }).success).toBe(true);
    expect(
      giftCardRedeemSchema.safeParse({ token: "a".repeat(32) }).success,
    ).toBe(true);
    expect(giftCardRedeemSchema.safeParse({ token: "xyz" }).success).toBe(false);
  });
});
