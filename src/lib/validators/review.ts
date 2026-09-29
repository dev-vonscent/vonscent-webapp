import { z } from "zod";
import { REVIEW_BODY_MAX } from "@/lib/constants";

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
