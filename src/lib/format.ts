/**
 * Money is stored as an integer number of ₮ (development.md §3). These helpers
 * format for display only — never use the formatted string for math.
 */

import { formatDistanceToNow } from "date-fns";
import { mn } from "date-fns/locale";

import { UB_TIMEZONE } from "@/lib/time";

const mnt = new Intl.NumberFormat("mn-MN", {
  maximumFractionDigits: 0,
});

/** Format an integer ₮ amount, e.g. 45000 -> "45,000₮". */
export function formatPrice(amount: number): string {
  return `${mnt.format(Math.round(amount))}₮`;
}

/** Format a millilitre amount, e.g. 5 -> "5ml". */
export function formatMl(ml: number): string {
  return `${ml}ml`;
}

/**
 * Dates are assembled from parts rather than handed to a locale pattern.
 *
 * `mn-MN` writes a month with no year beside it as a ROMAN numeral, so
 * «08 IX 15:34» is what an order taken on 2026-09-08 15:34 actually rendered
 * as — unreadable next to the numeric «2026.09.08» the same screen showed
 * elsewhere. Composing the parts ourselves pins one shape everywhere:
 * `2026.09.08`, and `2026.09.08 15:34` when the clock time matters.
 *
 * Everything stays on Ulaanbaatar time, which is what the shop runs on.
 */
const partsFmt = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: UB_TIMEZONE,
});

function ubParts(value: string | number | Date): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of partsFmt.formatToParts(new Date(value))) {
    out[part.type] = part.value;
  }
  return out;
}

/** `2026.09.08` — Ulaanbaatar day. */
export function formatDate(value: string | number | Date): string {
  const p = ubParts(value);
  return `${p.year}.${p.month}.${p.day}`;
}

/**
 * Date *and* time (`2026.09.08 15:34`), for the admin lists that triage by
 * arrival.
 *
 * The order list showed date only, so fifty orders taken across one day all
 * read «2026.08.28» and could not be told apart — while the list's own filter
 * takes a `datetime-local`. The year is part of it too: a customer's order
 * history spans years, and «08 IX» left the operator guessing which one.
 */
export function formatDateTime(value: string | number | Date): string {
  const p = ubParts(value);
  return `${p.year}.${p.month}.${p.day} ${p.hour}:${p.minute}`;
}

/**
 * Relative label like "2 өдрийн өмнө". Future instants (clock skew on a just
 * created row) collapse to "саяхан" instead of the confusing "дараа".
 */
export function formatTimeAgo(
  value: string | number | Date,
  now: Date = new Date(),
): string {
  const date = new Date(value);
  if (date.getTime() >= now.getTime() - 30_000) return "саяхан";
  return formatDistanceToNow(date, { addSuffix: true, locale: mn });
}
