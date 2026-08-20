import { z } from "zod";

/** Base collection create — exactly 4 distinct products (client decision §14.3). */
export const collectionCreateSchema = z.object({
  name: z.string().min(2, "Нэр оруулна уу").max(80),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/u, "Латин үсэг, тоо, зураас")
    .optional(),
  gender: z.enum(["male", "female", "unisex"]).default("unisex"),
  description: z.string().max(1000).optional().default(""),
  discountPct: z.number().min(0).max(100).default(5),
  giftMl: z.number().int().positive().nullable().default(null),
  imageUrl: z.string().url().nullable().optional(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  productIds: z
    .array(z.string().min(1))
    .length(4, "Яг 4 үнэртэн сонгоно уу")
    .refine((ids) => new Set(ids).size === ids.length, "Бараа давхардсан"),
});

export const collectionUpdateSchema = collectionCreateSchema.partial();

export type CollectionCreateInput = z.infer<typeof collectionCreateSchema>;
export type CollectionUpdateInput = z.infer<typeof collectionUpdateSchema>;
