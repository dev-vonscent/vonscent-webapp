import { describe, it, expect } from "vitest";
import {
  checkoutSchema,
  checkoutOrderSchema,
  KHOROO_REQUIRED_MESSAGE,
} from "@/lib/validators/order";

/**
 * Хорооны дүрэм зөвхөн `checkoutOrderSchema` дээр — `checkoutSchema` нь цэвэр
 * объект хэвээр үлдэх ёстой, эс тэгвээс checkout хуудасны
 * `checkoutSchema.omit({ items, collections })` эвдэрнэ.
 */
const base = {
  contactName: "Бат",
  contactPhone: "99112233",
  shipCity: "Улаанбаатар",
  shipDistrict: "Баянгол",
  shipDetail: "45-р байр 12 тоот",
  shipZone: "A",
  paymentMethod: "qpay" as const,
};

describe("checkoutOrderSchema — khoroo", () => {
  it("rejects a Ulaanbaatar address with no khoroo", () => {
    const r = checkoutOrderSchema.safeParse(base);
    expect(r.success).toBe(false);
    if (r.success) return;
    const issue = r.error.issues.find((i) => i.path[0] === "shipKhoroo");
    expect(issue?.message).toBe(KHOROO_REQUIRED_MESSAGE);
  });

  it("accepts the same address once the khoroo is there", () => {
    expect(
      checkoutOrderSchema.safeParse({ ...base, shipKhoroo: 12 }).success,
    ).toBe(true);
  });

  it("does not ask the countryside for a khoroo", () => {
    const r = checkoutOrderSchema.safeParse({
      ...base,
      shipCity: "Дархан-Уул",
      shipDistrict: "Дархан",
    });
    expect(r.success).toBe(true);
  });

  it("stays quiet on an address the cascade cannot resolve", () => {
    // Хот/дүүрэг нь буруу бол тэдгээрийн өөрсдийн алдаа ярина — хороо биш.
    const r = checkoutOrderSchema.safeParse({
      ...base,
      shipDistrict: "Тодорхойгүй",
    });
    expect(r.success).toBe(true);
  });

  it("leaves checkoutSchema omittable for the client form", () => {
    // Форм нь хороог агуулдаггүй (RHF-ээс гадуур) тул энэ схем дээр дүрэм
    // байвал УБ-ын захиалга бүр худал уначихна.
    const formSchema = checkoutSchema.omit({ items: true, collections: true });
    expect(formSchema.safeParse(base).success).toBe(true);
  });
});
