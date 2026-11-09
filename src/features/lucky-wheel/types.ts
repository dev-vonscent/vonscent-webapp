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
  /** What a miss shows instead of a prize — one picked at random (0170). */
  missTips: MissTip[];
}

/** A line of shop know-how on the «Хоосон» card (`settings.spin.missTips`). */
export interface MissTip {
  title: string;
  body: string;
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
  /** The spin's own id (0170; older servers sent it for grand wins only). */
  spinId?: string;
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

/* ── Бодит шагнал: гранд 2мл багц (0165), бараа × мл (0170) ──────────── */

export type BundleGender = "male" | "female";

/**
 * Where a won physical prize is on its way to the customer:
 * - `choose`    — a grand bundle won, none picked yet (a product prize
 *                 skips this — the admin chose the perfume);
 * - `ready`     — picked, waiting for the next order;
 * - `in_order`  — attached to an order that is not delivered yet;
 * - `delivered` — that order arrived (or staff marked it by hand);
 * - `expired`   — the claim window passed before it reached an order.
 */
export type GrandPrizeState =
  | "choose"
  | "ready"
  | "in_order"
  | "delivered"
  | "expired";

/** One of the two bundles the admin offers as the grand prize. */
export interface GrandBundleOption {
  gender: BundleGender;
  collectionId: string;
  name: string;
  image: string | null;
  members: { name: string; brand: string }[];
  /** Every member can be poured at 2ml right now. */
  available: boolean;
  /** The bundle's 2ml catalogue price — what the prize is worth. */
  value: number;
}

export interface GrandPrize {
  spinId: string;
  /** `bundle` — the grand 2ml bundle; `product` — one perfume × ml (0170). */
  kind: "bundle" | "product";
  label: string;
  wonAt: string;
  expiresAt: string | null;
  state: GrandPrizeState;
  gender: BundleGender | null;
  bundleName: string | null;
  /** `product` prize: the perfume and size (null for a bundle). */
  productName: string | null;
  ml: number | null;
  orderNo: string | null;
}

export interface GrandPrizesResponse {
  prizes: GrandPrize[];
  options: GrandBundleOption[];
}
