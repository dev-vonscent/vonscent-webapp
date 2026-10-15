import { z } from "zod";

/**
 * Шинэ үнэртний санал (0137) — хэрэглэгчийн форм ба `/api/perfume-requests`
 * хоёуланд нэг schema. Урт нь SQL-ийн check-тэй таарна.
 */
export const perfumeRequestInputSchema = z.object({
  brand: z
    .string()
    .trim()
    .min(1, "Брэндийн нэрийг бичнэ үү.")
    .max(80, "Брэндийн нэр 80 тэмдэгтээс ихгүй."),
  name: z
    .string()
    .trim()
    .min(1, "Үнэртний нэрийг бичнэ үү.")
    .max(120, "Үнэртний нэр 120 тэмдэгтээс ихгүй."),
  /** `concentrations.code`; хоосон = мэдэхгүй. */
  concentration: z.string().trim().max(40).default(""),
  note: z.string().trim().max(300, "Тайлбар 300 тэмдэгтээс ихгүй.").default(""),
});

export type PerfumeRequestInput = z.infer<typeof perfumeRequestInputSchema>;
/** Формын утга (default-ууд хэрэглэгдэхээс өмнө). */
export type PerfumeRequestFormValues = z.input<
  typeof perfumeRequestInputSchema
>;

/** Админ: давхардсан саналыг `targetId` руу нэгтгэх. */
export const perfumeRequestMergeSchema = z.object({
  targetId: z.string().uuid(),
});
