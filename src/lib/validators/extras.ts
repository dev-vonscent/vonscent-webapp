import { z } from "zod";
import { ubToday } from "@/lib/time";

/**
 * Нэмэлт бараа — админы маягт (extras-shop-plan §7). Client ба server хоёулаа
 * энэ схемээр шалгана; SQL (`extras_save`) нь горимын дүрмийг давхар барина.
 *
 * Горим бүр өөрийн хэлбэртэй (discriminated union) — энгийн бараанд тооны
 * талбар, грамын савд савны сонголт, үлдэгдэлтэй шилэнд эх үнэртэн.
 */

/** Үнийн дээд хязгаар — DB check-тэй ижил (0145). qty ≤ 99 → мөр int-д багтана. */
export const EXTRA_PRICE_MAX = 10_000_000;
/** Нэг бараанд хэдэн зураг — DB check (0145). */
export const EXTRA_IMAGES_MAX = 12;
export const EXTRA_NAME_MAX = 120;
export const EXTRA_LABEL_MAX = 60;
export const EXTRA_DESCRIPTION_MAX = 4000;
/** «Одоо байгаа тоо», нөөц нөхөх ширхэг — санамсаргүй 0 нэмэхээс (0153-тай ижил). */
export const EXTRA_STOCK_MAX = 100_000;
export const EXTRA_BATCH_CODE_MAX = 60;
export const EXTRA_SIZE_NOTE_MAX = 300;

const price = z
  .number({ invalid_type_error: "Үнэ оруулна уу" })
  .int("Бүхэл тоо оруулна уу")
  .min(0, "Үнэ сөрөг байж болохгүй")
  .max(EXTRA_PRICE_MAX, "Үнэ хэт өндөр байна");

const base = {
  name: z
    .string()
    .trim()
    .min(1, "Нэр оруулна уу")
    .max(EXTRA_NAME_MAX, `Нэр ${EXTRA_NAME_MAX} тэмдэгтээс хэтрэхгүй`),
  description: z.string().max(EXTRA_DESCRIPTION_MAX).default(""),
  images: z
    .array(z.string().url())
    .max(EXTRA_IMAGES_MAX, `Хамгийн ихдээ ${EXTRA_IMAGES_MAX} зураг`)
    .default([]),
  sort: z.number().int().min(-10000).max(10000).default(0),
};

export const localVariantSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().max(EXTRA_LABEL_MAX).default(""),
  price,
  isActive: z.boolean().default(true),
  sort: z.number().int().default(0),
  // Нөөц маягтаар орохгүй — хадгалсны дараа «Нөөц нөхөх»-өөр (purchase, 0153).
  /** Хоосон/бүтэн шилний batch code. */
  batchCode: z.string().trim().max(EXTRA_BATCH_CODE_MAX).optional(),
  imageUrl: z.string().url().or(z.literal("")).optional(),
  /** Чөлөөт хэмжээ/тохирох тайлбар — бэлгийн сав г.м. */
  sizeNote: z.string().trim().max(EXTRA_SIZE_NOTE_MAX).optional(),
});

export const vialVariantSchema = z.object({
  id: z.string().uuid().optional(),
  vialId: z.string().uuid(),
  price,
  isActive: z.boolean().default(true),
  sort: z.number().int().default(0),
});

const localSchema = z.object({
  mode: z.literal("local_quantity"),
  ...base,
  /** Хоосон/бүтэн шилний бүтэн хэмжээ («0/125ml») — зөвхөн дэлгэцийн утга. */
  bottleMl: z.number().int().min(1).max(1000).nullable().optional(),
  variants: z
    .array(localVariantSchema)
    .min(1, "Ядаж нэг хувилбар нэмнэ үү")
    .max(30)
    .superRefine((vs, ctx) => {
      const seen = new Set<string>();
      vs.forEach((v, i) => {
        const key = v.label.trim().toLowerCase();
        if (seen.has(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [i, "label"],
            message: "Ижил нэртэй хувилбар байна",
          });
        }
        seen.add(key);
      });
      // Олон хувилбартай бол нэр заавал — «Хар», «Цагаан»-ыг ялгах цорын
      // ганц зүйл.
      if (vs.length > 1) {
        vs.forEach((v, i) => {
          if (!v.label.trim()) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [i, "label"],
              message: "Хувилбарын нэр оруулна уу",
            });
          }
        });
      }
    }),
});

const vialSchema = z.object({
  mode: z.literal("shared_vial"),
  ...base,
  variants: z
    .array(vialVariantSchema)
    .min(1, "Ядаж нэг сав сонгоно уу")
    .max(12)
    .superRefine((vs, ctx) => {
      const seen = new Set<string>();
      vs.forEach((v, i) => {
        if (seen.has(v.vialId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [i, "vialId"],
            message: "Нэг савыг хоёр удаа сонгосон байна",
          });
        }
        seen.add(v.vialId);
      });
    }),
});

