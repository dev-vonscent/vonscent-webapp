import { ubToday } from "@/lib/time";

/**
 * Тогтмол seed-тэй PRNG (FNV-1a hash → mulberry32): ижил `seed` үргэлж ижил
 * дараалал өгнө. `Math.random`-ийн оронд `rail.ts`-ийн `random` параметрт
 * дамжуулна.
 */
export function seededRandom(seed: string): () => number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Улаанбаатарын өдрөөр солигддог «санамсаргүй» — нүүрний rail-ийн холилт.
 *
 * Сервер дээр `Math.random` хэрэглэвэл ISR-ийн дахин үүсгэлт бүр өөр HTML
 * гаргаж, Vercel бүтэн хуудсыг кэшэд дахин бичдэг (ISR Writes). Өдрийн
 * seed-ээр бол өгөгдөл өөрчлөгдөөгүй л бол гаралт ижил, холилт өдөрт нэг
 * удаа солигдоно. `salt` нь rail бүрийг өөр өөрөөр холино — эс бөгөөс
 * «Эрэлттэй», «Шинээр ирсэн» хоёрын багц ижил байранд бууна.
 */
export function dailyRandom(
  salt: string,
  now: Date = new Date(),
): () => number {
  return seededRandom(`${ubToday(now)}:${salt}`);
}
