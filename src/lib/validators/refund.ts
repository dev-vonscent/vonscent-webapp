import { z } from "zod";
import { MN_BANKS } from "@/lib/constants";

/**
 * Буцаалтын данс — төлсөн захиалгыг хэрэглэгч цуцлахад (клиент, 2026-09-30).
 * Клиент ба сервер хоёулаа энэ schema-аар шалгана.
 *
 * Дансны дугаар: зай, зураасыг хасаад 8–18 оронтой дугаар, эсвэл IBAN
 * (`MN` + 18 орон). Банк бүр өөр урттай тул нарийн дүрэм тавихгүй —
 * админ шилжүүлэхдээ нэрээр нь давхар шалгана.
 */
export const refundAccountSchema = z.object({
  bank: z.enum(MN_BANKS, {
    errorMap: () => ({ message: "Банкаа сонгоно уу" }),
  }),
  accountNumber: z
    .string()
    .transform((v) => v.replace(/[\s-]/g, "").toUpperCase())
    .pipe(
      z
        .string()
        .regex(
          /^(MN\d{18}|\d{8,18})$/u,
          "Дансны дугаараа зөв оруулна уу (8–18 орон, эсвэл MN-ээр эхэлсэн IBAN)",
        ),
    ),
  holderName: z
    .string()
    .trim()
    .min(2, "Данс эзэмшигчийн нэрээ оруулна уу")
    .max(100, "Нэр хэт урт байна"),
});

export type RefundAccountInput = z.input<typeof refundAccountSchema>;
export type RefundAccount = z.output<typeof refundAccountSchema>;

/** Цуцлах хүсэлтийн бие — төлөөгүй захиалгад данс шаардлагагүй. */
export const cancelOrderSchema = z.object({
  refundAccount: refundAccountSchema.optional(),
});
