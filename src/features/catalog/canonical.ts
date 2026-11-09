type Params = Record<string, string | string[] | undefined>;

/**
 * Каталогийн canonical path.
 *
 * Шүүлтүүргүй, хүчинтэй 2+ хуудас (`?page=2` … сүүлчийнх) өөрийгөө заана —
 * Google бүх хуудсыг 1-р хуудас руу canonical болгохыг хориглодог: тэгвэл
 * 25-аас хойших бараанд хүрэх цорын ганц дотоод зам (infinite scroll-ийн
 * «Цааш үзэх» `<a href>`) «хуулбар» гэж тооцогдоно.
 *
 * Бусад бүх хувилбар `/catalog` руу нийлнэ: шүүлтүүр/эрэмбэ/хайлт (дангаараа
 * ч, `page`-тэй ч), `?page=1`/`0`/`abc`/`1.5` (агуулга нь 1-р хуудас), мөн
 * хүрээнээс хэтэрсэн хоосон хуудас.
 */
export function catalogCanonical(params: Params, lastPage: number): string {
  const keys = Object.keys(params).filter((k) => params[k] !== undefined);
  const raw = params.page;
  const page =
    typeof raw === "string" && /^\d+$/u.test(raw) ? Number(raw) : Number.NaN;
  const onlyPage = keys.length === 1 && keys[0] === "page";
  return onlyPage && page >= 2 && page <= lastPage
    ? `/catalog?page=${page}`
    : "/catalog";
}
