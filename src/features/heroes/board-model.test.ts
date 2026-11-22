import { describe, expect, it } from "vitest";
import type { HeroAdminRow } from "./types";
import { nowAndNext, seasonCards, specialHeroes } from "./board-model";

const IMG = { base: "b", widths: [1600], height1600: 571 };
const MOB = { src: "m", width: 1600, height: 1200 };
const base: HeroAdminRow = {
  id: "x",
  name: "x",
  saleEventId: null,
  startsAt: null,
  endsAt: null,
  priority: 0,
  isActive: true,
  eyebrow: "",
  title: "t",
  description: "",
  mobileDescription: null,
  primaryLabel: "b",
  primaryTarget: { type: "path", href: "/catalog" },
  secondaryLabel: null,
  secondaryTarget: null,
  desktopImage: IMG,
  mobileImage: MOB,
  imageAlt: "",
  dark: false,
  updatedAt: "2026-01-01T00:00:00Z",
  season: null,
  seasonStartMd: null,
  productIds: [],
};
const season = (s: "autumn" | "winter" | "spring", md: string, over: Partial<HeroAdminRow> = {}) =>
  ({ ...base, id: s, name: s, season: s, seasonStartMd: md, ...over }) as HeroAdminRow;
const ev = {
  id: "e1",
  slug: "bf",
  name: "Black Friday",
  startsAt: "2026-11-22T16:00:00Z",
  endsAt: "2026-12-03T16:00:00Z",
  isActive: true,
};
const bf: HeroAdminRow = { ...base, id: "bf", name: "BF баннер", saleEventId: "e1", priority: 10 };
const halloween: HeroAdminRow = {
  ...base,
  id: "hw",
  name: "Halloween",
  startsAt: "2026-10-25T16:00:00Z",
  endsAt: "2026-10-31T16:00:00Z",
};
const at = (d: string) => Date.parse(`${d}T12:00:00+08:00`);
const heroes = [season("autumn", "09-01"), season("winter", "12-01"), season("spring", "03-01", { mobileImage: null, isActive: false }), bf, halloween];

describe("seasonCards", () => {
  it("төлөв: одоо / хүлээж байна / бэлэн / дутуу / алга", () => {
    const now = seasonCards(heroes, [ev], at("2026-11-15"));
    expect(now.map((c) => [c.season, c.state])).toEqual([
      ["spring", "incomplete"],
      ["summer", "empty"],
      ["autumn", "live"],
      ["winter", "ready"],
    ]);
    const during = seasonCards(heroes, [ev], at("2026-11-25"));
    expect(during.find((c) => c.season === "autumn")).toMatchObject({
      state: "waiting",
      over: "BF баннер",
    });
    expect(now.find((c) => c.season === "summer")?.startMd).toBe("06-01");
  });
});

describe("specialHeroes", () => {
  it("зөвхөн арга хэмжээ, улиралгүй мөр", () => {
    expect(specialHeroes(heroes).map((h) => h.id)).toEqual(["hw"]);
  });
});

describe("nowAndNext", () => {
  it("одоо Намар, дараа нь 11/23-нд Black Friday", () => {
    const r = nowAndNext(heroes, [ev], at("2026-11-15"));
    expect(r.current?.id).toBe("autumn");
    expect(r.next).toMatchObject({ day: "2026-11-23" });
    expect(r.next?.row?.id).toBe("bf");
  });
});
