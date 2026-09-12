import { z } from "zod";
import { REVIEW_BODY_MAX } from "@/lib/constants";

export const reviewInputSchema = z.object({
  productId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  // Trim first so a whitespace-only body counts as "rating only" — the recent
  // reviews query filters on body = '' and would otherwise surface a blank card.
  body: z.string().trim().max(REVIEW_BODY_MAX).default(""),
});

export type ReviewInput = z.infer<typeof reviewInputSchema>;

/** Query params for DELETE /api/reviews — staff removing a review. */
export const reviewDeleteSchema = z.object({
  id: z.string().uuid(),
});

/** Query params for GET /api/reviews — one page of a product's reviews. */
export const reviewPageSchema = z.object({
  productId: z.string().uuid(),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});
