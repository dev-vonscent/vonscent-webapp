import { z } from "zod";

/** Shared by the contact API route and the client form (zodResolver). */
export const contactInputSchema = z.object({
  name: z.string().min(2, "Нэрээ бичнэ үү (2+ үсэг)."),
  email: z.string().email("Имэйл хаяг буруу байна."),
  message: z
    .string()
    .min(5, "Мессежээ дэлгэрэнгүй бичнэ үү (5+ тэмдэгт).")
    .max(4000, "Мессеж хэт урт байна (дээд тал нь 4000 тэмдэгт)."),
});

export type ContactInput = z.infer<typeof contactInputSchema>;
