/**
 * Order dispatch and cut-off rules in Ulaanbaatar local time.
 *
 * The client's rule (2026-08-21, docs/analysis/questions.md №14):
 *   - every order placed on day D (00:00–23:59) is dispatched the NEXT day at
 *     11:00 — weekends included, there is no same-day tier;
 *   - the customer may cancel / change the order until 09:00 on the dispatch
 *     day (the decants are being prepared from then on);
 *   - at 23:00 on the dispatch day deliveries are done (status flips to
 *     delivered by cron — see 0032_order_rules.sql).
 *
 * Servers usually run in UTC, so every calculation is done on a TZDate pinned
 * to Asia/Ulaanbaatar rather than on the host's local clock.
 */

import { TZDate } from "@date-fns/tz";
import { addDays, format } from "date-fns";

export const UB_TIMEZONE = "Asia/Ulaanbaatar";

/** Every order leaves for delivery at this hour (UB) the day after it was placed. */
export const DISPATCH_HOUR = 11;

/** After this hour (UB) on the dispatch day, no changes or cancellation. */
export const ORDER_EDIT_CUTOFF_HOUR = 9;

/** 0-ms instant on the day after `placedAt` at `hour`:00 UB wall-clock time. */
function nextDayAt(placedAt: string | number | Date, hour: number): Date {
  const ub = addDays(new TZDate(new Date(placedAt).getTime(), UB_TIMEZONE), 1);
  ub.setHours(hour, 0, 0, 0);
  return new Date(ub.getTime());
}

/** The instant an order goes out: 11:00 UB on the day after it was placed. */
export function orderDispatchAt(placedAt: string | number | Date): Date {
  return nextDayAt(placedAt, DISPATCH_HOUR);
}

/**
 * The instant an order stops being editable: 09:00 UB on its dispatch day
 * (always the day after it was placed).
 */
export function orderEditDeadline(placedAt: string | number | Date): Date {
  return nextDayAt(placedAt, ORDER_EDIT_CUTOFF_HOUR);
}

/**
 * Whether the customer may still cancel / change an order.
 * Status is checked separately by the caller — this is only the time rule.
 */
export function isOrderEditable(
  placedAt: string | number | Date,
  now: Date = new Date(),
): boolean {
  return now.getTime() < orderEditDeadline(placedAt).getTime();
}

/** "08/22 09:00" style label for the deadline, in UB time. */
export function formatDeadline(placedAt: string | number | Date): string {
  const deadline = orderEditDeadline(placedAt);
  return format(new TZDate(deadline.getTime(), UB_TIMEZONE), "MM/dd HH:00");
}
