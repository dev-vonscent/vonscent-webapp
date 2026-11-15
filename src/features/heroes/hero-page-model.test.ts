import { describe, expect, it } from "vitest";
import { heroInputSchema } from "@/lib/validators/hero";
import {
  heroPagePayload,
  seasonPageDraft,
  specialPageDraft,
  toMd,
} from "./hero-page-model";

const IMG = { base: "https://x/hero/a/b", widths: [1600], height1600: 571 };
const MOB = { src: "https://x/hero/a/m.webp", width: 1600, height: 1200 };

describe("heroPagePayload — улирал", () => {
  it("шинэ: бэлэн текст, зураггүй → идэвхгүй; схемд хүчинтэй", () => {
    const d = seasonPageDraft("spring", null, "03-01");
    const p = heroPagePayload(d);
    expect(p).toMatchObject({
      name: "Хавар — улирлын баннер",
      season: "spring",
      seasonStartMd: "03-01",
      isActive: false,
      startsOn: null,
      title: "Хаврын тансаг үнэртнүүд",
    });
    expect(heroInputSchema.safeParse(p).success).toBe(true);
  });
  it("хоёр зурагтай → идэвхтэй", () => {
    const d = seasonPageDraft("spring", null, "03-01");
    d.canvas = { ...d.canvas, desktopImage: IMG, mobileImage: MOB };
    expect(heroPagePayload(d).isActive).toBe(true);
  });
});

describe("heroPagePayload — тусгай өдөр", () => {
  it("ноорог / нийтлэх, огноотой", () => {
    const d = specialPageDraft(null, () => "", () => "");
    d.name = "Halloween";
    d.startsOn = "2026-10-26";
    d.endsOn = "2026-10-31";
    d.canvas = { ...d.canvas, title: "Халлоуин" };
    const draft = heroPagePayload(d);
    expect(draft).toMatchObject({ isActive: false, season: null, startsOn: "2026-10-26" });
    expect(heroInputSchema.safeParse(draft).success).toBe(true);
    expect(heroPagePayload(d, { publish: true }).isActive).toBe(true);
  });
});

describe("toMd", () => {
  it("2-р сарын 29+ → 28", () => {
    expect(toMd(2, 30)).toBe("02-28");
    expect(toMd(12, 1)).toBe("12-01");
  });
});
