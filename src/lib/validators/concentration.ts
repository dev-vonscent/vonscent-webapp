import { z } from "zod";
import {
  CONCENTRATION_CODE_MAX,
  CONCENTRATION_LABEL_MAX,
} from "@/lib/constants";

/**
 * Үнэртний төрөл (0085_concentrations.sql).
 *
 * `code` нь барааны хуудсанд шууд харагддаг текст тул slug болгож
 * хувиргахгүй — «Eau Fraiche» гэж бичсэн бол яг тэр хэвээрээ. Зөвхөн зай
 * цэвэрлэнэ: «EDP  » ба «EDP» хоёр өөр төрөл болох ёсгүй.
 */
const code = z
  .string()
  .trim()
  .min(1)
  .max(CONCENTRATION_CODE_MAX)
  .transform((s) => s.replace(/\s+/g, " "));

const label = z
  .string()
  .trim()
  .max(CONCENTRATION_LABEL_MAX)
  .transform((s) => s.replace(/\s+/g, " "));

export const concentrationCreateSchema = z.object({
  code,
  label: label.default(""),
});

/** Хэсэгчилсэн засвар — нэг талбар илгээхэд л хангалттай. */
export const concentrationPatchSchema = z
  .object({
    code: code.optional(),
    label: label.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "EMPTY_PATCH",
  });

export type ConcentrationCreateInput = z.infer<
  typeof concentrationCreateSchema
>;
