import type { RewardTier } from "@/lib/validators/coupon";

/** Threshold the single pre-tier `autoGrant` config fell back to in SQL. */
const LEGACY_MIN_TOTAL = 300_000;

/**
 * Reads `settings.coupons` in either shape: the tier list (0117) or the single
 * `autoGrant` object it replaced, which becomes one tier. `grant_reward_coupon`
 * reads the stored value the same way, so a row nobody has re-saved yet keeps
 * granting exactly what it did before.
 */
export function readRewardTiers(value: unknown): RewardTier[] {
  const v = (value ?? {}) as { tiers?: unknown; autoGrant?: unknown };
  if (Array.isArray(v.tiers)) {
    return v.tiers.map((t, i) => toTier(t, `tier-${i}`));
  }
  if (v.autoGrant && typeof v.autoGrant === "object") {
    return [toTier(v.autoGrant, "legacy")];
  }
  return [];
}

function toTier(raw: unknown, fallbackId: string): RewardTier {
  const t = (raw ?? {}) as Record<string, unknown>;
  return {
    id: typeof t.id === "string" && t.id ? t.id : fallbackId,
    enabled: t.enabled === true,
    minTotal: Number(t.minTotal ?? LEGACY_MIN_TOTAL) || 0,
    type: t.type === "fixed" ? "fixed" : "percent",
    value: Number(t.value ?? 10) || 0,
    validDays: Number(t.validDays ?? 30) || 0,
    maxUsesPerUser: Number(t.maxUsesPerUser ?? 1) || 1,
  };
}

/**
 * The tier a paid order earns: among enabled tiers whose threshold the goods
 * net reaches, the one with the highest threshold. With 100k and 300k both on,
 * a 350k order earns the 300k coupon only. Mirrors `grant_reward_coupon`.
 */
export function pickRewardTier(
  tiers: readonly RewardTier[],
  base: number,
): RewardTier | null {
  let best: RewardTier | null = null;
  for (const t of tiers) {
    if (!t.enabled || t.minTotal <= 0 || base < t.minTotal) continue;
    if (
      !best ||
      t.minTotal > best.minTotal ||
      (t.minTotal === best.minTotal && t.value > best.value)
    ) {
      best = t;
    }
  }
  return best;
}

/** Display/save order: lowest threshold first, the way the ladder reads. */
export function sortRewardTiers(tiers: readonly RewardTier[]): RewardTier[] {
  return [...tiers].sort((a, b) => a.minTotal - b.minTotal);
}

export interface RewardLadderRow {
  id: string;
  from: number;
  /** Inclusive upper bound; null for the top tier. */
  to: number | null;
  type: RewardTier["type"];
  value: number;
  validDays: number;
}

/**
 * The enabled tiers as the non-overlapping ₮ ranges a customer actually falls
 * into — what `pickRewardTier` does, spelled out for the operator. Tiers that
 * could never be picked (off, zero, or sharing a threshold) are left out.
 */
export function describeRewardLadder(
  tiers: readonly RewardTier[],
): RewardLadderRow[] {
  const live = sortRewardTiers(
    tiers.filter((t) => t.enabled && t.minTotal > 0 && t.value > 0),
  );
  const rows: RewardLadderRow[] = [];
  for (const t of live) {
    // Same threshold twice (saving refuses it, but the form can hold it):
    // show only the one `pickRewardTier` would choose — the larger value.
    const last = rows.at(-1);
    if (last && last.from === t.minTotal) {
      if (t.value <= last.value) continue;
      rows.pop();
    }
    rows.push({
      id: t.id,
      from: t.minTotal,
      to: null,
      type: t.type,
      value: t.value,
      validDays: t.validDays,
    });
  }
  for (let i = 0; i < rows.length - 1; i++) rows[i].to = rows[i + 1].from - 1;
  return rows;
}
