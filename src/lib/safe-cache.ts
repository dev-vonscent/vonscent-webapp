import "server-only";
import { unstable_cache } from "next/cache";

/**
 * `unstable_cache`, гэхдээ кэш `undefined` буцаавал функцийг шууд дуудна.
 *
 * Next 16-ийн `unstable_cache` нь Data Cache-ийн бичлэгийн `body` хоосон үед
 * JSON задлахын оронд `undefined` буцаадаг (`unstable-cache.js`). Массив
 * буцаах ёстой функц ингэж `undefined` өгөхөд `.filter` дээр унаж нүүр хуудасны
 * render бүхэлдээ алдаа болсон (Sentry JAVASCRIPT-NEXTJS-V/W, 2026-11-23..26).
 *
 * Хоосон утга (`[]`, `{}`) буцаахгүй: тэгвэл хямдралгүй хуудас ISR-д нэг цаг
 * үлдэнэ (#284). Шууд дуудлага алдаа шидвэл тэр нь хэвээр дээш явна.
 *
 * Тиймээс `fn` өөрөө `undefined` буцаах ёсгүй (`null` хэрэглэ).
 */
export function safeCache<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  keyParts: string[],
  options: { revalidate?: number | false; tags?: string[] },
): (...args: A) => Promise<R> {
  const cached = unstable_cache(fn, keyParts, options);
  return async (...args: A) => {
    const value = await cached(...args);
    return value === undefined ? fn(...args) : value;
  };
}
