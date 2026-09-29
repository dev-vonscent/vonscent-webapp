/**
 * Барааны галерейн autoplay-ийн сонголт (embla-carousel-autoplay 8.x).
 *
 * `stopOnInteraction` нь ЗААВАЛ false: plugin нь `mouseleave`, `pointerUp`,
 * `focusout`-ийг зөвхөн энэ false үед сонсдог. 2026-09-13-нд
 * `stopOnMouseEnter: true`-г `stopOnInteraction: true`-тэй хослуулснаар
 * хулгана нэг удаа дээгүүр өнгөрөх (утсан дээр товшилтын дуурайсан
 * mouseenter) л autoplay-г БҮРМӨСӨН зогсоодог болж, «зураг солигдохоо
 * больсон» алдаа гарсан (клиент, 2026-09 UG).
 *
 * Одоо hover, гар фокус, чирэх нь зөвхөн ТҮР зогсооно. Бүрмөсөн зогсоох нь
 * санаатай сонголт л — цэг / жижиг зураг дарах, томруулах (`pick`,
 * `openLightbox`) — WCAG 2.2.2-ын «зогсоох арга» тэр хэвээр.
 */
export const GALLERY_AUTOPLAY = {
  /** Client asked for a 3-5s rotation. */
  delay: 4000,
  stopOnInteraction: false,
  stopOnMouseEnter: true,
  stopOnFocusIn: true,
} as const;
