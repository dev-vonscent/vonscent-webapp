import { z } from "zod";

/**
 * Brand list validation (0050_brands.sql).
 *
 * The slug is derived rather than typed: unlike a scent family it never
 * appears in a URL, so asking an operator to invent one in the middle of
 * creating a product would be a field that costs attention and buys nothing.
 */
export const brandName = z.string().trim().min(1).max(80);

/** Latin slug from a brand name — the table's unique key. */
export function brandSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    // Strip combining marks so «Hermès» and «Hermes» cannot both exist.
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const brandCreateSchema = z.object({
  name: brandName,
  logoUrl: z.string().max(2048).nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export const brandUpdateSchema = z.object({
  name: brandName.optional(),
  logoUrl: z.string().max(2048).nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export type BrandCreateInput = z.infer<typeof brandCreateSchema>;
export type BrandUpdateInput = z.infer<typeof brandUpdateSchema>;
