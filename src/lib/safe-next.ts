/**
 * `?next=` параметрийг зөвхөн өөрийн сайтын зам болгож цэвэрлэнэ.
 *
 * `router.push(next)` ба `new URL(next, origin)` хоёулаа үнэмлэхүй URL
 * (`https://…`) болон протоколгүй хост (`//evil.com`, `/\evil.com`) өгвөл
 * сайтаас гарна — нэвтрэх хуудас нь фишинг холбоосны «найдвартай» дамжлага
 * болно. Тиймээс `/`-ээр эхэлсэн, хоёр дахь тэмдэгт нь `/` эсвэл `\` биш
 * утгыг л зөвшөөрнө.
 */
export function safeNext(
  raw: string | null | undefined,
  fallback = "/",
): string {
  if (!raw) return fallback;
  const value = raw.trim();
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  // Удирдах тэмдэгт (tab, newline) хөтөч дээр зам хэсгийг хуурч чадна.
  if (/[\u0000-\u001f]/u.test(value)) return fallback;
  return value;
}
