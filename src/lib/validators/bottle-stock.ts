import { z } from "zod";
import { GENDERS, ML_SIZES } from "@/lib/constants";

/**
 * Савны түгжээ (0095) — админы унтраалга.
 *
 * Хослол нь хаалттай жагсаалт: `gender_t` enum ба `ML_SIZES` хоёрын үржвэр.
 * DB талд check constraint давхар хамгаална.
 */
export const bottleStockUpdateSchema = z.object({
  gender: z.enum(GENDERS),
  ml: z
    .number()
    .int()
    .refine((v) => (ML_SIZES as readonly number[]).includes(v), {
      message: "Зарагддаггүй хэмжээ",
    }),
  isActive: z.boolean(),
  /** «9/28-нд ирнэ» — зөвхөн админд харагдах тэмдэглэл. */
  note: z.string().max(200).optional(),
  /**
   * Нээх үед өмнө нь чөлөөлсөн (`bottle_override`) мөрүүдийг цуцлах эсэх.
   * Хаалттай үед хийсэн онцгой зөвшөөрөл нь ТЭР хугацаанд хамаарах ёстой —
   * үлдээвэл дараагийн түгжээнд чимээгүй нэвчих эрсдэлтэй.
   */
  clearOverrides: z.boolean().optional(),
});

export type BottleStockUpdateInput = z.infer<typeof bottleStockUpdateSchema>;
