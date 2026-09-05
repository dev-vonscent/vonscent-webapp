import { z } from "zod";

/**
 * "all" (бүх улирал) already covers every season, so it cannot sit next to an
 * individual one — the admin UI enforces this, and so does the schema for any
 * request that bypasses the UI.
 */
const seasonList = z
  .array(z.enum(["spring", "summer", "autumn", "winter", "all"]))
  .transform((s) => (s.includes("all") ? ["all" as const] : [...new Set(s)]));

/**
 * A gallery image. The route additionally checks the URL points at our own
 * storage bucket (`isStorageUrl`) — that test needs server-side env, so it
 * can't live in this shared schema.
 */
export const productImageSchema = z.object({
  url: z.string().url().max(2048),
  alt: z.string().max(200).default(""),
  /** Whether the storefront shows it (0049). Uploads default to shown. */
  visible: z.boolean().default(true),
});

/** The store's whole size list — see ML_SIZES / 0026_sample_tier.sql. */
const mlSize = z.union([
  z.literal(2),
  z.literal(5),
  z.literal(10),
  z.literal(20),
]);

/**
 * One decant size as the admin priced it. There is no derived price any more:
 * `price` is the ₮ figure typed in the form and the figure customers pay.
 *
 * `active && price === 0` is refused. The daily job is typing four prices by
 * hand, so the product where only 5ml and 10ml were priced used to publish 2ml
 * and 20ml at 0₮ — real ml leaving the building for free. A size the shop does
 * not sell yet is `active: false`, not priced at zero.
 */
export const variantDraftSchema = z
  .object({
    ml: mlSize,
    price: z.number().int().nonnegative(),
    /**
     * Хямдарсан үнэ (0054) — байвал ЭНЭ нь бодитоор төлөх дүн, `price` нь
     * зураастай харагдах үндсэн үнэ болно. null бол хямдрал байхгүй.
     */
    salePrice: z.number().int().nonnegative().nullable().default(null),
    active: z.boolean(),
  })
  .refine((v) => !v.active || v.price > 0, {
    message: "Зарах хэмжээний үнэ 0 байж болохгүй.",
    path: ["price"],
  })
  // Үндсэн үнээс дээгүүр «хямдрал» гэдэг нь хямдрал биш — DB-ийн check-тэй
  // ижил дүрэм, зөвхөн эндээс ойлгомжтой алдаа буцаана.
  .refine((v) => v.salePrice == null || v.salePrice <= v.price, {
    message: "Хямдарсан үнэ үндсэн үнээс их байж болохгүй.",
    path: ["salePrice"],
  });

/**
 * The same rule as a plain predicate, for the forms: the client blocks the
 * save and points at the offending row instead of posting and reading back a
 * server error the operator has to translate.
 */
export function unpricedActiveSizes(
  variants: { ml: number; price: number; active: boolean }[],
): number[] {
  return variants.filter((v) => v.active && v.price <= 0).map((v) => v.ml);
}

export const productInputSchema = z.object({
  name: z.string().min(1),
  brand: z.string().min(1),
  gender: z.enum(["male", "female", "unisex"]),
  concentration: z.enum(["EDP", "EDT", "Parfum", "EDC", "Extrait", "Elixir"]),
  // Families are admin-managed slugs (scent_families table), so they are
  // validated against the live taxonomy in the route, not by a closed enum.
  scentFamilies: z.array(z.string().min(1)).default([]),
  seasons: seasonList.default([]),
  notesTop: z.array(z.string()).default([]),
  notesHeart: z.array(z.string()).default([]),
  notesBase: z.array(z.string()).default([]),
  // Four-part description (0022); each part is optional on its own.
  description: z.string().default(""),
  notesDescription: z.string().default(""),
  usageDescription: z.string().default(""),
  shortDescription: z.string().default(""),
  // Images uploaded before the product row existed, in gallery order — this is
  // the storefront gallery, nothing else.
  images: z.array(productImageSchema).max(12).default([]),
  /**
   * The bottle photo the AI works from (`products.reference_image_url`). It is
   * its own field rather than "the first gallery image": the reference is never
   * shown to customers, and a product can perfectly well have both a real
   * gallery and a reference to regenerate from later.
   */
  referenceUrl: z.string().url().max(2048).nullable().default(null),
  /** Enqueue a generation on save. Needs `referenceUrl` to do anything (§2). */
  generateImage: z.boolean().default(false),
  originCountry: z.string().optional(),
  releaseYear: z.number().int().nullable().optional(),
  onHandMl: z.number().int().nonnegative(),
  lowStockMl: z.number().int().nonnegative(),
  bottlePrice: z.number().int().nonnegative(),
  bottleMl: z.number().int().positive(),
  variants: z.array(variantDraftSchema).min(1),
  tags: z.array(z.enum(["new", "hot", "sale"])).default([]),
  isActive: z.boolean().default(true),
  /** «Онцлох бараа» — нүүрийн онцлох хэсэгт автоматаар орно (0055). */
  isFeatured: z.boolean().default(false),
  /** Free-form internal tags (slugs from the admin pool, 0035_custom_tags). */
  customTags: z.array(z.string().min(1)).default([]),
});

export type ProductInput = z.infer<typeof productInputSchema>;

/** Partial update for an existing product (admin A2 edit). */
export const productEditSchema = z.object({
  name: z.string().min(1).optional(),
  brand: z.string().min(1).optional(),
  gender: z.enum(["male", "female", "unisex"]).optional(),
  concentration: z
    .enum(["EDP", "EDT", "Parfum", "EDC", "Extrait", "Elixir"])
    .optional(),
  scentFamilies: z.array(z.string().min(1)).optional(),
  seasons: seasonList.optional(),
  notesTop: z.array(z.string()).optional(),
  notesHeart: z.array(z.string()).optional(),
  notesBase: z.array(z.string()).optional(),
  description: z.string().optional(),
  notesDescription: z.string().optional(),
  usageDescription: z.string().optional(),
  shortDescription: z.string().optional(),
  originCountry: z.string().nullable().optional(),
  releaseYear: z.number().int().nullable().optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  tags: z.array(z.enum(["new", "hot", "sale"])).optional(),
  bottlePrice: z.number().int().nonnegative().optional(),
  bottleMl: z.number().int().positive().optional(),
  lowStockMl: z.number().int().nonnegative().optional(),
  /** Per-size edits — `ml` identifies the existing variant to reprice. */
  variants: z.array(variantDraftSchema).optional(),
  customTags: z.array(z.string().min(1)).optional(),
});

export type ProductEditInput = z.infer<typeof productEditSchema>;
