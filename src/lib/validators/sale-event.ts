import { z } from "zod";
import {
  ML_SIZES,
  SALE_EVENT_LIMITS as L,
  SALE_EVENT_MAX_PCT,
} from "@/lib/constants";

/** URL-ийн slug (`/sale/[slug]`, `?event=`) — 0181 check-тэй ижил. */
export const SALE_EVENT_SLUG_RE = /^[a-z0-9-]{2,60}$/u;

const dateKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, { message: "Огноо сонгоно уу." });

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { message: `${label} ${max} тэмдэгтээс ихгүй.` })
    .default("");

/** Нэг барааны хэмжээ бүрийн хувь. Хоосон = хувьгүй гишүүн («сонголт»). */
export const saleEventItemSchema = z.object({
  productId: z.string().uuid(),
  pcts: z
    .record(
      z.enum(ML_SIZES.map(String) as [string, ...string[]]),
      z
        .number()
        .int({ message: "Хувь бүхэл тоо байна." })
        .min(1, { message: `Хувь 1–${SALE_EVENT_MAX_PCT}%.` })
        .max(SALE_EVENT_MAX_PCT, { message: `Хувь 1–${SALE_EVENT_MAX_PCT}%.` }),
    )
    .default({}),
});

export type SaleEventItem = z.infer<typeof saleEventItemSchema>;

/**
 * Арга хэмжээ үүсгэх / засах (Админ → Арга хэмжээ, 0181). Хугацаа нь УБ-ийн
 * өдрөөр: эхлэх өдрийн 00:00 — дуусах өдрийн төгсгөл (route `dayStartIso` /
 * `dayEndIso`-оор хувиргана; `ends_at` exclusive). Гишүүд бүрэн солигдоно.
 */
export const saleEventInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { message: "Нэр оруулна уу." })
      .max(L.name, { message: `Нэр ${L.name} тэмдэгтээс ихгүй.` }),
    slug: z
      .string()
      .trim()
      .regex(SALE_EVENT_SLUG_RE, {
        message: `Хаяг ${L.slugMin}–${L.slugMax} тэмдэгт: латин жижиг үсэг, тоо, зураас.`,
      }),
    badgeLabel: optionalText(L.badgeLabel, "Тэмдэг"),
    headline: optionalText(L.headline, "Гарчиг"),
    description: optionalText(L.description, "Тайлбар"),
    startsOn: dateKey,
    endsOn: dateKey,
    isActive: z.boolean().default(false),
    showCountdown: z.boolean().default(true),
    items: z
      .array(saleEventItemSchema)
      .max(L.products, { message: `Ихдээ ${L.products} бараа.` })
      .default([]),
  })
  .refine((v) => v.endsOn >= v.startsOn, {
    message: "Дуусах өдөр эхлэхээс өмнө байж болохгүй.",
    path: ["endsOn"],
  })
  .refine(
    (v) => new Set(v.items.map((i) => i.productId)).size === v.items.length,
    { message: "Нэг бараа хоёр удаа орсон байна.", path: ["items"] },
  )
  .refine((v) => !v.isActive || v.items.length > 0, {
    message: "Нийтлэхийн өмнө дор хаяж нэг бараа сонгоно уу.",
    path: ["items"],
  });

export type SaleEventInput = z.infer<typeof saleEventInputSchema>;

/** Маягтын талбар бүрийн эхний алдаа. */
export function saleEventFieldErrors(
  error: z.ZodError,
): Partial<Record<keyof SaleEventInput, string>> {
  const out: Partial<Record<keyof SaleEventInput, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as keyof SaleEventInput | undefined;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

/** Каталогийн `?event=` утга — slug хэлбэртэй л бол (бусад нь үл тоомсорлоно). */
export function parseEventSlug(raw: unknown): string | undefined {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return typeof v === "string" && SALE_EVENT_SLUG_RE.test(v) ? v : undefined;
}
