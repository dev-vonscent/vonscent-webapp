import { describe, expect, it } from "vitest";
import {
  generationIdOf,
  heroAt,
  heroSchedule,
  heroTargetBlock,
  heroTargetHref,
  heroToCampaign,
  isInternalPath,
  normalizePromoHref,
  pickLiveHero,
  targetOutsidePeriod,
} from "./lib";
import type { HeroAdminRow, HeroEventOption, LiveHero } from "./types";

describe("generationIdOf", () => {
  const job = "0b5f3c1e-2a4d-4e8f-9c6b-1d2e3f4a5b6c";
  it("AI ажлаас ирсэн desktop base / mobile src", () => {
    expect(generationIdOf(`https://s/b/hero/g/gen-${job}-a1b2c3d4`)).toBe(job);
    expect(generationIdOf(`https://s/b/hero/g/gen-${job}-a1b2c3d4-m1600.webp`)).toBe(job);
  });
  it("өөрөө оруулсан, хоосон бол null", () => {
    expect(generationIdOf(`https://s/b/hero/g/${job}`)).toBeNull();
    expect(generationIdOf(null)).toBeNull();
  });
});

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
    // `/sale/x` 307-гүйгээр шууд каталог (fixes F3).
    expect(heroTargetHref({ type: "event", slug: "black-friday" })).toBe(
      "/catalog?event=black-friday",
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
    expect(c.primary).toEqual({
      label: "Үзэх",
      href: "/catalog?event=black-friday",
    });
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

const row = (p: Partial<HeroAdminRow>): HeroAdminRow => ({
  ...live,
  primaryTarget: { type: "path", href: "/catalog" },
  name: "A",
  season: null,
  seasonStartMd: null,
  productIds: [],
    saleEventId: null,
  startsAt: "2026-11-22T16:00:00Z",
  endsAt: "2026-11-30T16:00:00Z",
  priority: 0,
  isActive: true,
  updatedAt: "",
  ...p,
});

// Black Friday: 11/23 00:00 – 12/01 00:00 (УБ), exclusive.
const bf: HeroEventOption = {
  id: "e-bf",
  slug: "black-friday",
  name: "Black Friday",
  startsAt: "2026-11-22T16:00:00Z",
  endsAt: "2026-11-30T16:00:00Z",
  isActive: true,
};

describe("heroSchedule", () => {
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

describe("heroTargetBlock (fixes F2)", () => {
  const at = Date.parse("2026-11-25T04:00:00Z");
  const h = (slug: string, secondary = false) =>
    secondary
      ? {
          primaryTarget: { type: "path", href: "/" } as const,
          secondaryTarget: { type: "event", slug } as const,
        }
      : { primaryTarget: { type: "event", slug } as const, secondaryTarget: null };

  it("live → null", () => {
    expect(heroTargetBlock(h("black-friday"), [bf], at)).toBeNull();
  });
  it("товлосон → scheduled + startsAt", () => {
    const b = heroTargetBlock(h("black-friday"), [bf], Date.parse("2026-11-20T04:00:00Z"));
    expect(b).toMatchObject({ reason: "scheduled", startsAt: bf.startsAt, name: "Black Friday" });
  });
  it("ноорог → draft", () => {
    expect(heroTargetBlock(h("black-friday"), [{ ...bf, isActive: false }], at)?.reason).toBe("draft");
  });
  it("дууссан → ended", () => {
    expect(heroTargetBlock(h("black-friday"), [bf], Date.parse("2026-12-01T04:00:00Z"))?.reason).toBe("ended");
  });
  it("slug олдохгүй → missing", () => {
    expect(heroTargetBlock(h("nope"), [bf], at)).toMatchObject({ reason: "missing", name: null });
  });
  it("secondary товч ч шалгагдана", () => {
    expect(heroTargetBlock(h("nope", true), [bf], at)?.reason).toBe("missing");
    expect(heroTargetBlock(h("black-friday", true), [bf], at)).toBeNull();
  });
});

describe("heroSchedule — товчны арга хэмжээ (fixes F2)", () => {
  it("11/20–11/30 hero, товч нь 11/23-нд эхлэх арга хэмжээ рүү → 11/23-аас", () => {
    const s = heroSchedule(
      [
        row({
          primaryTarget: { type: "event", slug: "black-friday" },
          startsAt: "2026-11-19T16:00:00Z",
        }),
      ],
      [bf],
      Date.parse("2026-11-20T04:00:00Z"),
      11,
    );
    expect(s).toEqual([
      { from: "2026-11-20", to: "2026-11-22", heroId: null, label: "Кодын hero" },
      { from: "2026-11-23", to: "2026-11-30", heroId: "h1", label: "A" },
    ]);
  });
  it("heroAt: блоклогдсон бол дараагийн hero", () => {
    const t = Date.parse("2026-11-21T04:00:00Z");
    const blocked = row({
      primaryTarget: { type: "event", slug: "black-friday" },
      startsAt: "2026-11-19T16:00:00Z",
      priority: 10,
    });
    const winter = row({ id: "h2", name: "Өвөл", startsAt: "2026-11-01T00:00:00Z" });
    expect(heroAt([blocked, winter], [bf], t)?.id).toBe("h2");
  });
});

describe("targetOutsidePeriod", () => {
  const t = { type: "event", slug: "black-friday" } as const;
  it("hero-гийн хугацаа арга хэмжээнээс эрт эхэлбэл анхааруулна", () => {
    expect(
      targetOutsidePeriod({ startsAt: "2026-11-19T16:00:00Z", endsAt: bf.endsAt }, t, [bf]),
    ).toBe(bf);
    expect(targetOutsidePeriod({ startsAt: bf.startsAt, endsAt: bf.endsAt }, t, [bf])).toBeNull();
    expect(targetOutsidePeriod(null, t, [{ ...bf, isActive: false }])?.id).toBe("e-bf");
    expect(targetOutsidePeriod(null, { type: "path", href: "/" }, [bf])).toBeNull();
  });
});

describe("normalizePromoHref (fixes F3)", () => {
  it("/sale/x ба /catalog?event=x, origin, query дараалал — тэнцүү", () => {
    const want = normalizePromoHref("/catalog?event=x");
    for (const h of [
      "/sale/x",
      "/sale/x/",
      "https://vonscent.mn/sale/x",
      "https://www.vonscent.mn/catalog?event=x",
    ])
      expect(normalizePromoHref(h)).toBe(want);
    expect(normalizePromoHref("/catalog?tags=new&event=x")).toBe(
      normalizePromoHref("/catalog?event=x&tags=new"),
    );
  });
  it("өөр газар / гадаад хаяг тэнцэхгүй", () => {
    expect(normalizePromoHref("/catalog?event=y")).not.toBe(normalizePromoHref("/sale/x"));
    expect(normalizePromoHref("https://evil.example/sale/x")).not.toBe(
      normalizePromoHref("/sale/x"),
    );
  });
});

describe("pickLiveHero (fixes F5)", () => {
  const r = (id: string, startsAt: string, endsAt: string) => ({ id, startsAt, endsAt });
  const now = Date.parse("2026-11-30T16:00:30Z");
  it("эхнийх дууссан → хоёр дахь", () => {
    expect(
      pickLiveHero(
        [
          r("bf", "2026-11-22T16:00:00Z", "2026-11-30T16:00:00Z"),
          r("winter", "2026-11-01T00:00:00Z", "2027-02-01T00:00:00Z"),
        ],
        now,
      )?.id,
    ).toBe("winter");
  });
  it("бүгд дууссан → null", () => {
    expect(pickLiveHero([r("bf", "2026-11-22T16:00:00Z", "2026-11-30T16:00:00Z")], now)).toBeNull();
  });
});

describe("heroAt + улирлын шат (0185)", () => {
  const IMG = { base: "b", widths: [1600], height1600: 571 };
  const MOB = { src: "m", width: 1600, height: 1200 };
  const season = (s: "autumn" | "winter", md: string): HeroAdminRow =>
    row({
      id: s,
      name: s,
      season: s,
      seasonStartMd: md,
      startsAt: null,
      endsAt: null,
      isActive: true,
      desktopImage: IMG,
      mobileImage: MOB,
    });
  const seasons = [season("autumn", "09-01"), season("winter", "12-01")];
  const ev = {
    id: "e1",
    slug: "bf",
    name: "BF",
    startsAt: "2026-11-22T16:00:00Z",
    endsAt: "2026-12-03T16:00:00Z",
    isActive: true,
  };
  const bf = row({
    id: "bf",
    saleEventId: "e1",
    startsAt: null,
    endsAt: null,
    priority: 10,
    isActive: true,
    desktopImage: IMG,
    mobileImage: MOB,
  });
  const at = (d: string) => Date.parse(`${d}T12:00:00+08:00`);

  it("арга хэмжээ 11/23–12/3: 11/22 Намар, хугацаандаа арга хэмжээ, 12/4 Өвөл", () => {
    const all = [...seasons, bf];
    expect(heroAt(all, [ev], at("2026-11-22"))?.id).toBe("autumn");
    expect(heroAt(all, [ev], at("2026-11-25"))?.id).toBe("bf");
    expect(heroAt(all, [ev], at("2026-12-04"))?.id).toBe("winter");
  });

  it("тусгай өдөр улирлаас дээгүүр", () => {
    const special = row({
      id: "hw",
      startsAt: "2026-10-25T16:00:00Z",
      endsAt: "2026-10-31T16:00:00Z",
      isActive: true,
      desktopImage: IMG,
      mobileImage: MOB,
    });
    expect(heroAt([...seasons, special], [], at("2026-10-28"))?.id).toBe("hw");
    expect(heroAt([...seasons, special], [], at("2026-11-02"))?.id).toBe("autumn");
  });

  it("heroSchedule: Намар → арга хэмжээ → Өвөл (хил дээр өөрөө солигдоно)", () => {
    const s = heroSchedule([...seasons, bf], [ev], at("2026-11-20"), 20);
    expect(s.map((x) => [x.heroId, x.from, x.to])).toEqual([
      ["autumn", "2026-11-20", "2026-11-22"],
      ["bf", "2026-11-23", "2026-12-03"],
      ["winter", "2026-12-04", "2026-12-09"],
    ]);
  });
});
