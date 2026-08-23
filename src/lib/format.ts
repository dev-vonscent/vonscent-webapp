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

const dateFmt = new Intl.DateTimeFormat("mn-MN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: UB_TIMEZONE,
});

export function formatDate(value: string | number | Date): string {
  return dateFmt.format(new Date(value));
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
