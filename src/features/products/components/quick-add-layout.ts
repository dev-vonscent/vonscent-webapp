/**
 * Quick-add цонхны (ус, багц) дотоод байрлал — mobile-first. Цонх нь
 * ui/dialog-ийн төвийн dialog хэвээр; энд зөвхөн агуулгын зай, scroll.
 * Жижиг утсан дээр өндөрт багтахгүй бол агуулга нь scroll хийгдэж,
 * `QUICK_ADD_FOOTER` (sticky) товч үргэлж харагдана.
 */
export const QUICK_ADD_CONTENT =
  "max-h-[calc(100dvh-2rem)] gap-5 overflow-y-auto overscroll-contain p-4 pb-0 sm:p-6 sm:pb-0";

/**
 * Үйлдлийн мөр — scroll-ын доод ирмэгт наалдана (sheet урт үед ч товч
 * харагдана).
 */
export const QUICK_ADD_FOOTER =
  "bg-card sticky bottom-0 -mx-4 px-4 pt-1 pb-4 sm:-mx-6 sm:px-6 sm:pb-6";

/**
 * Толгой: зүүн талд жижиг зураг (картын 4:5), баруун талд нэр/үнэ. Том 4:3
 * зураг утсан дээр дэлгэцийн талыг эзэлж, товчийг доош түлхдэг байв.
 */
export const QUICK_ADD_HEADER =
  "grid grid-cols-[5.5rem_minmax(0,1fr)] items-start gap-4";

export const QUICK_ADD_THUMB =
  "bg-muted relative aspect-4/5 w-full overflow-hidden rounded-xl";

/** Зургийн `sizes` — толгойн баганын өргөн (88px). */
export const QUICK_ADD_THUMB_SIZES = "88px";
