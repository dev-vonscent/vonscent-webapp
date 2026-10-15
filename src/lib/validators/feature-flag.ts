import { z } from "zod";
import { FEATURE_FLAGS, type FeatureFlag } from "@/lib/constants";

/** Кодонд бүртгэлтэй туг мөн эсэх (`FEATURE_FLAGS`). */
export function isFeatureFlag(key: string): key is FeatureFlag {
  return Object.hasOwn(FEATURE_FLAGS, key);
}

/**
 * Feature flag (0133) — админы унтраалга. Түлхүүр нь `FEATURE_FLAGS`-ийн
 * хаалттай жагсаалт: кодонд байхгүй тугийг сан руу бичихгүй.
 */
export const featureFlagUpdateSchema = z.object({
  key: z.string().refine(isFeatureFlag, { message: "Бүртгэлгүй туг" }),
  enabled: z.boolean(),
});

export type FeatureFlagUpdateInput = z.infer<typeof featureFlagUpdateSchema>;
