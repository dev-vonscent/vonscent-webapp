import { z } from "zod";
import {
  GIFT_CARD_AMOUNTS,
  GIFT_CARD_LIMITS,
  type GiftCardAmount,
} from "@/lib/constants";

/**
 * Бэлгийн карт (0179, gift-cards-plan §2.1). Client form (zodResolver) ба
 * `/api/gift-cards/orders` хоёулаа энийг ашиглана; DB-ийн check нь гурав дахь
 * давхарга.
 *
 * `delivery`:
 *   email → хүлээн авагчийн имэйл рүү төлбөр орсон даруйд
 *   self  → код зөвхөн худалдан авагчийн бүртгэлд (холбоос хуулах, зураг)
 */
export const GIFT_CARD_DELIVERY = ["email", "self"] as const;
export type GiftCardDelivery = (typeof GIFT_CARD_DELIVERY)[number];

export const giftCardPurchaseSchema = z
  .object({
    amount: z
      .number({ invalid_type_error: "Дүнгээ сонгоно уу." })
      .int()
      .refine((v) => GIFT_CARD_AMOUNTS.includes(v as GiftCardAmount), {
        message: "Дүнгээ сонгоно уу.",
      }),
    designId: z
      .string()
      .regex(/^[a-z0-9-]{2,40}$/u, "Картын загвараа сонгоно уу."),
    recipientName: z
      .string()
      .trim()
      .min(1, "Хүлээн авагчийн нэрийг бичнэ үү.")
      .max(
        GIFT_CARD_LIMITS.recipientName,
        `Нэр ${GIFT_CARD_LIMITS.recipientName} тэмдэгтээс хэтрэхгүй.`,
      ),
    message: z
      .string()
      .trim()
      .max(
        GIFT_CARD_LIMITS.message,
        `Мэндчилгээ ${GIFT_CARD_LIMITS.message} тэмдэгтээс хэтрэхгүй.`,
      ),
    fromName: z
      .string()
      .trim()
      .min(1, "Хэнээс гэдгийг бичнэ үү.")
      .max(
        GIFT_CARD_LIMITS.fromName,
        `Нэр ${GIFT_CARD_LIMITS.fromName} тэмдэгтээс хэтрэхгүй.`,
      ),
    delivery: z.enum(GIFT_CARD_DELIVERY),
    recipientEmail: z.string().trim().max(254),
    /** Идемпотентын түлхүүр — давхар дарахад нэг л захиалга (0087). */
    requestId: z.string().uuid().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.delivery !== "email") return;
    if (!v.recipientEmail) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recipientEmail"],
        message: "Хүлээн авагчийн имэйлийг бичнэ үү.",
      });
    } else if (!z.string().email().safeParse(v.recipientEmail).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recipientEmail"],
        message: "Имэйл хаяг буруу байна.",
      });
    }
  });

export type GiftCardPurchaseInput = z.infer<typeof giftCardPurchaseSchema>;

/**
 * Оноо болгох: холбоосын `token` эсвэл гараар бичсэн `code`-ийн аль нэг.
 * Кодыг жижиг үсэг, зай, зураастай бичсэн ч SQL өөрөө цэвэрлэнэ.
 */
export const giftCardRedeemSchema = z
  .object({
    code: z.string().trim().max(32).optional(),
    token: z
      .string()
      .regex(/^[0-9a-f]{32}$/u)
      .optional(),
  })
  .refine((v) => Boolean(v.token || v.code), {
    message: "Бэлгийн кодоо бичнэ үү.",
    path: ["code"],
  });

export type GiftCardRedeemInput = z.infer<typeof giftCardRedeemSchema>;
