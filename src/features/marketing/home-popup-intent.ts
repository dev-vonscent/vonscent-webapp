/**
 * Сурталчилгааны popup сайт дотроос нүүр рүү орох үед ЗӨВХӨН лого эсвэл доод
 * цэсний «Нүүр» icon-оор орсон бол гарна (клиент, 2026-10-26). Барааны
 * хуудаснаас back дарж буцахад (нүүр байсан ч) гарахгүй. Refresh / анхны
 * нээлт нь энэ тэмдэглэгээнээс хамаарахгүй — `PromoPopup` өөрөө шийднэ.
 *
 * Модулийн хувьсагч: client navigation нь document-ийг солихгүй тул дарсан
 * мөчөөс нүүр mount болох хүртэл хадгалагдана.
 */

/** Дарснаас хойш хэр удаан хүчинтэй вэ — удаан ачаалалт ч багтана. */
const INTENT_TTL_MS = 10_000;

let markedAt = 0;

/**
 * Лого / «Нүүр» icon дээр дарсан. Нүүр дээрээ байхдаа дарвал хуудас дахин
 * mount болохгүй тул тэмдэглэхгүй — эс бөгөөс дараагийн back-д гарч ирнэ.
 */
export function markHomePopupIntent() {
  if (typeof window === "undefined" || window.location.pathname === "/") {
    return;
  }
  markedAt = Date.now();
}

/** Нүүр рүү лого / icon-оор орж ирсэн үү (уншихад арилгахгүй). */
export function hasHomePopupIntent(now = Date.now()): boolean {
  return markedAt > 0 && now - markedAt <= INTENT_TTL_MS;
}

export function clearHomePopupIntent() {
  markedAt = 0;
}
