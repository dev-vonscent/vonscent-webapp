import { describe, expect, it } from "vitest";
import {
  heroSchedule,
  heroTargetHref,
  heroToCampaign,
  isInternalPath,
} from "./lib";
import type { HeroAdminRow, LiveHero } from "./types";

describe("isInternalPath", () => {
  it("дотоод хаяг", () => {
    for (const ok of ["/", "/catalog", "/collections/build", "/catalog?tags=new"])
      expect(isInternalPath(ok)).toBe(true);
  });
  it("гадаад / protocol-relative / хоосон зай → хориотой", () => {
    for (const bad of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "catalog",
      "/a b",
      `/${"a".repeat(300)}`,
    ])
      expect(isInternalPath(bad)).toBe(false);
  });
});

describe("heroTargetHref", () => {
  it("төрөл бүр", () => {
    expect(heroTargetHref({ type: "event", slug: "black-friday" })).toBe(
      "/sale/black-friday",
    );
    expect(heroTargetHref({ type: "season", value: "winter" })).toBe(
      "/catalog?kind=perfume&season=winter",
    );
    expect(heroTargetHref({ type: "catalog", query: "?tags=new" })).toBe(
      "/catalog?tags=new",
    );
    expect(heroTargetHref({ type: "catalog", query: "" })).toBe("/catalog");
    expect(heroTargetHref({ type: "path", href: "/gift-cards" })).toBe(
      "/gift-cards",
    );
  });
  it("хадгалсан path гадаад болсон байсан ч уншихад «/»", () => {
    expect(heroTargetHref({ type: "path", href: "//evil.example" })).toBe("/");
  });
});

const live: LiveHero = {
  id: "h1",
  eyebrow: "Black Friday",
  title: "Жилийн хамгийн том хямдрал",
  description: "30% хүртэл",
  mobileDescription: null,
  primaryLabel: "Үзэх",
  primaryTarget: { type: "event", slug: "black-friday" },
  secondaryLabel: null,
  secondaryTarget: null,
  desktopImage: { base: "https://s/hero/a/b", widths: [3200, 1600, 2400], height1600: 571 },
  mobileImage: { src: "https://s/hero/a/m.webp", width: 1600, height: 1200 },
  imageAlt: "",
  dark: true,
};

describe("heroToCampaign", () => {
  it("кодын hero-той ижил хэлбэр, srcSet өсөх дарааллаар", () => {
    const c = heroToCampaign(live);
    expect(c.primary).toEqual({ label: "Үзэх", href: "/sale/black-friday" });
    expect(c.secondary).toBeUndefined();
    expect(c.image).toMatchObject({
      kind: "static",
      src: "https://s/hero/a/b-1600.webp",
      width: 1600,
      height: 571,
      dark: true,
      // alt хоосон бол гарчиг.
      alt: "Жилийн хамгийн том хямдрал",
      srcSet:
        "https://s/hero/a/b-1600.webp 1600w, https://s/hero/a/b-2400.webp 2400w, https://s/hero/a/b-3200.webp 3200w",
    });
  });
});

describe("heroSchedule", () => {
  const row = (p: Partial<HeroAdminRow>): HeroAdminRow => ({
    ...live,
    name: "A",
    saleEventId: null,
    startsAt: "2026-11-22T16:00:00Z",
    endsAt: "2026-11-30T16:00:00Z",
    priority: 0,
    isActive: true,
    updatedAt: "",
    ...p,
  });
  // 2026-11-20 УБ.
  const now = Date.parse("2026-11-20T04:00:00Z");

  it("хоосон өдөр кодын hero, хугацаандаа DB hero", () => {
    const s = heroSchedule([row({})], [], now, 14);
    expect(s).toEqual([
      { from: "2026-11-20", to: "2026-11-22", heroId: null, label: "Кодын hero" },
      { from: "2026-11-23", to: "2026-11-30", heroId: "h1", label: "A" },
      { from: "2026-12-01", to: "2026-12-03", heroId: null, label: "Кодын hero" },
    ]);
  });

  it("их эрэмбэ түрүүлнэ; ноорог, зураггүй, ноорог арга хэмжээ тоогдохгүй", () => {
    const s = heroSchedule(
      [
        row({}),
        row({ id: "h2", name: "B", priority: 5 }),
        row({ id: "h3", name: "draft", priority: 9, isActive: false }),
        row({ id: "h4", name: "noimg", priority: 9, mobileImage: null }),
        row({ id: "h5", name: "ev", priority: 9, saleEventId: "e1" }),
      ],
      [{ id: "e1", slug: "x", name: "x", startsAt: "2026-11-22T16:00:00Z", endsAt: "2026-11-30T16:00:00Z", isActive: false }],
      now,
      5,
    );
    expect(s.find((x) => x.heroId)?.label).toBe("B");
  });
});
