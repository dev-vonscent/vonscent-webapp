import { z } from "zod";
import { ML_SIZES } from "@/lib/constants";

/**
 * «Дараа авахаар хадгалах» (0116) — сагсны мөрийн хуулбар.
 *
 * Эдгээр нь харуулах, сагсанд буцааж хийхэд л хэрэглэгдэнэ: үнэ, нэр нь
 * хуурамч байсан ч захиалга үүсэхдээ сервер бүгдийг variant id-аар дахин
 * уншина (`/api/orders`). Тиймээс хэлбэр, хэмжээг л барина.
 */
const id = z.string().min(1).max(100);
const text = z.string().max(300);
const ml = z
  .number()
  .int()
  .refine((n) => (ML_SIZES as readonly number[]).includes(n));
const price = z.number().int().min(0);
const qty = z.number().int().min(1).max(99);
const image = z.string().max(2000).nullable();

const itemSchema = z.object({
  key: id,
  productId: id,
  slug: text,
  name: text,
  brand: text,
  variantId: id,
  ml,
  unitPrice: price,
  qty,
  image,
});

const memberSchema = z.object({
  productId: id,
  variantId: id,
  slug: text,
  name: text,
  brand: text,
  image,
  price,
});

const collectionSchema = z.object({
  key: z.string().min(1).max(4000),
  collectionId: id.nullable(),
  type: z.enum(["base", "custom"]),
  slug: text,
  name: text,
  image,
  discountPct: z.number().min(0).max(100),
  ml,
  members: z.array(memberSchema).min(1).max(30),
  unitPrice: price,
  qty,
});

export const savedCheckoutInputSchema = z
  .object({
    buyNow: z.boolean(),
    items: z.array(itemSchema).max(50),
    collections: z.array(collectionSchema).max(20),
    // Checkout-ийн маягтын ноорог — checkout өөрөө талбар бүрийг шалгана
    // (захиалга илгээхэд `checkoutSchema`), энд зөвхөн хэмжээг хязгаарлана.
    draft: z.record(z.string(), z.unknown()),
  })
  .refine((v) => v.items.length + v.collections.length > 0, {
    message: "Хадгалах бараа алга",
  });

export type SavedCheckoutInput = z.infer<typeof savedCheckoutInputSchema>;

/** Биеийн дээд хэмжээ — ноорог чөлөөт хэлбэртэй тул JSON-ыг өөрийг нь хязгаарлана. */
export const SAVED_CHECKOUT_MAX_BYTES = 64 * 1024;
