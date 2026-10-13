import { z } from "zod";

/** Кампанит ажлын төрлүүд (0135 check). Шинэ төрөл энд ба SQL-д хамт нэмэгдэнэ. */
export const CAMPAIGN_TYPES = ["signup_coupon"] as const;
export type CampaignType = (typeof CAMPAIGN_TYPES)[number];

const dateKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, { message: "Огноо сонгоно уу." });

/**
 * Кампанит ажил үүсгэх / засах (админ). Мөнгөн дүн integer ₮.
 * Хугацаа нь UB-ийн өдрөөр: эхлэх өдрийн 00:00:00 — дуусах өдрийн 23:59:59.
 */
export const campaignInputSchema = z
  .object({
    type: z.enum(CAMPAIGN_TYPES).default("signup_coupon"),
    name: z
      .string()
      .trim()
      .min(1, { message: "Нэр оруулна уу." })
      .max(120, { message: "Нэр 120 тэмдэгтээс ихгүй." }),
    description: z
      .string()
      .trim()
      .max(500, { message: "Тайлбар 500 тэмдэгтээс ихгүй." })
      .default(""),
    isActive: z.boolean().default(false),
    startsOn: dateKey,
    endsOn: dateKey,
    couponValue: z
      .number({ message: "Купоны дүн оруулна уу." })
      .int({ message: "Бүхэл тоо оруулна уу." })
      .min(100, { message: "Купоны дүн 100₮-өөс багагүй." })
      .max(1_000_000, { message: "Купоны дүн 1,000,000₮-өөс ихгүй." }),
    minSubtotal: z
      .number({ message: "Доод дүн оруулна уу." })
      .int({ message: "Бүхэл тоо оруулна уу." })
      .min(0, { message: "Доод дүн 0-ээс багагүй." })
      .max(100_000_000),
    couponValidDays: z
      .number({ message: "Хоног оруулна уу." })
      .int({ message: "Бүхэл тоо оруулна уу." })
      .min(1, { message: "1–365 хоног." })
      .max(365, { message: "1–365 хоног." }),
  })
  .refine((c) => c.endsOn >= c.startsOn, {
    message: "Дуусах өдөр эхлэх өдрөөс өмнө байж болохгүй.",
    path: ["endsOn"],
  });

export type CampaignInput = z.infer<typeof campaignInputSchema>;

/** Зөвхөн асаах/унтраах — жагсаалтын унтраалга. */
export const campaignToggleSchema = z.object({ isActive: z.boolean() });

/** Маягтын талбар бүрийн эхний алдаа — `Field error`-д шууд. */
export function campaignFieldErrors(
  error: z.ZodError,
): Partial<Record<keyof CampaignInput, string>> {
  const out: Partial<Record<keyof CampaignInput, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as keyof CampaignInput | undefined;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}
