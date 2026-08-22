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

/** Every order leaves for delivery at this hour (UB) the day after it was placed. */
export const DISPATCH_HOUR = 11;

/** After this hour (UB) on the dispatch day, no changes or cancellation. */
export const ORDER_EDIT_CUTOFF_HOUR = 9;

/** The instant an order goes out: 11:00 UB on the day after it was placed. */
export function orderDispatchAt(placedAt: string | number | Date): Date {
  const ub = toUb(new Date(placedAt));
  const dispatch = new Date(ub);
  dispatch.setUTCDate(dispatch.getUTCDate() + 1);
  dispatch.setUTCHours(DISPATCH_HOUR, 0, 0, 0);
  return fromUb(dispatch);
}

/**
 * The instant an order stops being editable: 09:00 UB on its dispatch day
 * (always the day after it was placed).
 */
export function orderEditDeadline(placedAt: string | number | Date): Date {
  const ub = toUb(new Date(placedAt));
  const deadline = new Date(ub);
  deadline.setUTCDate(deadline.getUTCDate() + 1);
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

/** "08/22 09:00" style label for the deadline, in UB time. */
export function formatDeadline(placedAt: string | number | Date): string {
  const ub = toUb(orderEditDeadline(placedAt));
  const d = String(ub.getUTCDate()).padStart(2, "0");
  const m = String(ub.getUTCMonth() + 1).padStart(2, "0");
  return `${m}/${d} ${String(ub.getUTCHours()).padStart(2, "0")}:00`;
}
