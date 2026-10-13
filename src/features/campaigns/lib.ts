/**
 * Кампанит ажлын цэвэр логик — сангүйгээр тестлэгдэнэ.
 *
 * Хугацаа нь UB-ийн өдрөөр (0135): `startsOn`-ийн 00:00:00-оос `endsOn`-ийн
 * 23:59:59 хүртэл. `YYYY-MM-DD` мөрүүд лексикографаар эрэмбэлэгддэг тул
 * огноог Date болгохгүйгээр шууд харьцуулна.
 */

export type CampaignPhase = "live" | "scheduled" | "ended" | "off";

export interface CampaignPeriod {
  isActive: boolean;
  startsOn: string;
  endsOn: string;
}

/**
 * Одоо купон олгож байгаа эсэх, үгүй бол яагаад. Унтраасан нь хугацаанаас
 * давамгайлна — админ «яагаад олгохгүй байна» гэж асуухад эхний хариулт.
 */
export function campaignPhase(c: CampaignPeriod, today: string): CampaignPhase {
  if (!c.isActive) return "off";
  if (today < c.startsOn) return "scheduled";
  if (today > c.endsOn) return "ended";
  return "live";
}

export const PHASE_LABEL: Record<CampaignPhase, string> = {
  live: "Явагдаж байна",
  scheduled: "Товлосон",
  ended: "Дууссан",
  off: "Унтраалттай",
};

/** Ижил төрлийн хоёр ИДЭВХТЭЙ кампанит ажлын хугацаа давхцаж буй эсэх (SQL trigger-ийн толь). */
export function periodsOverlap(a: CampaignPeriod, b: CampaignPeriod): boolean {
  return a.startsOn <= b.endsOn && a.endsOn >= b.startsOn;
}

/** `2026-10-13` + 7 → `2026-10-20` (хуанлийн өдөр, DST-д хамааралгүй). */
export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/**
 * Өнөөдөр олгосон купон хэдэнд дуусах вэ. Олгосон өдөр = 1 дэх өдөр, тиймээс
 * N хоног → (өнөөдөр + N − 1)-ийн 23:59:59 (UB) — SQL (0136)-тэй ижил.
 */
export function couponEndsOn(today: string, validDays: number): string {
  return addDays(today, validDays - 1);
}

/** `2026-10-13` → `2026.10.13` — сайтын бусад огноотой ижил хэлбэр. */
export function formatDay(dateKey: string): string {
  return dateKey.replaceAll("-", ".");
}

/** Давхцлын алдааны мессеж (`CAMPAIGN_OVERLAP:<нэр>`) → хүнд ойлгогдох текст. */
export function overlapMessage(raw: string): string | null {
  const m = /CAMPAIGN_OVERLAP:(.+)/u.exec(raw);
  if (!m) return null;
  return `«${m[1].trim()}» кампанит ажилтай хугацаа давхцаж байна. Аль нэгийнх нь хугацааг өөрчлөх эсвэл унтраана уу.`;
}
