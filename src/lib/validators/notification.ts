import { z } from "zod";
import { NOTIFICATION_PAGE_SIZE } from "@/lib/constants";
import { safeNext } from "@/lib/safe-next";

/**
 * Мэдэгдлийн холбоос (0138). Хоёр л хэлбэр:
 *   • дотоод зам — `/`-ээр эхэлнэ, `//` (protocol-relative) хориотой
 *     (`safeNext`-ийн дүрэм);
 *   • гадаад `https://` — нэвтрэх мэдээлэл (`user:pass@`) хориотой.
 * Удирдах тэмдэгт (tab, newline) аль алинд нь хориотой. Бичдэг нь итгэмжлэгдсэн
 * staff тул hostname allowlist хийхгүй (plan §11).
 */
export function isSafeNotificationUrl(raw: string): boolean {
  if (!raw || raw !== raw.trim()) return false;
  if (/[\u0000-\u001f\u007f]/u.test(raw)) return false;
  if (raw.startsWith("/")) return safeNext(raw, "") === raw;
  if (!raw.toLowerCase().startsWith("https://")) return false;
  try {
    const url = new URL(raw);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      url.hostname.length > 0
    );
  } catch {
    return false;
  }
}

/** Дотоод зам мөн эсэх — дарахад `router.push`, үгүй бол шинэ tab. */
export function isInternalNotificationUrl(url: string): boolean {
  return url.startsWith("/") && !url.startsWith("//");
}

export const notificationUrlSchema = z
  .string()
  .max(500)
  .refine(isSafeNotificationUrl, {
    message: "Холбоос «/»-ээр эхэлсэн зам эсвэл https:// хаяг байх ёстой",
  });

/** `POST /api/notifications/read` — сонгосон мөрүүд эсвэл бүгдийг. */
export const notificationReadSchema = z.union([
  z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }).strict(),
  z.object({ all: z.literal(true) }).strict(),
]);

export type NotificationReadInput = z.infer<typeof notificationReadSchema>;

/** `GET /api/notifications` query. */
export const notificationFeedQuerySchema = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(NOTIFICATION_PAGE_SIZE),
});

// ── Админы broadcast (0138) ─────────────────────────────────────────────

/** `notification_kind_t`-ийн нийтийн хэсэг — админ зөвхөн эдгээрийг сонгоно. */
export const BROADCAST_KINDS = [
  "product_new",
  "promotion",
  "campaign",
  "feature",
  "announcement",
] as const;

export type BroadcastKind = (typeof BROADCAST_KINDS)[number];

export const BROADCAST_KIND_LABEL: Record<BroadcastKind, string> = {
  product_new: "Шинэ бараа",
  promotion: "Хямдрал",
  campaign: "Кампанит ажил",
  feature: "Шинэ боломж",
  announcement: "Мэдээлэл",
};

export const BROADCAST_TITLE_MAX = 80;
export const BROADCAST_BODY_MAX = 300;

/** Draft үүсгэх / засах. `imageUrl` нь манай Storage-ийн public URL (сервер path болгоно). */
export const broadcastInputSchema = z.object({
  kind: z.enum(BROADCAST_KINDS, { message: "Төрөл сонгоно уу" }),
  title: z
    .string()
    .trim()
    .min(1, "Гарчиг оруулна уу")
    .max(
      BROADCAST_TITLE_MAX,
      `Гарчиг ${BROADCAST_TITLE_MAX} тэмдэгтээс хэтрэхгүй`,
    ),
  body: z
    .string()
    .trim()
    .max(BROADCAST_BODY_MAX, `Текст ${BROADCAST_BODY_MAX} тэмдэгтээс хэтрэхгүй`)
    .default(""),
  url: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || isSafeNotificationUrl(v), {
      message: "Холбоос «/»-ээр эхэлсэн зам эсвэл https:// хаяг байх ёстой",
    })
    .default(""),
  imageUrl: z.string().url().max(1000).nullable().default(null),
});

export type BroadcastInput = z.infer<typeof broadcastInputSchema>;

export function broadcastFieldErrors(
  error: z.ZodError,
): Partial<Record<keyof BroadcastInput, string>> {
  const out: Partial<Record<keyof BroadcastInput, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as keyof BroadcastInput | undefined;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

/** Хуваарьт илгээлтийн дээд хязгаар — түүнээс хол бол андуурсан байх магадлалтай. */
export const BROADCAST_SCHEDULE_MAX_DAYS = 60;

/** `POST /api/admin/broadcasts/:id/send` — `publishAt` null = одоо. */
export const broadcastSendSchema = z.object({
  publishAt: z.string().datetime({ offset: true }).nullable().default(null),
});
