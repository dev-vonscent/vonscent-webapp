import "server-only";

/**
 * Загварын дэвсгэр зургийг satori (`next/og`)-д өгөх data URL.
 *
 * Storage-д upload бүр WebP болж хадгалагддаг (process-image.ts), харин
 * satori WebP-ийг уншиж чаддаггүй — `<img src=…webp>` нь «u2 is not
 * iterable» гээд ImageResponse бүхэлдээ унадаг байв (захиалгын thumbnail,
 * имэйлийн картын зураг). Тиймээс sharp-аар яг хэрэгтэй хэмжээнд cover
 * тайраад JPEG болгоно (дэвсгэр тунгалаг биш). Унавал null — route
 * зураггүй хувилбараа зурна.
 */
const cache = new Map<string, Promise<string | null>>();
const MAX_CACHE = 64;

async function build(
  url: string,
  width: number,
  height: number,
): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return null;
    const sharp = (await import("sharp")).default;
    const jpg = await sharp(Buffer.from(await res.arrayBuffer()))
      .resize({ width, height, fit: "cover" })
      .jpeg({ quality: 86 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpg.toString("base64")}`;
  } catch {
    return null;
  }
}

export function designBackgroundDataUrl(
  url: string,
  width: number,
  height: number,
): Promise<string | null> {
  const key = `${url}|${width}x${height}`;
  let p = cache.get(key);
  if (!p) {
    if (cache.size >= MAX_CACHE) cache.clear();
    p = build(url, width, height);
    cache.set(key, p);
    void p.then((d) => d ?? cache.delete(key));
  }
  return p;
}
