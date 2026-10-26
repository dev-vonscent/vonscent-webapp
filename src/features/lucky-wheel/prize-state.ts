import type { GrandPrizeState } from "./types";

/** The columns of a `bundle` spin that decide where its prize is (0165). */
export interface GrandPrizeRow {
  bundle_collection_id: string | null;
  claim_order_id: string | null;
  fulfilled_at: string | null;
  expires_at: string | null;
}

/**
 * Where a grand prize is. Delivered wins over everything (a staff mark
 * included); a prize already in an order is not «expired» even past its date
 * — the order is what counts, and a cancelled order hands it back with time
 * to spare (orders_spin_prize_sync).
 */
export function grandPrizeState(
  row: GrandPrizeRow,
  now: Date = new Date(),
): GrandPrizeState {
  if (row.fulfilled_at) return "delivered";
  if (row.claim_order_id) return "in_order";
  if (row.expires_at && new Date(row.expires_at) <= now) return "expired";
  return row.bundle_collection_id ? "ready" : "choose";
}

/** Still waiting on the customer — the states that count as «a prize to get». */
export function isPrizeOpen(state: GrandPrizeState): boolean {
  return state === "choose" || state === "ready";
}

/** Whole days left until `expiresAt` (0 on the last day), or null. */
export function daysLeft(
  expiresAt: string | null,
  now: Date = new Date(),
): number | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - now.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}
