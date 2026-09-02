/**
 * Order dispatch and cut-off rules in Ulaanbaatar local time.
 *
 * The client's rule (2026-08-21, docs/analysis/questions.md №14) as amended by
 * the 2026-09-02 backlog (E1 — pre-orders):
 *   - an order carries the day it is delivered (`orders.deliver_on`); the
 *     customer picks it at checkout and the earliest choice is tomorrow;
 *   - on that day the order goes out at 11:00 — weekends included, there is
 *     no same-day tier;
 *   - the customer may cancel / change it until 09:00 on THAT day (the decants
 *     are being prepared from then on), so a pre-order stays cancellable for
 *     as long as it is still waiting;
 *   - at 23:00 the day's deliveries are done (status flips to delivered by
 *     cron — see 0032_order_rules.sql / 0052_order_deliver_on.sql).
 *
 * Orders placed before E1 have no stored day, so every function falls back to
 * the old rule (the day after the order was placed) and keeps behaving as it
 * always did.
 *
 * Servers usually run in UTC, so every calculation is done on a TZDate pinned
 * to Asia/Ulaanbaatar rather than on the host's local clock.
 */

import { TZDate } from "@date-fns/tz";
import { addDays, format } from "date-fns";

export const UB_TIMEZONE = "Asia/Ulaanbaatar";

/** Every order leaves for delivery at this hour (UB) on its delivery day. */
export const DISPATCH_HOUR = 11;

/** After this hour (UB) on the delivery day, no changes or cancellation. */
export const ORDER_EDIT_CUTOFF_HOUR = 9;

/**
 * How far ahead a customer may book a delivery. A pre-order reserves its ml
 * the moment it is paid, so the horizon is deliberately short — stock held for
 * a month is stock the shop cannot sell.
 */
export const MAX_PREORDER_DAYS = 14;

/** What the order rows these helpers read look like. */
export interface OrderTiming {
  created_at: string | number | Date;
  /** "yyyy-MM-dd" (UB). Null on orders placed before pre-orders existed. */
  deliver_on?: string | null;
}

/** Today's UB calendar day as "yyyy-MM-dd". */
export function ubToday(now: Date = new Date()): string {
  return format(new TZDate(now.getTime(), UB_TIMEZONE), "yyyy-MM-dd");
}

/** "yyyy-MM-dd" (UB) `days` days from now — the checkout default is 1. */
export function ubDayFromNow(days: number, now: Date = new Date()): string {
  return format(
    addDays(new TZDate(now.getTime(), UB_TIMEZONE), days),
    "yyyy-MM-dd",
  );
}

/** The earliest day an order may be delivered: tomorrow (UB). */
export function earliestDeliveryDay(now: Date = new Date()): string {
  return ubDayFromNow(1, now);
}

/** The latest day the checkout offers. */
export function latestDeliveryDay(now: Date = new Date()): string {
  return ubDayFromNow(MAX_PREORDER_DAYS, now);
}

/**
 * The day an order is delivered — its stored `deliver_on`, or the pre-E1 rule
 * (the day after it was placed) for rows that predate the column.
 */
export function deliveryDayOf(order: OrderTiming): string {
  if (order.deliver_on) return order.deliver_on;
  return format(
    addDays(new TZDate(new Date(order.created_at).getTime(), UB_TIMEZONE), 1),
    "yyyy-MM-dd",
  );
}

/** The instant `hour`:00 UB falls on the given "yyyy-MM-dd" day. */
function dayAt(day: string, hour: number): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(
    new TZDate(y, m - 1, d, hour, 0, 0, 0, UB_TIMEZONE).getTime(),
  );
}

/** The instant an order goes out: 11:00 UB on its delivery day. */
export function orderDispatchAt(order: OrderTiming): Date {
  return dayAt(deliveryDayOf(order), DISPATCH_HOUR);
}

/** The instant an order stops being editable: 09:00 UB on its delivery day. */
export function orderEditDeadline(order: OrderTiming): Date {
  return dayAt(deliveryDayOf(order), ORDER_EDIT_CUTOFF_HOUR);
}

/**
 * Whether the customer may still cancel / change an order.
 * Status is checked separately by the caller — this is only the time rule.
 */
export function isOrderEditable(
  order: OrderTiming,
  now: Date = new Date(),
): boolean {
  return now.getTime() < orderEditDeadline(order).getTime();
}

/** "08/22 09:00" style label for the deadline, in UB time. */
export function formatDeadline(order: OrderTiming): string {
  const deadline = orderEditDeadline(order);
  return format(new TZDate(deadline.getTime(), UB_TIMEZONE), "MM/dd HH:00");
}

const WEEKDAYS_MN = [
  "Ням",
  "Даваа",
  "Мягмар",
  "Лхагва",
  "Пүрэв",
  "Баасан",
  "Бямба",
];

/** "09/04, Пүрэв" — how a delivery day is written for the customer. */
export function formatDeliveryDay(day: string, now: Date = new Date()): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new TZDate(y, m - 1, d, 12, 0, 0, 0, UB_TIMEZONE);
  const label = `${format(date, "MM/dd")}, ${WEEKDAYS_MN[date.getDay()]}`;
  if (day === earliestDeliveryDay(now)) return `Маргааш (${label})`;
  if (day === ubToday(now)) return `Өнөөдөр (${label})`;
  return label;
}
