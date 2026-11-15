import { z } from "zod";
import { HERO_LIMITS as L, HERO_SEASONS } from "@/lib/constants";
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

/** 'MM-DD', жил бүр байдаг өдөр (0185 `heroes_season_start_md_valid`). */
export const SEASON_START_MD_RE =
  /^((01|03|05|07|08|10|12)-(0[1-9]|[12][0-9]|3[01])|(04|06|09|11)-(0[1-9]|[12][0-9]|30)|02-(0[1-9]|1[0-9]|2[0-8]))$/u;

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
    season: z.enum(HERO_SEASONS).nullable().default(null),
    seasonStartMd: z
      .string()
      .regex(SEASON_START_MD_RE, { message: "Эхлэх өдөр буруу (2/29 болохгүй)." })
      .nullable()
      .default(null),
    productIds: z.array(z.string().uuid()).max(3, { message: "Үнэртэн ихдээ 3." }).default([]),
  })
  .refine((v) => v.saleEventId || v.season || (v.startsOn && v.endsOn), {
    message: "Хугацаа, арга хэмжээ, улирлын аль нэгийг сонгоно уу.",
    path: ["startsOn"],
  })
  .refine((v) => !v.season === !v.seasonStartMd, {
    message: "Улирлын эхлэх өдрийг сонгоно уу.",
    path: ["seasonStartMd"],
  })
  .refine((v) => !v.season || (!v.saleEventId && !v.startsOn && !v.endsOn), {
    message: "Улирлын баннер огноо, арга хэмжээгүй.",
    path: ["season"],
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
