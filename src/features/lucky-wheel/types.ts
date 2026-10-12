import type { SpinPrizeKind, SpinTier, SpinType } from "@/db/types";

export type { SpinPrizeKind, SpinTier, SpinType };

/**
 * A wheel segment as the *customer* sees it. Deliberately narrower than
 * `SpinWheelPrizeRow`: `weight`, `monthly_cap` and `fallback_slot` are the
 * shop's economics (docs/lucky-wheel.md §3–5) and never leave the server.
 */
export interface WheelPrize {
  slot: number;
  label: string;
  shortLabel: string;
  kind: SpinPrizeKind;
  tier: SpinTier;
  value: number;
  minSubtotal: number;
  maxDiscount: number | null;
}

/** One row of the customer's own spin history. */
export interface SpinHistoryItem {
  id: string;
  label: string;
  kind: SpinPrizeKind;
  tier: SpinTier;
  value: number;
  spinType: SpinType;
  couponCode: string | null;
  couponActive: boolean;
  createdAt: string;
}

/** Everything the page needs to render, from one round trip. */
export interface WheelState {
  enabled: boolean;
  prizes: WheelPrize[];
  /** V point charged for an extra spin (§9). */
  spinCost: number;
  freeSpinHours: number;
  /** One spin is earned per this many ₮ of an order; 0 = off. */
  orderSpinStep: number;
  /** Unused spins earned from paid orders. */
  orderSpins: number;
  /** The signed-in customer's spendable balance; 0 for guests. */
  points: number;
  nextFreeAt: string | null;
  freeReady: boolean;
  signedIn: boolean;
  /** The latest few spins — the page's preview list. */
  history: SpinHistoryItem[];
  /** Older spins exist beyond `history` (see `/api/lucky-wheel/history`). */
  hasMoreHistory: boolean;
}

/** One page of the full history. */
export interface SpinHistoryPage {
  items: SpinHistoryItem[];
  /** Offset of the next page, or null when this was the last one. */
  nextOffset: number | null;
}

export interface SpinSuccess {
  ok: true;
  slot: number;
  label: string;
  shortLabel: string;
  kind: SpinPrizeKind;
  tier: SpinTier;
  value: number;
  minSubtotal: number;
  maxDiscount: number | null;
  couponCode: string | null;
  couponExpiresAt: string | null;
  pointsSpent: number;
  /** Balance after the spin (cost deducted, points prize added). */
  points: number;
  orderSpins: number;
  nextFreeAt: string | null;
  freeReady: boolean;
}

export type SpinFailureReason =
  | "AUTH"
  | "COOLDOWN"
  | "DISABLED"
  | "NOT_ENOUGH_POINTS"
  | "NO_ORDER_SPINS"
  | "INVALID"
  | "NO_PRIZES"
  | "NO_DB";

export interface SpinFailure {
  ok: false;
  reason: SpinFailureReason;
  nextFreeAt?: string | null;
  points?: number;
  spinCost?: number;
}

export type SpinOutcome = SpinSuccess | SpinFailure;

/** Which entitlement a spin draws on — `spin_wheel(p_mode)`. */
export type SpinMode = "free" | "order" | "points";
