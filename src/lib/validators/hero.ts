import { z } from "zod";
import { HERO_LIMITS as L } from "@/lib/constants";
import { isInternalPath } from "@/features/heroes/lib";
import { SALE_EVENT_SLUG_RE } from "./sale-event";

/** Товчны холбоос (0182 `hero_target_valid`-тай ижил). */
export const heroTargetSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("event"),
    slug: z.string().regex(SALE_EVENT_SLUG_RE, { message: "Арга хэмжээ сонгоно уу." }),
  }),
  z.object({
    type: z.literal("season"),
    value: z.enum(["spring", "summer", "autumn", "winter"]),
  }),
  z.object({
    type: z.literal("catalog"),
    query: z
      .string()
      .trim()
      .max(L.catalogQuery, { message: "Шүүлт хэт урт." })
      // `?`-гүй query string: `tags=new&gender=male`.
      .transform((q) => q.replace(/^\?/u, ""))
      .refine((q) => !/[\s#]/u.test(q), {
        message: "Шүүлтэд хоосон зай, # байж болохгүй.",
      }),
  }),
  z.object({
    type: z.literal("path"),
    href: z.string().trim().refine(isInternalPath, {
      message: "Зөвхөн сайтын дотоод хаяг (/-ээр эхэлсэн), жишээ: /gift-cards",
    }),
  }),
]);

const desktopImageSchema = z.object({
  base: z.string().url(),
  widths: z.array(z.number().int().positive()).min(1).max(5),
  height1600: z.number().int().positive(),
});

const mobileImageSchema = z.object({
  src: z.string().url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const dateKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, { message: "Огноо сонгоно уу." });

const label = (max: number, what: string) =>
  z
    .string()
    .trim()
    .min(1, { message: `${what} оруулна уу.` })
    .max(max, { message: `${what} ${max} тэмдэгтээс ихгүй.` });

/**
 * Hero үүсгэх / засах (Админ → Нүүрний hero, 0182). Хугацаа нь УБ-ийн өдөр
 * (route `dayStartIso`/`dayEndIso`); арга хэмжээтэй холбоотой бол хугацааг
 * тэндээс авна. Зураг нь upload route-ийн буцаасан URL-ууд.
 */
export const heroInputSchema = z
  .object({
    name: label(L.name, "Нэр"),
    saleEventId: z.string().uuid().nullable().default(null),
    startsOn: dateKey.nullable().default(null),
    endsOn: dateKey.nullable().default(null),
    priority: z.number().int().min(-100).max(100).default(0),
    isActive: z.boolean().default(false),
    eyebrow: z
      .string()
      .trim()
      .max(L.eyebrow, { message: `Жижиг гарчиг ${L.eyebrow} тэмдэгтээс ихгүй.` })
      .default(""),
    title: label(L.title, "Гарчиг"),
    description: z
      .string()
      .trim()
      .max(L.description, { message: `Тайлбар ${L.description} тэмдэгтээс ихгүй.` })
      .default(""),
    mobileDescription: z
      .string()
      .trim()
      .max(L.mobileDescription, {
        message: `Утасны тайлбар ${L.mobileDescription} тэмдэгтээс ихгүй.`,
      })
      .default(""),
    primaryLabel: label(L.buttonLabel, "Товчны бичиг"),
    primaryTarget: heroTargetSchema,
    secondaryLabel: z
      .string()
      .trim()
      .max(L.buttonLabel, { message: `Товчны бичиг ${L.buttonLabel} тэмдэгтээс ихгүй.` })
      .default(""),
    secondaryTarget: heroTargetSchema.nullable().default(null),
    desktopImage: desktopImageSchema.nullable().default(null),
    mobileImage: mobileImageSchema.nullable().default(null),
    imageAlt: z
      .string()
      .trim()
      .max(L.imageAlt, { message: `Зургийн тайлбар ${L.imageAlt} тэмдэгтээс ихгүй.` })
      .default(""),
    dark: z.boolean().default(false),
  })
  .refine((v) => v.saleEventId || (v.startsOn && v.endsOn), {
    message: "Хугацаа эсвэл арга хэмжээ сонгоно уу.",
    path: ["startsOn"],
  })
  .refine(
    (v) => v.saleEventId || !v.startsOn || !v.endsOn || v.endsOn >= v.startsOn,
    { message: "Дуусах өдөр эхлэхээс өмнө байж болохгүй.", path: ["endsOn"] },
  )
  .refine((v) => Boolean(v.secondaryLabel) === Boolean(v.secondaryTarget), {
    message: "Хоёр дахь товчны бичиг ба холбоосыг хамт бөглөнө үү.",
    path: ["secondaryLabel"],
  })
  .refine((v) => !v.isActive || (v.desktopImage && v.mobileImage), {
    message: "Нийтлэхийн өмнө desktop ба утасны зураг оруулна уу.",
    path: ["desktopImage"],
  });

export type HeroInput = z.infer<typeof heroInputSchema>;

export function heroFieldErrors(
  error: z.ZodError,
): Partial<Record<keyof HeroInput, string>> {
  const out: Partial<Record<keyof HeroInput, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as keyof HeroInput | undefined;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}
