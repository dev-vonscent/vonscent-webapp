import { describe, expect, it } from "vitest";
import type { HeroSeason } from "@/lib/constants";
import { mdLabel, mdLong, seasonBoundaryWithin, seasonHeroAt, type SeasonRowLike } from "./season";

const IMG = { base: "b", widths: [1600], height1600: 571 };
const MOB = { src: "m", width: 1600, height: 1200 };
const row = (season: HeroSeason, md: string, over: Partial<SeasonRowLike> = {}): SeasonRowLike => ({
  id: season,
  season,
  seasonStartMd: md,
  isActive: true,
  desktopImage: IMG,
  mobileImage: MOB,
  ...over,
});
const all = [
  row("spring", "03-01"),
  row("summer", "06-01"),
  row("autumn", "09-01"),
  row("winter", "12-01"),
];
/** УБ-ийн өдрийн үд. */
const at = (day: string) => Date.parse(`${day}T12:00:00+08:00`);
const pick = (rows: SeasonRowLike[], day: string) => seasonHeroAt(rows, at(day));

describe("seasonHeroAt (D9, SQL season_hero_at-тэй ижил)", () => {
  it("4 улирал бэлэн → өдөр бүрт зөв нь", () => {
    expect(pick(all, "2026-04-10")?.row.season).toBe("spring");
    expect(pick(all, "2026-06-01")?.row.season).toBe("summer");
    expect(pick(all, "2026-11-30")?.row.season).toBe("autumn");
    expect(pick(all, "2026-12-01")?.row.season).toBe("winter");
  });

  it("1/15 → Өвөл (оны эргэлт), хугацаа өмнөх оны 12/1 – 3/1", () => {
    const r = pick(all, "2027-01-15");
    expect(r?.row.season).toBe("winter");
    expect(r?.startsAt).toBe(new Date("2026-12-01T00:00:00+08:00").toISOString());
    expect(r?.endsAt).toBe(new Date("2027-03-01T00:00:00+08:00").toISOString());
  });

  it("Намрын хугацаа 9/1 – 12/1 (УБ 00:00)", () => {
    const r = pick(all, "2026-11-15");
    expect(r?.startsAt).toBe("2026-08-31T16:00:00.000Z");
    expect(r?.endsAt).toBe("2026-11-30T16:00:00.000Z");
  });

  it("Хавар хоосон → 3/1-ээс Өвөл үргэлжилнэ, Зун хүртэл", () => {
    const rows = [row("spring", "03-01", { mobileImage: null }), ...all.slice(1)];
    const r = pick(rows, "2027-04-01");
    expect(r?.row.season).toBe("winter");
    expect(r?.endsAt).toBe(new Date("2027-06-01T00:00:00+08:00").toISOString());
  });

  it("ганц улирал бэлэн → жилийн турш тэр", () => {
    const one = [row("winter", "12-01")];
    expect(pick(one, "2026-07-01")?.row.season).toBe("winter");
    const r = pick(one, "2026-12-05");
    expect(r?.endsAt).toBe(new Date("2027-12-01T00:00:00+08:00").toISOString());
  });

  it("нэг ч бэлэн биш / идэвхгүй → null", () => {
    expect(pick([], "2026-01-01")).toBeNull();
    expect(pick([row("winter", "12-01", { isActive: false })], "2026-12-05")).toBeNull();
  });

  it("эхлэх өдөр өөрчлөгдсөн (Өвөл 11/15)", () => {
    const rows = [...all.slice(0, 3), row("winter", "11-15")];
    expect(pick(rows, "2026-11-20")?.row.season).toBe("winter");
    expect(pick(rows, "2026-11-14")?.row.season).toBe("autumn");
  });

  it("УБ-ийн шөнө дунд хил", () => {
    expect(seasonHeroAt(all, Date.parse("2026-11-30T23:59:59+08:00"))?.row.season).toBe("autumn");
    expect(seasonHeroAt(all, Date.parse("2026-12-01T00:00:00+08:00"))?.row.season).toBe("winter");
  });
});

describe("seasonBoundaryWithin", () => {
  it("улирал эхэлснээс 2 минут дотор", () => {
    const start = Date.parse("2026-12-01T00:00:00+08:00");
    expect(seasonBoundaryWithin(all, start + 60_000, 120_000)).toBe(true);
    expect(seasonBoundaryWithin(all, start + 180_000, 120_000)).toBe(false);
    expect(seasonBoundaryWithin(all, start - 1, 120_000)).toBe(false);
  });
});

it("mdLabel", () => {
  expect(mdLabel("03-01")).toBe("3/1");
  expect(mdLong("11-22")).toBe("11-р сарын 22");
});
