import { z } from "zod";

export const couponInputSchema = z.object({
  code: z.string().min(2).max(40),
  type: z.enum(["percent", "fixed"]),
  value: z.number().int().nonnegative(),
  minSubtotal: z.number().int().nonnegative().default(0),
  maxUses: z.number().int().positive().nullable().default(null),
  /** Cap per account; null = only the shop-wide `maxUses` applies (B4). */
  maxUsesPerUser: z.number().int().positive().nullable().default(null),
  /** Set = personal coupon, usable only by this customer (B4). */
  userId: z.string().uuid().nullable().default(null),
  startsAt: z.string().nullable().default(null),
  endsAt: z.string().nullable().default(null),
  isActive: z.boolean().default(true),
});

export type CouponInput = z.infer<typeof couponInputSchema>;
