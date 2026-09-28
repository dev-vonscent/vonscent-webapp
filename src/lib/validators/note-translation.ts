import { z } from "zod";

/**
 * Нотын англи нэр (0102_note_translations.sql) — барааны засах хуудасны
 * «Англи нэргүй нот» самбараас хэд хэдэн нотыг нэг дор хадгална.
 *
 * Хийсвэр биш нот англи нэртэй байх ёстой (DB-ийн check-тэй ижил).
 */
export const noteTranslationItemSchema = z
  .object({
    mn: z.string().trim().min(1).max(80),
    en: z
      .string()
      .trim()
      .max(80)
      .transform((s) => s.replace(/\s+/g, " "))
      .default(""),
    isAbstract: z.boolean().default(false),
  })
  .refine((v) => v.isAbstract || v.en.length > 0, {
    message: "Англи нэр эсвэл «Дүрслэх боломжгүй» сонголт шаардлагатай.",
    path: ["en"],
  });

export const noteTranslationsSaveSchema = z.object({
  items: z.array(noteTranslationItemSchema).min(1).max(50),
});
