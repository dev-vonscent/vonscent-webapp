import {
  BOTTLE_STYLES,
  BOTTLE_STYLE_LABEL,
  type BottleStyle,
} from "@/lib/constants";

/**
 * Галерейн савны зураг уу — `addBottleImage` эх хувийг
 * `products/<slug>/bottle-<uuid>.webp` нэрээр хуулдаг.
 */
export function isBottleImageUrl(url: string): boolean {
  return /\/bottle-[0-9a-f-]+\.webp(\?|$)/i.test(url);
}

/**
 * Галерейд одоо байгаа савны зургийн өнгө. Бараанд өнгө нь хадгалагддаггүй
 * тул alt (`BOTTLE_STYLE_LABEL`)-аас уншина; савны зураг байгаа ч alt-ыг нь
 * зассан бол `"unknown"`.
 */
export function currentBottleStyle(
  images: { url: string; alt: string }[],
): BottleStyle | "unknown" | null {
  const bottle = images.find((img) => isBottleImageUrl(img.url));
  if (!bottle) return null;
  return (
    BOTTLE_STYLES.find((s) => BOTTLE_STYLE_LABEL[s] === bottle.alt.trim()) ??
    "unknown"
  );
}
