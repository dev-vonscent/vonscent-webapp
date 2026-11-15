import { HERO_SEASONS, SEASON_HERO_STARTS, type HeroSeason } from "@/lib/constants";
import { heroAt, heroPeriod } from "./lib";
import { isSeasonReady, seasonHeroAt, ubDay } from "./season";
import type { HeroAdminRow, HeroEventOption } from "./types";

/**
 * «Нүүрний баннер» самбарын (studio-ux.md §7) цэвэр хэсэг: улирлын картын
 * төлөв, жилийн хуваарь, «одоо / дараагийнх». Бүгд `heroAt`-ийн дүрмээр
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

export interface StripSeason {
  /** Оны эхнээс хэд дэх өдөр (0-ээс), хоёулаа хамааруулна. */
  from: number;
  to: number;
  season: HeroSeason | null;
}

export interface StripItem {
  id: string;
  from: number;
  to: number;
  label: string;
  kind: "event" | "special";
  /** Арга хэмжээний баннер → студийн ④ (нэг баннерыг хоёр газраас засахгүй). */
  saleEventId: string | null;
}

export interface YearStrip {
  year: number;
  days: number;
  seasons: StripSeason[];
  items: StripItem[];
  /** Өнөөдөр (жилд хамаарвал). */
  today: number | null;
}

function dayIndex(year: number, iso: string): number {
  const d = ubDay(Date.parse(iso));
  return Math.round(
    (Date.parse(`${d}T00:00:00Z`) - Date.parse(`${year}-01-01T00:00:00Z`)) / 86_400_000,
  );
}

/**
 * Жилийн хуваарь (§7): доор улирал (өдөр бүрийн үд — `seasonHeroAt`), дээр нь
 * арга хэмжээ ба тусгай өдрийн баннер (идэвхтэй, зурагтай нь).
 */
export function yearStrip(
  heroes: readonly HeroAdminRow[],
  events: readonly HeroEventOption[],
  year: number,
  now: number,
): YearStrip {
  const days = (Date.parse(`${year + 1}-01-01T00:00:00Z`) - Date.parse(`${year}-01-01T00:00:00Z`)) / 86_400_000;
  const seasons: StripSeason[] = [];
  for (let i = 0; i < days; i++) {
    const t = Date.parse(`${year}-01-01T12:00:00+08:00`) + i * 86_400_000;
    const s = seasonHeroAt(heroes, t)?.row.season ?? null;
    const last = seasons[seasons.length - 1];
    if (last && last.season === s) last.to = i;
    else seasons.push({ from: i, to: i, season: s });
  }
  const items: StripItem[] = [];
  for (const h of heroes) {
    if (h.season || !h.isActive || !h.desktopImage || !h.mobileImage) continue;
    const p = heroPeriod(h, events);
    if (!p || !p.eventActive) continue;
    // `ends_at` exclusive — сүүлийн өдөр нь түүнээс 1ms өмнө.
    const from = dayIndex(year, p.startsAt);
    const to = dayIndex(year, new Date(Date.parse(p.endsAt) - 1).toISOString());
    if (to < 0 || from >= days) continue;
    const ev = h.saleEventId ? events.find((e) => e.id === h.saleEventId) : null;
    items.push({
      id: h.id,
      from: Math.max(0, from),
      to: Math.min(days - 1, to),
      label: ev?.name ?? h.name,
      kind: h.saleEventId ? "event" : "special",
      saleEventId: h.saleEventId,
    });
  }
  items.sort((a, b) => a.from - b.from);
  const todayIdx = dayIndex(year, new Date(now).toISOString());
  return {
    year,
    days,
    seasons,
    items,
    today: todayIdx >= 0 && todayIdx < days ? todayIdx : null,
  };
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
