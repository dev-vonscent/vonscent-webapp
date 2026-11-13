import { describe, expect, it } from "vitest";
import { heroInputSchema } from "./hero";

const images = {
  desktopImage: { base: "https://s/hero/a/b", widths: [1600, 2400, 3200], height1600: 571 },
  mobileImage: { src: "https://s/hero/a/m.webp", width: 1600, height: 1200 },
};
const base = {
  name: "Black Friday 2026",
  startsOn: "2026-11-23",
  endsOn: "2026-11-30",
  title: "Жилийн хамгийн том хямдрал",
  primaryLabel: "Хямдралыг үзэх",
  primaryTarget: { type: "event", slug: "black-friday" },
};

describe("heroInputSchema", () => {
  it("ноорог зураггүй болно; нийтлэхэд зураг заавал", () => {
    expect(heroInputSchema.safeParse(base).success).toBe(true);
    expect(heroInputSchema.safeParse({ ...base, isActive: true }).success).toBe(false);
    expect(
      heroInputSchema.safeParse({ ...base, ...images, isActive: true }).success,
    ).toBe(true);
  });

  it("тэмдэгтийн хязгаар (0182 check-тэй ижил)", () => {
    expect(heroInputSchema.safeParse({ ...base, title: "x".repeat(49) }).success).toBe(false);
    expect(heroInputSchema.safeParse({ ...base, eyebrow: "x".repeat(41) }).success).toBe(false);
    expect(heroInputSchema.safeParse({ ...base, description: "x".repeat(141) }).success).toBe(false);
    expect(heroInputSchema.safeParse({ ...base, mobileDescription: "x".repeat(71) }).success).toBe(false);
    expect(heroInputSchema.safeParse({ ...base, primaryLabel: "x".repeat(23) }).success).toBe(false);
  });

  it("path зөвхөн дотоод", () => {
    for (const href of ["https://evil.example", "//evil.example", "evil"]) {
      expect(
        heroInputSchema.safeParse({ ...base, primaryTarget: { type: "path", href } }).success,
      ).toBe(false);
    }
    expect(
      heroInputSchema.safeParse({ ...base, primaryTarget: { type: "path", href: "/gift-cards" } }).success,
    ).toBe(true);
  });

  it("каталогийн шүүлт: эхний ?-г авна, хоосон зай хориотой", () => {
    const r = heroInputSchema.safeParse({
      ...base,
      primaryTarget: { type: "catalog", query: "?tags=new" },
    });
    expect(r.success && r.data.primaryTarget).toEqual({ type: "catalog", query: "tags=new" });
    expect(
      heroInputSchema.safeParse({ ...base, primaryTarget: { type: "catalog", query: "a b" } }).success,
    ).toBe(false);
  });

  it("хугацаа эсвэл арга хэмжээ заавал", () => {
    expect(heroInputSchema.safeParse({ ...base, startsOn: null, endsOn: null }).success).toBe(false);
    expect(
      heroInputSchema.safeParse({
        ...base,
        startsOn: null,
        endsOn: null,
        saleEventId: "11111111-1111-4111-8111-111111111111",
      }).success,
    ).toBe(true);
    expect(heroInputSchema.safeParse({ ...base, endsOn: "2026-11-22" }).success).toBe(false);
  });

  it("хоёр дахь товч: бичиг ба холбоос хамт", () => {
    expect(heroInputSchema.safeParse({ ...base, secondaryLabel: "Бүгд" }).success).toBe(false);
    expect(
      heroInputSchema.safeParse({
        ...base,
        secondaryLabel: "Бүгд",
        secondaryTarget: { type: "path", href: "/catalog" },
      }).success,
    ).toBe(true);
  });
});
