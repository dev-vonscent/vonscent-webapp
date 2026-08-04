/**
 * Order cut-off rules in Ulaanbaatar local time (requirement_fb.md §5).
 *
 * The client's rule:
 *   - orders placed before 11:00 ship the same day, later ones the next day;
 *   - once 10:00 on the dispatch day has passed, the order can no longer be
 *     changed or cancelled (the decants are already being prepared).
 *
 * Servers usually run in UTC, so every comparison here is done on a date
 * shifted into UB time (+08:00, no DST) rather than on the host's local clock.
 */

/** Asia/Ulaanbaatar is a fixed UTC+8 — Mongolia dropped DST in 2017. */
const UB_OFFSET_MINUTES = 8 * 60;

/** Same instant, re-expressed so that getUTC* reads as UB wall-clock time. */
function toUb(date: Date): Date {
  return new Date(date.getTime() + UB_OFFSET_MINUTES * 60_000);
}

/** Turn a UB wall-clock time back into a real instant. */
function fromUb(ub: Date): Date {
  return new Date(ub.getTime() - UB_OFFSET_MINUTES * 60_000);
}

/** Orders placed before this hour (UB) ship the same day. */
export const SAME_DAY_CUTOFF_HOUR = 11;

/** After this hour (UB) on the dispatch day, no changes or cancellation. */
export const ORDER_EDIT_CUTOFF_HOUR = 10;

/** True when `now` (UB) is still before today's same-day shipping cut-off. */
export function shipsToday(now: Date = new Date()): boolean {
  return toUb(now).getUTCHours() < SAME_DAY_CUTOFF_HOUR;
}

/**
 * The instant an order stops being editable: 10:00 UB on its dispatch day.
 * Dispatch day is the order date when placed before 11:00, otherwise the next.
 */
export function orderEditDeadline(placedAt: string | number | Date): Date {
  const ub = toUb(new Date(placedAt));
  const deadline = new Date(ub);
  if (ub.getUTCHours() >= SAME_DAY_CUTOFF_HOUR) {
    deadline.setUTCDate(deadline.getUTCDate() + 1);
  }
  deadline.setUTCHours(ORDER_EDIT_CUTOFF_HOUR, 0, 0, 0);
  return fromUb(deadline);
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

/** "Маргааш 10:00" style label for the deadline, in UB time. */
export function formatDeadline(placedAt: string | number | Date): string {
  const ub = toUb(orderEditDeadline(placedAt));
  const d = String(ub.getUTCDate()).padStart(2, "0");
  const m = String(ub.getUTCMonth() + 1).padStart(2, "0");
  return `${m}/${d} ${String(ub.getUTCHours()).padStart(2, "0")}:00`;
}
