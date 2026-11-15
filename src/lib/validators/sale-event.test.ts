import { describe, expect, it } from "vitest";
import { parseEventSlug, saleEventInputSchema } from "./sale-event";

const base = {
  name: "Black Friday",
  slug: "black-friday",
  startsOn: "2026-11-23",
  endsOn: "2026-11-30",
  isActive: true,
  items: [
    {
      productId: "11111111-1111-4111-8111-111111111111",
      pcts: { "5": 20, "10": 30 },
    },
  ],
};

describe("saleEventInputSchema", () => {
  it("хүчинтэй утга", () => {
    const r = saleEventInputSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.showCountdown).toBe(true);
      expect(r.data.badgeLabel).toBe("");
    }
  });

  it("slug: латин жижиг үсэг, тоо, зураас; 2–60", () => {
    for (const slug of ["Black-Friday", "bf!", "b", "a".repeat(61), "цагаан-сар"]) {
      expect(saleEventInputSchema.safeParse({ ...base, slug }).success).toBe(
        false,
      );
    }
    expect(
      saleEventInputSchema.safeParse({ ...base, slug: "tsagaan-sar-2027" })
        .success,
    ).toBe(true);
  });

  it("тэмдэгтийн хязгаар (0181 check-тэй ижил)", () => {
    expect(
      saleEventInputSchema.safeParse({ ...base, name: "x".repeat(61) }).success,
    ).toBe(false);
    expect(
      saleEventInputSchema.safeParse({ ...base, badgeLabel: "x".repeat(25) })
        .success,
    ).toBe(false);
    expect(
      saleEventInputSchema.safeParse({ ...base, headline: "x".repeat(81) })
        .success,
    ).toBe(false);
    expect(
      saleEventInputSchema.safeParse({ ...base, description: "x".repeat(201) })
        .success,
    ).toBe(false);
  });

  it("хувь 1–90 бүхэл, хэмжээ ML_SIZES", () => {
    const item = (pcts: Record<string, number>) => ({
      ...base,
      items: [{ ...base.items[0], pcts }],
    });
    expect(saleEventInputSchema.safeParse(item({ "5": 0 })).success).toBe(false);
    expect(saleEventInputSchema.safeParse(item({ "5": 91 })).success).toBe(false);
    expect(saleEventInputSchema.safeParse(item({ "5": 12.5 })).success).toBe(
      false,
    );
    expect(saleEventInputSchema.safeParse(item({ "7": 10 })).success).toBe(false);
    // Хувьгүй гишүүн нийтлэхэд хориотой (клиент 2026-11-15) — доорх тест.
    expect(saleEventInputSchema.safeParse(item({})).success).toBe(false);
  });

  it("дуусах өдөр эхлэхээс өмнө байж болохгүй (нэг өдөр болно)", () => {
    expect(
      saleEventInputSchema.safeParse({ ...base, endsOn: "2026-11-22" }).success,
    ).toBe(false);
    expect(
      saleEventInputSchema.safeParse({ ...base, endsOn: "2026-11-23" }).success,
    ).toBe(true);
  });

  it("давхардсан бараа, бараагүй нийтлэл хориотой; бараагүй ноорог болно", () => {
    expect(
      saleEventInputSchema.safeParse({
        ...base,
        items: [base.items[0], base.items[0]],
      }).success,
    ).toBe(false);
    expect(
      saleEventInputSchema.safeParse({ ...base, items: [] }).success,
    ).toBe(false);
    expect(
      saleEventInputSchema.safeParse({ ...base, items: [], isActive: false })
        .success,
    ).toBe(true);
  });
});

describe("parseEventSlug", () => {
  it("эхний утга, slug хэлбэртэй л", () => {
    expect(parseEventSlug("black-friday")).toBe("black-friday");
    expect(parseEventSlug(["naadam", "x"])).toBe("naadam");
    expect(parseEventSlug("../etc")).toBeUndefined();
    expect(parseEventSlug(undefined)).toBeUndefined();
  });
});

describe("хувьгүй бараа", () => {
  const items = [
    ...base.items,
    { productId: "22222222-2222-4222-8222-222222222222", pcts: {} },
  ];

  it("нийтлэхэд бараа бүр дор хаяж нэг хувьтай байна", () => {
    const r = saleEventInputSchema.safeParse({ ...base, items });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toMatch(/дор хаяж нэг хэмжээнд/u);
    }
  });

  it("ноорогт (autosave) зөвшөөрнө", () => {
    expect(
      saleEventInputSchema.safeParse({ ...base, isActive: false, items }).success,
    ).toBe(true);
  });
});
