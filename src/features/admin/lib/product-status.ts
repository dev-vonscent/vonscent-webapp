import type { ProductStatus } from "@/lib/constants";

/**
 * Барааны төлөвийн (0125) дүрмүүд — админы UI ба route хоёрын нэг эх сурвалж.
 *
 * Жинхэнэ хамгаалалт нь DB-ийн trigger (`products_status_sync`): UI-г тойрч
 * ирсэн хүсэлт, скрипт ч түүнийг давж чадахгүй. Энд байгаа нь админд
 * ойлгомжтой харуулах, хориотой сонголтыг урьдчилан идэвхгүй болгоход л.
 */

/**
 * Нэг удаа худалдаанд гарсан бараа дахин «Тун удахгүй» болж чадахгүй —
 * дахин захиалсан ус «Дууссан» хэвээр байж, үлдэгдэл нэмэхэд л дахин
 * зарагдана. `launchedAt` нь анх гарсан мөч, хэзээ ч арилдаггүй.
 */
export function canBeComingSoon(launchedAt: string | null): boolean {
  return launchedAt === null;
}

/** «Тун удахгүй» мөртлөө үлдэгдэлтэй — ус ирсэн, гаргахад бэлэн. */
export function isReadyToLaunch(p: {
  status: ProductStatus;
  availableMl: number;
}): boolean {
  return p.status === "coming_soon" && p.availableMl > 0;
}

/** DB trigger-ийн алдааны код → админд харуулах тайлбар. */
const STATUS_ERROR_MESSAGE: Record<string, string> = {
  ALREADY_LAUNCHED:
    "Энэ бараа өмнө нь худалдаанд гарсан тул «Тун удахгүй» болгох боломжгүй. Дахин ирэхэд үлдэгдэл нэмэхэд л хангалттай.",
  STATUS_ACTIVE_MISMATCH:
    "Барааны төлөв зөрчилтэй ирлээ. Хуудсаа сэргээгээд дахин оролдоно уу.",
  LAUNCHED_AT_IMMUTABLE: "Худалдаанд гарсан огноог өөрчлөх боломжгүй.",
};

/**
 * Supabase-ийн алдааны мессежээс төлөвийн дүрмийн зөрчлийг таньж, 409-ийн
 * биеийг буцаана. Өөр алдаа бол null — дуудагч өөрийн 500-гаа буцаана.
 */
export function statusConflict(
  message: string | undefined | null,
): { error: string; code: string } | null {
  if (!message) return null;
  const code = Object.keys(STATUS_ERROR_MESSAGE).find((c) =>
    message.includes(c),
  );
  return code ? { error: STATUS_ERROR_MESSAGE[code], code } : null;
}

/**
 * «Тун удахгүй» барааг PATCH-аар «Идэвхтэй» болгох оролдлогын 409. Гаргах
 * цорын ганц зам нь `POST /api/admin/products/[id]/launch` — ирээдүйд тэнд
 * нэмэгдэх шалгалтыг ерөнхий засвар тойрохгүйн тулд.
 */
export const LAUNCH_REQUIRED = {
  error:
    "«Тун удахгүй» барааг «Худалдаанд гаргах» товчоор гаргана уу. Засварын маягтаар шууд «Идэвхтэй» болгох боломжгүй.",
  code: "LAUNCH_REQUIRED",
} as const;
