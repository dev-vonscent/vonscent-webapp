import { notFound } from "next/navigation";

/**
 * Дэлгүүрийн мэдэгдэхгүй зам бүр — жинхэнэ 404.
 *
 * `@footer/[...rest]` (footer-ийн slot) бүх замд таардаг тул `/[...rest]` гэсэн
 * маршрут үүсдэг: энэ хуудасгүй байхад мэдэгдэхгүй зам «олдсон» мэт 200
 * буцаж байв (soft 404). Энд `notFound()` дуудаж, `(shop)/not-found.tsx`
 * дэлгүүрийн header, доод навигацтайгаа гарна.
 *
 * Дээр нь `loading.tsx` байх ёсгүй: Suspense дотор шидэгдсэн `notFound()`
 * хариуны толгой (200) явсны дараа гардаг тул статус өөрчлөгдөхгүй. Нүүрний
 * `loading.tsx` тиймээс `(home)` бүлэгт байгаа.
 */
export default function UnknownShopPath() {
  notFound();
}
