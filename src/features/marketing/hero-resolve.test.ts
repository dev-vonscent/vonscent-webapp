import { beforeEach, describe, expect, it, vi } from "vitest";

const getLiveHero = vi.fn();
vi.mock("@/features/heroes/api", () => ({ getLiveHero: () => getLiveHero() }));
vi.mock("@/features/collections/api", () => ({
  getBaseCollections: vi.fn(async () => []),
}));

const { resolveHomeHero } = await import("./hero-resolve");
const { EVERGREEN_HERO, liveCampaigns } = await import("./home-content");

/** Нүүрний hero-гийн дараалал (plan §7.1, §13.2). */
describe("resolveHomeHero", () => {
  beforeEach(() => getLiveHero.mockReset());

  it("DB hero байвал түрүүлнэ", async () => {
    getLiveHero.mockResolvedValue({
      id: "h1",
      eyebrow: "BF",
      title: "Black Friday",
      description: "",
      mobileDescription: null,
      primaryLabel: "Үзэх",
      primaryTarget: { type: "event", slug: "black-friday" },
      secondaryLabel: null,
      secondaryTarget: null,
      desktopImage: { base: "https://s/hero/a/b", widths: [1600], height1600: 571 },
      mobileImage: { src: "https://s/m.webp", width: 1600, height: 1200 },
      imageAlt: "alt",
      dark: false,
    });
    const r = await resolveHomeHero();
    expect(r.campaign.title).toBe("Black Friday");
    expect(r.campaign.primary.href).toBe("/sale/black-friday");
    expect(r.image.mobile?.src).toBe("https://s/m.webp");
  });

  it("DB хоосон (туг хаалттай / demo / алдаа) → кодын hero", async () => {
    getLiveHero.mockResolvedValue(null);
    const now = new Date("2026-11-20T04:00:00Z");
    const r = await resolveHomeHero(now);
    const expected = liveCampaigns(now)[0] ?? EVERGREEN_HERO;
    expect(r.campaign.id).toBe(expected.id);
  });

  it("кодын кампанит ажил байхгүй үед evergreen", async () => {
    getLiveHero.mockResolvedValue(null);
    const r = await resolveHomeHero(new Date("2030-06-01T00:00:00Z"));
    expect(r.campaign.id).toBe("evergreen");
  });
});
