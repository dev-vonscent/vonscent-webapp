import { z } from "zod";
import { ML_SIZES } from "@/lib/constants";
import { roundSalePrice } from "@/features/products/sale";

/** Олноор хямдрал тавихад хамгийн их хувь — DB-ийн `apply_bulk_sale`-тай ижил. */
export const BULK_SALE_MAX_PCT = 90;

const productIds = z.array(z.string().uuid()).min(1).max(2000);

/**
 * Админ → Хямдрал (0166): сонгосон бараануудад хэмжээ бүрийн хувь +
 * хугацаа. `pcts`-д байхгүй хэмжээнд хүрэхгүй.
 */
export const bulkSaleSchema = z
  .object({
    productIds,
    pcts: z
      .record(
        z.enum(ML_SIZES.map(String) as [string, ...string[]]),
        z.number().int().min(1).max(BULK_SALE_MAX_PCT),
      )
      .refine((p) => Object.keys(p).length > 0, {
        message: "Дор хаяж нэг хэмжээнд хувь оруулна уу.",
      }),
    startsAt: z.string().datetime({ offset: true }).nullable(),
    endsAt: z.string().datetime({ offset: true }),
  })
  .refine((v) => !v.startsAt || new Date(v.endsAt) > new Date(v.startsAt), {
    message: "Дуусах хугацаа эхлэхээс хойш байх ёстой.",
    path: ["endsAt"],
  });

export type BulkSaleInput = z.infer<typeof bulkSaleSchema>;

export const clearSaleSchema = z.object({ productIds });

/**
 * Хувиас хямдарсан үнэ — `apply_bulk_sale`-ийн толь (100₮-д тоймлоно,
 * үндсэн үнээс давахгүй). Админы урьдчилан харах мөрөнд.
 */
export function bulkSalePrice(price: number, pct: number): number {
  // price × (100 − pct) нь бүхэл тоо — нэг хуваалтаар float-ийн алдаагүй.
  return roundSalePrice((price * (100 - pct)) / 100, price);
}

/** Нэртэй хямдралын нэрийн дээд урт — DB `sales.name` check (0188). */
export const NAMED_SALE_NAME_MAX = 60;

const dayKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, "Огноо буруу байна.");

/**
 * Нэртэй хямдрал (0188, task 16.2–16.5) үүсгэх / засах. Өдрүүд нь УБ-ын
 * `YYYY-MM-DD` — сервер `dayStartIso` / `dayEndIso`-оор хил болгоно.
 * `adoptUnnamed` — «Нэргүй» бүлгийг нэрлэж шинэ хямдрал болгох (16.6).
 */
export const namedSaleSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Хямдралын нэр оруулна уу.")
      .max(NAMED_SALE_NAME_MAX, `Нэр ${NAMED_SALE_NAME_MAX} тэмдэгтээс ихгүй.`),
    pcts: bulkSaleSchema.innerType().shape.pcts,
    startsOn: dayKey.or(z.literal("")),
    endsOn: dayKey,
    productIds,
    adoptUnnamed: z.boolean().default(false),
  })
  .refine((v) => !v.startsOn || v.endsOn >= v.startsOn, {
    message: "Дуусах өдөр эхлэхээс өмнө байж болохгүй.",
    path: ["endsOn"],
  });

export type NamedSaleInput = z.infer<typeof namedSaleSchema>;
