import { z } from "zod";
import {
  REVIEW_BODY_MAX,
  REVIEW_MODERATED_BODY_MAX,
  REVIEW_MODERATED_BODY_MIN,
  REVIEW_REJECT_REASONS,
} from "@/lib/constants";

/**
 * Сэтгэгдлийн зорилт: ус (`productId`) эсвэл бэлэн багц (`collectionId`,
 * 0107) — ЯГ НЭГ нь. DB дээр `reviews_one_target` check ижил дүрмийг барина.
 */
const target = {
  productId: z.string().uuid().optional(),
  collectionId: z.string().uuid().optional(),
};
const oneTarget = (v: { productId?: string; collectionId?: string }) =>
  Boolean(v.productId) !== Boolean(v.collectionId);
const ONE_TARGET = { message: "Ус эсвэл багцын аль нэг нь" };

export const reviewInputSchema = z
  .object({
    ...target,
    rating: z.number().int().min(1).max(5),
    // Trim first so a whitespace-only body counts as "rating only" — the recent
    // reviews query filters on body = '' and would otherwise surface a blank card.
    body: z.string().trim().max(REVIEW_BODY_MAX).default(""),
  })
  .refine(oneTarget, ONE_TARGET);

export type ReviewInput = z.infer<typeof reviewInputSchema>;

/** Зайг тооцохгүй тэмдэгтийн тоо — «100 тэмдэгт» нь үүгээр (0162). */
export function countReviewChars(body: string): number {
  return body.replace(/\s/g, "").length;
}

/**
 * Хяналттай сэтгэгдэл (feature flag `review_moderation`): текст заавал,
 * зайг тооцохгүйгээр `REVIEW_MODERATED_BODY_MIN`+. DB trigger ижил дүрэмтэй.
 */
export const moderatedReviewInputSchema = z
  .object({
    ...target,
    rating: z.number().int().min(1).max(5),
    body: z
      .string()
      .trim()
      .max(REVIEW_MODERATED_BODY_MAX)
      .refine((b) => countReviewChars(b) >= REVIEW_MODERATED_BODY_MIN, {
        message: `Хамгийн багадаа ${REVIEW_MODERATED_BODY_MIN} тэмдэгт`,
      }),
  })
  .refine(oneTarget, ONE_TARGET);

/** GET /api/reviews/eligibility — ус эсвэл багц. */
export const reviewEligibilitySchema = z
  .object(target)
  .refine(oneTarget, ONE_TARGET);

/** PATCH /api/admin/reviews/[id] — админы хяналтын нэг үйлдэл. */
export const reviewModerationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({
    action: z.literal("reject"),
    reason: z.enum(REVIEW_REJECT_REASONS),
  }),
  z.object({ action: z.literal("visibility"), visible: z.boolean() }),
  z.object({ action: z.literal("featured"), featured: z.boolean() }),
]);

export type ReviewModerationInput = z.infer<typeof reviewModerationSchema>;

/** Query params for DELETE /api/reviews — staff removing a review. */
export const reviewDeleteSchema = z.object({
  id: z.string().uuid(),
});

/** Query params for GET /api/reviews — one page of a product's / bundle's reviews. */
export const reviewPageSchema = z
  .object({
    ...target,
    offset: z.coerce.number().int().min(0).max(10_000).default(0),
  })
  .refine(oneTarget, ONE_TARGET);
