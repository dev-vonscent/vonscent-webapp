import { z } from "zod";

/** The store's whole size list — see ML_SIZES / 0026_sample_tier.sql. */
const mlSize = z.union([
  z.literal(2),
  z.literal(5),
  z.literal(10),
  z.literal(20),
]);

/**
 * A per-size discount override (0051). Only the sizes the admin actually
 * overrode are sent; anything missing is charged `discountPct`, so an empty
 * array is a bundle priced the old, uniform way.
 */
export const mlDiscountSchema = z
  .object({
    ml: mlSize,
    /** Хувь. Тогтмол үнэ өгсөн үед хэрэггүй тул сонголттой (0054). */
    discountPct: z.number().min(0).max(100).nullable().default(null),
    /**
     * Тухайн хэмжээний ТОГТМОЛ үнэ (0054, B6). Байвал эцсийн үнэ нь энэ —
     * гишүүдийн үнэ өөрчлөгдсөн ч багцын үнэ хөдлөхгүй.
     */
    price: z.number().int().nonnegative().nullable().default(null),
  })
  // Хоосон мөр хадгалах нь утгагүй (DB-ийн check-тэй ижил дүрэм).
  .refine((r) => r.discountPct != null || r.price != null, {
    message: "Хувь эсвэл тогтмол үнийн аль нэгийг оруулна уу.",
  });

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
  /** Per-size overrides; a size may appear at most once. */
  mlDiscounts: z
    .array(mlDiscountSchema)
    .default([])
    .refine(
      (rows) => new Set(rows.map((r) => r.ml)).size === rows.length,
      "Хэмжээ давхардсан",
    ),
  imageUrl: z.string().url().nullable().optional(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  /** Customer-facing badges, the same trio products use (0003). */
  tags: z.array(z.enum(["new", "hot", "sale"])).default([]),
  /** Free-form internal tags (slugs from the admin pool, 0035_custom_tags). */
  customTags: z.array(z.string().min(1)).default([]),
  productIds: z
    .array(z.string().min(1))
    .length(4, "Яг 4 үнэртэн сонгоно уу")
    .refine((ids) => new Set(ids).size === ids.length, "Бараа давхардсан"),
});

export const collectionUpdateSchema = collectionCreateSchema.partial();

export type CollectionCreateInput = z.infer<typeof collectionCreateSchema>;
export type CollectionUpdateInput = z.infer<typeof collectionUpdateSchema>;