const leftoverSchema = z.object({
  mode: z.literal("leftover_liquid"),
  ...base,
  productId: z
    .string()
    .uuid({ message: "Аль үнэртний шил болохыг сонгоно уу" }),
  remainingMl: z
    .number({ invalid_type_error: "Үлдсэн хэмжээг оруулна уу" })
    .int("Бүхэл тоо оруулна уу")
    .min(1, "Үлдсэн хэмжээ 1ml-ээс их байна")
    .max(1000),
  fullMl: z
    .number({ invalid_type_error: "Бүтэн савны хэмжээг оруулна уу" })
    .int("Бүхэл тоо оруулна уу")
    .min(1)
    .max(1000),
  variantId: z.string().uuid().optional(),
  price,
});

// `discriminatedUnion` нь refine-тэй (ZodEffects) гишүүн хүлээж авдаггүй тул
// хоорондын шалгалт union-ий дээр.
export const extraSaveSchema = z
  .discriminatedUnion("mode", [localSchema, vialSchema, leftoverSchema])
  .superRefine((v, ctx) => {
    if (v.mode === "leftover_liquid" && v.remainingMl > v.fullMl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["remainingMl"],
        message: "Үлдсэн хэмжээ бүтэн савнаас их байж болохгүй",
      });
    }
  });

export type ExtraSaveInput = z.infer<typeof extraSaveSchema>;

/** Шинэ бараа — ангилал заавал. */
export const extraCreateSchema = z.object({
  categoryId: z.string().uuid(),
  extra: extraSaveSchema,
});

export const extraStatusSchema = z.object({
  status: z.enum(["draft", "published", "archived"]),
});

export const extraStockSchema = z.object({
  variantId: z.string().uuid(),
  onHand: z
    .number({ invalid_type_error: "Тоо оруулна уу" })
    .int("Бүхэл тоо оруулна уу")
    .min(0, "Тоо сөрөг байж болохгүй")
    .max(EXTRA_STOCK_MAX),
  /** Цонх нээгдэх үеийн `updated_at` — энэ хооронд өөрчлөгдсөн эсэхийг шалгана. */
  expectedUpdatedAt: z.string().min(1),
  note: z.string().trim().max(200).default(""),
});

/** Нэгж авсан үнийн дээд хязгаар — SQL `purchase_args_check`-тэй ижил (0153). */
export const PURCHASE_UNIT_COST_MAX = 10_000_000;

/**
 * Авсан өдөр: УБ-ын одоогийн сарын 1-нээс өнөөдөр хүртэл (0153
 * `purchase_date_check`). Өмнөх сар хаагдсан — тайлан хожим өөрчлөгдөхгүй.
 */
/** «Авсан өдөр»-ийн сонгож болох хүрээ: энэ сарын 1-нээс өнөөдөр хүртэл. */
export function purchaseDateBounds(today = ubToday()) {
  return { min: `${today.slice(0, 7)}-01`, max: today };
}

export function purchaseDateError(day: string, today = ubToday()) {
  const { min, max } = purchaseDateBounds(today);
  if (day > max) return "Авсан өдөр ирээдүйд байж болохгүй";
  if (day < min)
    return "Өнгөрсөн сарын тайлан хаагдсан тул энэ сарын өдөр оруулна уу";
  return null;
}

const purchaseBase = {
  qty: z
    .number({ invalid_type_error: "Ширхэг оруулна уу" })
    .int("Бүхэл тоо оруулна уу")
    .min(1, "Ядаж 1 ширхэг")
    .max(EXTRA_STOCK_MAX, "Ширхэг хэт их байна"),
  unitCost: z
    .number({ invalid_type_error: "Нэгж авсан үнэ оруулна уу" })
    .int("Бүхэл тоо оруулна уу")
    .min(0, "Үнэ сөрөг байж болохгүй")
    .max(PURCHASE_UNIT_COST_MAX, "Үнэ хэт өндөр байна"),
  purchasedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Авсан өдрөө сонгоно уу"),
  /** Цонх нээгдэх үеийн `updated_at` — null бол шалгахгүй. */
  expectedUpdatedAt: z.string().min(1).nullable(),
  note: z.string().trim().max(200).default(""),
};

function refineDate(v: { purchasedOn: string }, ctx: z.RefinementCtx) {
  const err = purchaseDateError(v.purchasedOn);
  if (err)
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["purchasedOn"],
      message: err,
    });
}

/** Нэмэлт барааны «Нөөц нөхөх» — худалдан авалт (0153 `extras_purchase`). */
export const extraPurchaseSchema = z
  .object({ variantId: z.string().uuid(), ...purchaseBase })
  .superRefine(refineDate);

/** Савны «Нөөц нөхөх» (0153 `vial_purchase`) — 1/2ml-ийг ч тоолно. */
export const vialPurchaseSchema = z
  .object({ vialId: z.string().uuid(), ...purchaseBase })
  .superRefine(refineDate);

/** URL-ийн slug — кирилл галиглаад латин үсэг, тоо, зураас. */
export function extraSlug(name: string, normalize: (s: string) => string) {
  return (
    normalize(name)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "extra"
  );
}
