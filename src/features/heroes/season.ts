import type { HeroSeason } from "@/lib/constants";
import type { HeroDesktopImage, HeroMobileImage } from "./types";

/**
 * Улирлын баннерын дүрэм (studio-ux.md D9) — SQL `season_hero_at()`
 * (0185)-тэй ИЖИЛ: бэлэн (идэвхтэй, хоёр зурагтай) улирлын мөрүүдээс эхлэх
 * өдөр нь өнөөдрөөс (УБ) хойшгүй хамгийн сүүлийнх; жилийн эхэнд ийм нь
 * байхгүй бол хамгийн сүүлд эхэлдэг нь (өмнөх оноос). Төгсгөл нь дараагийн
 * бэлэн улирлын эхлэл (УБ 00:00, exclusive). Тэнцвэл id-аар.
 */
export interface SeasonRowLike {
  id: string;
  season: HeroSeason | null;
  seasonStartMd: string | null;
  isActive: boolean;
  desktopImage: HeroDesktopImage | null;
  mobileImage: HeroMobileImage | null;
}

const UB_OFFSET_MS = 8 * 3_600_000;

/** `t` → УБ-ийн `YYYY-MM-DD`. */
export function ubDay(t: number): string {
  return new Date(t + UB_OFFSET_MS).toISOString().slice(0, 10);
}

/** УБ-ийн `YYYY-MM-DD` 00:00 → ISO. */
function ubMidnight(year: number, md: string): string {
  return new Date(`${year}-${md}T00:00:00+08:00`).toISOString();
}

export function isSeasonReady(r: SeasonRowLike): boolean {
  return Boolean(r.season && r.seasonStartMd && r.isActive && r.desktopImage && r.mobileImage);
}

const byMd = (a: SeasonRowLike, b: SeasonRowLike) =>
  a.seasonStartMd! < b.seasonStartMd!
    ? -1
    : a.seasonStartMd! > b.seasonStartMd!
      ? 1
      : a.id < b.id
        ? -1
        : a.id > b.id
          ? 1
          : 0;

export function seasonHeroAt<T extends SeasonRowLike>(
  rows: readonly T[],
  at: number,
): { row: T; startsAt: string; endsAt: string } | null {
  const ready = rows.filter(isSeasonReady).sort(byMd);
  if (!ready.length) return null;
  const day = ubDay(at);
  const md = day.slice(5);
  const year = Number(day.slice(0, 4));

  // «md desc, id asc»-ийн эхнийх = md-ээрээ хамгийн их, тэнцвэл id бага.
  const pickLast = (list: T[]) => {
    const maxMd = list[list.length - 1].seasonStartMd;
    return list.find((r) => r.seasonStartMd === maxMd)!;
  };
  const before = ready.filter((r) => r.seasonStartMd! <= md);
  const cur = before.length ? pickLast(before) : pickLast(ready);
  const startYear = before.length ? year : year - 1;

  const after = ready.filter((r) => r.seasonStartMd! > cur.seasonStartMd!);
  const next = after.length ? after[0] : ready[0];
  const endYear = after.length ? startYear : startYear + 1;

  return {
    row: cur,
    startsAt: ubMidnight(startYear, cur.seasonStartMd!),
    endsAt: ubMidnight(endYear, next.seasonStartMd!),
  };
}

/** 'MM-DD' → «3-р сарын 1» (админы UI — «9-р сар» сонгогчтой ижил хэлбэр). */
export function mdLong(md: string): string {
  const [m, d] = md.split("-").map(Number);
  return `${m}-р сарын ${d}`;
}

/** 'MM-DD' → «3/1». */
export function mdLabel(md: string): string {
  const [m, d] = md.split("-").map(Number);
  return `${m}/${d}`;
}

/**
 * Cron (`/api/cron/sale-events`): бэлэн улирлын аль нэг нь `now`-оос өмнөх
 * `windowMs` дотор эхэлсэн бол true — нийтийн кэшийг цэвэрлэнэ (жилд ~4 удаа).
 */
export function seasonBoundaryWithin(
  rows: readonly SeasonRowLike[],
  now: number,
  windowMs: number,
): boolean {
  const day = ubDay(now);
  const year = Number(day.slice(0, 4));
  return rows.filter(isSeasonReady).some((r) => {
    const start = Date.parse(ubMidnight(year, r.seasonStartMd!));
    return start <= now && now - start < windowMs;
  });
}
