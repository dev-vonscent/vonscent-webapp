import type { PopupSettings, PopupSlide } from "@/features/content/api";

/** True when `now` falls within the slide's optional [startsAt, endsAt] window. */
export function isLive(slide: PopupSlide, now: number): boolean {
  if (slide.startsAt && now < new Date(slide.startsAt).getTime()) return false;
  if (slide.endsAt && now > new Date(slide.endsAt).getTime()) return false;
  return true;
}

/** Одоо харагдах слайдууд — зурагтай, хуваарьдаа багтсан. */
export function liveSlides(slides: PopupSlide[], now: number): PopupSlide[] {
  return slides.filter((s) => Boolean(s.imageUrl) && isLive(s, now));
}

/**
 * Popup нээгдэхэд эхэлж харагдах зураг (серверийн preload-д). ISR кэшийн
 * хугацаанд хуваарь өөрчлөгдвөл дэмий нэг preload болно — харагдах
 * слайдыг client өөрийн цагаар дахин шийднэ.
 */
export function firstPopupImage(settings: PopupSettings): string | null {
  if (!settings.enabled) return null;
  return liveSlides(settings.slides ?? [], Date.now())[0]?.imageUrl ?? null;
}
