import { z } from "zod";

export const orderItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1),
  ml: z.number().int().positive(),
  qty: z.number().int().positive().max(99),
});

/** A bundle line from the cart — the server re-prices it authoritatively. */
export const collectionOrderSchema = z.object({
  collectionId: z.string().nullable().default(null),
  type: z.enum(["base", "custom"]),
  ml: z.number().int().positive(),
  qty: z.number().int().positive().max(99),
  memberVariantIds: z.array(z.string().min(1)).min(1),
  giftProductId: z.string().nullable().default(null),
});

export const checkoutSchema = z.object({
  contactName: z.string().min(2, "Нэрээ оруулна уу"),
  contactPhone: z
    .string()
    .regex(/^\d{8}$/u, "8 оронтой утасны дугаар оруулна уу"),
  contactEmail: z
    .string()
    .email("Имэйл буруу байна")
    .optional()
    .or(z.literal("")),
  // Both are picked from the аймаг → сум/дүүрэг cascade, so both are required;
  // the values are Cyrillic names (the DB columns are plain text).
  shipCity: z.string().min(1, "Хот / аймгаа сонгоно уу"),
  shipDistrict: z.string().min(1, "Сум / дүүргээ сонгоно уу"),
  shipDetail: z.string().min(3, "Хаягаа дэлгэрэнгүй оруулна уу"),
  // Capital only, and folded into shipDetail for storage — kept as its own
  // field so the server can derive the delivery zone from it (todo.md B5b).
  shipKhoroo: z.number().int().positive().nullable().default(null),
  shipZone: z.string().min(1, "Хүргэлтийн бүс сонгоно уу"),
  paymentMethod: z.enum(["qpay", "bank_transfer"]),
  note: z.string().max(500).optional(),
  couponCode: z.string().optional(),
  loyaltyUsed: z.number().int().nonnegative().default(0),
  saveAddress: z.boolean().default(false),
  // Either loose items or bundles may be empty; the server rejects a truly
  // empty cart after pricing (EMPTY_CART).
  items: z.array(orderItemSchema).default([]),
  collections: z.array(collectionOrderSchema).default([]),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type OrderItemInput = z.infer<typeof orderItemSchema>;
export type CollectionOrderInput = z.infer<typeof collectionOrderSchema>;
