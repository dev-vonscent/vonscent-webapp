import { HERO_SEASONS, SEASON_HERO_STARTS, type HeroSeason } from "@/lib/constants";
import { heroAt } from "./lib";
import { isSeasonReady, seasonHeroAt, ubDay } from "./season";
import type { HeroAdminRow, HeroEventOption } from "./types";

/**
 * «Нүүрний баннер» самбарын (studio-ux.md §7) цэвэр хэсэг: улирлын картын
 * төлөв, тусгай өдрийн жагсаалт, «одоо / дараагийнх». Бүгд `heroAt`-ийн дүрмээр
 * (SQL `live_heroes()`-тэй ижил).
 */

export type SeasonCardState =
  /** Одоо нүүр хуудсанд гарч байна. */
  | "live"
  /** Энэ улирлын хугацаа, гэхдээ арга хэмжээ / тусгай өдөр дээгүүр гарч байна. */
  | "waiting"
  /** Бэлэн — улирал нь ирэхэд гарна. */
  | "ready"
  /** Мөр байгаа ч дутуу (зураг г.м.) — өмнөх улирлынх үргэлжилнэ. */
  | "incomplete"
  /** Мөр алга. */
  | "empty";

export interface SeasonCard {
  season: HeroSeason;
  row: HeroAdminRow | null;
  startMd: string;
  state: SeasonCardState;
  /** `waiting` үед дээгүүр гарч буй баннерын нэр. */
  over: string | null;
}

export function seasonCards(
  heroes: readonly HeroAdminRow[],
  events: readonly HeroEventOption[],
  now: number,
): SeasonCard[] {
  const live = heroAt(heroes, events, now);
  const current = seasonHeroAt(heroes, now)?.row ?? null;
  return HERO_SEASONS.map((season) => {
    const row = heroes.find((h) => h.season === season) ?? null;
    const startMd = row?.seasonStartMd ?? SEASON_HERO_STARTS[season];
    let state: SeasonCardState;
    let over: string | null = null;
    if (!row) state = "empty";
    else if (!isSeasonReady(row)) state = "incomplete";
    else if (live?.id === row.id) state = "live";
    else if (current?.id === row.id) {
      state = "waiting";
      over = live?.name ?? null;
    } else state = "ready";
    return { season, row, startMd, state, over };
  });
}

/** Тусгай өдрийн баннер (хуучнаар «бие даасан»): арга хэмжээ, улиралгүй. */
export function specialHeroes(heroes: readonly HeroAdminRow[]): HeroAdminRow[] {
  return heroes
    .filter((h) => !h.season && !h.saleEventId)
    .sort((a, b) => (b.startsAt ?? "").localeCompare(a.startsAt ?? ""));
}

/**
 * «Одоо нүүр хуудсанд»: одоогийн баннер ба дараагийн солигдол (ирэх 400
 * хоногт өдөр бүрийн үдээр).
 */
export function nowAndNext(
  heroes: readonly HeroAdminRow[],
  events: readonly HeroEventOption[],
  now: number,
): { current: HeroAdminRow | null; next: { row: HeroAdminRow | null; day: string } | null } {
  const current = heroAt(heroes, events, now);
  const noon = Date.parse(`${ubDay(now)}T12:00:00+08:00`);
  for (let i = 1; i <= 400; i++) {
    const t = noon + i * 86_400_000;
    const h = heroAt(heroes, events, t);
    if ((h?.id ?? null) !== (current?.id ?? null)) return { current, next: { row: h, day: ubDay(t) } };
  }
  return { current, next: null };
}
