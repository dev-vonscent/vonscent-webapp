/**
 * Date-range maths for the admin order filter, in Ulaanbaatar wall-clock time.
 *
 * The filter's URL values (`from` / `to`) stay in `YYYY-MM-DDTHH:mm` — exactly
 * what `<input type="datetime-local">` produced — so the server keeps pinning
 * `+08:00` onto them and nothing about the query changed. Only the control the
 * operator touches did.
 */
import { UB_TIMEZONE } from "@/lib/time";

/** `2026-08-29` for a Date, read in Ulaanbaatar rather than the viewer's zone. */
export function ubDateKey(d: Date): string {
  // `en-CA` is the shortest route to ISO-ordered parts.
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: UB_TIMEZONE,
  }).format(d);
}

/** Today in Ulaanbaatar, regardless of where the operator's laptop thinks it is. */
export function ubToday(now: Date = new Date()): string {
  return ubDateKey(now);
}

/** `2026-08-29` → `2026-08-29T00:00`, the shape the server already parses. */
export function startOfDayLocal(dateKey: string): string {
  return `${dateKey}T00:00`;
}

/**
 * End of day is 23:59, not the next midnight: the query uses `lte`, so
 * `T00:00` of the following day would pull in that day's first orders.
 */
export function endOfDayLocal(dateKey: string): string {
  return `${dateKey}T23:59`;
}

/** Shift a `YYYY-MM-DD` key by whole days without leaving calendar arithmetic. */
export function addDaysKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  // UTC noon keeps the arithmetic clear of every DST edge.
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export interface Preset {
  id: string;
  label: string;
  /** `null` clears the range entirely. */
  range: (today: string) => { from: string; to: string } | null;
}

/**
 * The ranges an operator actually asks for. Typing two datetimes to see today's
 * orders was the common case going through the slowest path on the page.
 */
export const DATE_PRESETS: Preset[] = [
  { id: "all", label: "Бүх хугацаа", range: () => null },
  {
    id: "today",
    label: "Өнөөдөр",
    range: (t) => ({ from: startOfDayLocal(t), to: endOfDayLocal(t) }),
  },
  {
    id: "yesterday",
    label: "Өчигдөр",
    range: (t) => {
      const y = addDaysKey(t, -1);
      return { from: startOfDayLocal(y), to: endOfDayLocal(y) };
    },
  },
  {
    id: "7d",
    label: "7 хоног",
    range: (t) => ({ from: startOfDayLocal(addDaysKey(t, -6)), to: endOfDayLocal(t) }),
  },
  {
    id: "30d",
    label: "30 хоног",
    range: (t) => ({ from: startOfDayLocal(addDaysKey(t, -29)), to: endOfDayLocal(t) }),
  },
];

/**
 * Which preset the current URL represents, or `custom` when it matches none.
 * Recomputed from the URL rather than stored, so a shared link highlights the
 * right chip.
 */
export function activePreset(
  from: string | undefined,
  to: string | undefined,
  today: string,
): string {
  if (!from && !to) return "all";
  for (const p of DATE_PRESETS) {
    const r = p.range(today);
    if (r && r.from === from && r.to === to) return p.id;
  }
  return "custom";
}

/** `2026-08-29T14:30` → `2026-08-29`; anything unparseable → `""`. */
export function dateKeyOf(local: string | undefined): string {
  return local && /^\d{4}-\d{2}-\d{2}/.test(local) ? local.slice(0, 10) : "";
}

/** `2026-08-29T14:30` → `14:30`. */
export function timeOf(local: string | undefined, fallback: string): string {
  return local && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(local)
    ? local.slice(11, 16)
    : fallback;
}

export const MONTH_NAMES = [
  "1-р сар",
  "2-р сар",
  "3-р сар",
  "4-р сар",
  "5-р сар",
  "6-р сар",
  "7-р сар",
  "8-р сар",
  "9-р сар",
  "10-р сар",
  "11-р сар",
  "12-р сар",
];

/** Mongolian weeks start on Monday. */
export const WEEKDAY_NAMES = ["Да", "Мя", "Лх", "Пү", "Ба", "Бя", "Ня"];

/**
 * The cells of one month grid, Monday-first, padded with `null` so the first
 * of the month lands under its real weekday.
 */
export function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month, 1, 12));
  // getUTCDay: 0 = Sunday. Monday-first means Sunday is the 7th column.
  const lead = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0, 12)).getUTCDate();
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(month + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    cells.push(`${year}-${mm}-${dd}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
