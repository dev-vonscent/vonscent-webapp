import { z } from "zod";

/** Slugs go into `products.scent_families` and the ?family= URL param. */
const slug = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[a-z0-9-]+$/, "Зөвхөн латин жижиг үсэг, тоо, зураас");

export const scentFamilyCreateSchema = z.object({
  slug,
  label: z.string().min(1).max(60),
  iconUrl: z.string().max(2048).nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export const scentFamilyUpdateSchema = z.object({
  label: z.string().min(1).max(60).optional(),
  iconUrl: z.string().max(2048).nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export type ScentFamilyCreateInput = z.infer<typeof scentFamilyCreateSchema>;
export type ScentFamilyUpdateInput = z.infer<typeof scentFamilyUpdateSchema>;
