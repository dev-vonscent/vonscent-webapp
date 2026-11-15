/**
 * Хүргэлтгүй өдрүүд — админ өөрөө хүргэлт хийж чадахгүй өдрүүдээ (дотоод
 * ажил, амралт) тэмдэглэнэ. Checkout дээр тэр өдрүүд идэвхгүй болж
 * «Дотоод ажилтай» гэж харагдана, сервер ч тэр өдөр рүү захиалга авахгүй.
 *
 * `settings.deliveryBlackout = { days: ["yyyy-MM-dd", …] }` (УБ-ын хуанлийн
 * өдөр). Тусдаа хүснэгт биш settings мөр — migration шаардахгүй, мөр байхгүй
 * бол ямар ч өдөр хаагдаагүй гэсэн үг (хуучин зан төлөв хэвээр).
 */

import { z } from "zod";

export const DELIVERY_BLACKOUT_KEY = "deliveryBlackout";

/** Checkout дээр хаагдсан өдрийн хажууд гарах тайлбар. */
export const DELIVERY_BLACKOUT_LABEL = "Дотоод ажилтай";

/** Админы хуанли хэдэн өдөр урагш харуулах вэ. */
export const DELIVERY_BLACKOUT_ADMIN_DAYS = 60;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** "2026-02-30" гэх мэт байхгүй өдрийг ч таслана. */
function isRealDay(day: string): boolean {
  if (!DAY_RE.test(day)) return false;
  const d = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === day;
}

export const deliveryBlackoutSchema = z.object({
  days: z.array(z.string().refine(isRealDay, "Өдөр буруу байна")).max(400),
});

/**
 * Хадгалагдсан утгыг цэвэр, давхардалгүй, эрэмбэлэгдсэн жагсаалт болгоно.
 * Буруу хэлбэртэй мөр checkout-ийг унагах ёсгүй — зүгээр л хоосон болно.
 */
export function normalizeBlackout(raw: unknown): string[] {
  const days = (raw as { days?: unknown } | null)?.days;
  if (!Array.isArray(days)) return [];
  return [
    ...new Set(
      days.filter((d): d is string => typeof d === "string" && isRealDay(d)),
    ),
  ].sort();
}

/** `days`-аас хаагдаагүй эхний өдөр, бүгд хаагдсан бол null. */
export function firstOpenDay(
  days: readonly string[],
  blocked: ReadonlySet<string>,
): string | null {
  return days.find((d) => !blocked.has(d)) ?? null;
}
