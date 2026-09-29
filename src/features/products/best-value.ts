/**
 * «Хамгийн ашигтай» тэмдэг очих хэмжээ — хамгийн бага ₮/ml.
 *
 * Нөөцөөс ҮЛ ХАМААРНА (клиент, 2026-09 UG): урьд нь зөвхөн нөөцтэй хэмжээнээс
 * сонгодог байсан тул 20ml дуусахад тэмдэг 10ml руу үсэрч, «10ml нь хамгийн
 * ашигтай» гэж худал хэлдэг байв. Тэмдэг бол хэмжээний шинж, үлдэгдлийн биш.
 *
 * Дуудагч нь ЗАРАХ хэмжээнүүдийг л дамжуулна (админы «Зарахгүй»-г хасаад) —
 * үнэгүй мөрийг энд алгасна. Харьцуулах зүйлгүй (нэг л хэмжээ) үед null.
 * Тэнцвэл том хэмжээ нь — ижил ₮/ml-д илүү их үнэртэн.
 *
 * `ml` нь нийт ml: багцад `ml × гишүүдийн тоо` (collection-detail.tsx).
 */
export function bestValueOf<T extends { ml: number; price: number }>(
  sizes: readonly T[],
): T | null {
  const priced = sizes.filter((s) => s.price > 0 && s.ml > 0);
  if (priced.length < 2) return null;
  return priced.reduce((best, s) => {
    const a = best.price / best.ml;
    const b = s.price / s.ml;
    return b < a || (b === a && s.ml > best.ml) ? s : best;
  });
}
