import type { PopupSlide } from "@/features/content/api";

/**
 * Сурталчилгааны popup-ын давтамж (2026-11-07): табын session-д нэг удаа.
 * Reload, сайт дотроос нүүр рүү буцах нь дахин гаргахгүй; таб хааж дахин
 * орвол, эсвэл админ өөр зар тавьбал (слайдын гарын үсэг өөрчлөгдөнө) дахин
 * гарна. Хаасны дараа нүүрэнд teaser товч үлдэж, хүссэн үедээ нээнэ.
 *
 * sessionStorage нь private горим / хаалттай сайтын өгөгдөлд шидэгдэж болно —
 * тэр үед «хараагүй» гэж үзнэ (popup ердийнхөөрөө гарна).
 */
const SEEN_KEY = "vs:promo-popup:seen";
const TEASER_KEY = "vs:promo-popup:teaser-hidden";

/** Одоо харагдах слайдуудын гарын үсэг — зар солигдвол өөр болно. */
export function popupSignature(slides: PopupSlide[]): string {
  return slides.map((s) => `${s.imageUrl}|${s.href}`).join("\n");
}

function read(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Хадгалж чадахгүй бол reload бүрд гарна — ноцтой биш.
  }
}

export function wasPopupSeen(signature: string): boolean {
  return read(SEEN_KEY) === signature;
}

export function markPopupSeen(signature: string) {
  write(SEEN_KEY, signature);
}

/** Teaser-ийг × дарж нуусан эсэх (энэ зарын хувьд, энэ session-д). */
export function isTeaserHidden(signature: string): boolean {
  return read(TEASER_KEY) === signature;
}

export function hideTeaser(signature: string) {
  write(TEASER_KEY, signature);
}
