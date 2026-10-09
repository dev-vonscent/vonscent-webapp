import { z } from "zod";

export const couponInputSchema = z.object({
  code: z.string().min(2).max(40),
  type: z.enum(["percent", "fixed"]),
  value: z.number().int().nonnegative(),
  minSubtotal: z.number().int().nonnegative().default(0),
  maxUses: z.number().int().positive().nullable().default(null),
  /** Cap per account; null = only the shop-wide `maxUses` applies (B4). */
  maxUsesPerUser: z.number().int().positive().nullable().default(null),
  /** Set = personal coupon: listed to this customer, shareable by code (0104). */
  userId: z.string().uuid().nullable().default(null),
  startsAt: z.string().nullable().default(null),
  endsAt: z.string().nullable().default(null),
  isActive: z.boolean().default(true),
});

export type CouponInput = z.infer<typeof couponInputSchema>;

/**
 * One automatic reward tier (`settings.coupons.tiers`, 0117): a paid order
 * whose goods net reaches `minTotal` earns a personal coupon. Several tiers may
 * be on at once, but an order earns only ONE — the highest `minTotal` it
 * reaches (`grant_reward_coupon` in SQL, `pickRewardTier` here).
 */
export const rewardTierSchema = z
  .object({
    id: z.string().min(1).max(64),
    enabled: z.boolean(),
    minTotal: z.number().int().positive().max(100_000_000),
    type: z.enum(["percent", "fixed"]),
    value: z.number().int().positive(),
    validDays: z.number().int().min(1).max(365),
    maxUsesPerUser: z.number().int().min(1).max(100).default(1),
  })
  .refine((t) => t.type !== "percent" || t.value <= 100, {
    message: "Хувь 1–100 хооронд байна.",
    path: ["value"],
  });

export type RewardTier = z.infer<typeof rewardTierSchema>;

export const couponSettingsSchema = z
  .object({ tiers: z.array(rewardTierSchema).max(10) })
  .superRefine(({ tiers }, ctx) => {
    // Two live tiers on the same threshold would make "which coupon?" a coin
    // toss, so the operator has to settle it before saving.
    const seen = new Set<number>();
    for (const t of tiers) {
      if (!t.enabled) continue;
      if (seen.has(t.minTotal)) {
        ctx.addIssue({
          code: "custom",
          message:
            "Идэвхтэй хоёр шатлал ижил доод дүнтэй байж болохгүй — нэгийг нь өөрчлөх эсвэл унтраана уу.",
          path: ["tiers"],
        });
        return;
      }
      seen.add(t.minTotal);
    }
  });

export type CouponSettings = z.infer<typeof couponSettingsSchema>;

/**
 * The first problem with a coupon-settings value, in words an operator can
 * act on — or null when it saves. Zod's own messages for range checks are
 * English, so only our custom (already Mongolian) ones pass through.
 */
export function couponSettingsError(value: unknown): string | null {
  const parsed = couponSettingsSchema.safeParse(value);
  if (parsed.success) return null;
  const issue = parsed.error.issues[0];
  if (issue?.code === "custom") return issue.message;
  const field = issue?.path.find((p) => typeof p === "string" && p !== "tiers");
  switch (field) {
    case "minTotal":
      return "Доод дүн 0-ээс их бүхэл тоо байна.";
    case "value":
      return "Хямдралын хэмжээ 0-ээс их бүхэл тоо байна.";
    case "validDays":
      return "Хүчинтэй хугацаа 1–365 хоног байна.";
    default:
      return "Автомат купоны тохиргоо буруу байна.";
  }
}
