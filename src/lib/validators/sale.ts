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
 * Хувиас хямдарсан үнэ — `apply_bulk_sale`-ийн толь (100₮-д дугуйрна,
 * үндсэн үнээс давахгүй). Админы урьдчилан харах мөрөнд.
 */
export function bulkSalePrice(price: number, pct: number): number {
  // price × (100 − pct) нь бүхэл тоо — нэг хуваалтаар float-ийн алдаагүй.
  return roundSalePrice((price * (100 - pct)) / 100, price);
}
