import { z } from "zod";

export const orderItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1),
  ml: z.number().int().positive(),
  qty: z.number().int().positive().max(99),
});

export const checkoutSchema = z.object({
  contactName: z.string().min(2, "Нэрээ оруулна уу"),
  contactPhone: z
    .string()
    .regex(/^\d{8}$/u, "8 оронтой утасны дугаар оруулна уу"),
  contactEmail: z.string().email("Имэйл буруу байна").optional().or(z.literal("")),
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
  items: z.array(orderItemSchema).min(1, "Сагс хоосон байна"),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type OrderItemInput = z.infer<typeof orderItemSchema>;
