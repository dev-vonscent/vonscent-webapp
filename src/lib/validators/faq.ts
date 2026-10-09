import { z } from "zod";
import { FAQ_CATEGORIES } from "@/lib/constants";

/** FAQ-ийн ангилал — тогтмол жагсаалт (`FAQ_CATEGORIES`). */
export const faqCategorySchema = z.enum(FAQ_CATEGORIES);

export const faqCreateSchema = z.object({
  category: faqCategorySchema,
  question: z.string().trim().min(1),
  answer: z.string().min(1),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  chatPinned: z.boolean().default(false),
});

export const faqPatchSchema = z.object({
  category: faqCategorySchema.optional(),
  question: z.string().trim().min(1).optional(),
  answer: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  chatPinned: z.boolean().optional(),
});
