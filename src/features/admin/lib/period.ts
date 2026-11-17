/**
 * Админы хугацааны талбарын тайлбар (task 7): «11-р сарын 13-ны 00:00-оос
 * 11-р сарын 21-ний 23:59 хүртэл — 9 хоног (Улаанбаатарын цагаар)».
 *
 * Өдрөөр сонгодог бүх хугацаа `dayStartIso` / `dayEndIso`-ийн
 * (date-range.ts) дүрмээр хадгалагдана: эхлэх өдөр = тэр өдрийн 00:00 УБ,
 * дуусах өдөр = тэр өдрийг БҮТНЭЭР нь (дараагийн өдрийн 00:00 УБ хүртэл,
 * exclusive). Тайлбар нь яг тэр дүрмийг үгээр хэлнэ — «23:59» нь 23:59:59-ийг
 * оролцуулна. Хадгалах тал энэ функцуудаас өөрөөр бодвол тайлбар худал болно.
 */

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/u;

export const UB_ZONE_NOTE = "Улаанбаатарын цагаар";

/** `YYYY-MM-DD` → UTC үд (хуанлийн тооцоонд цагийн бүс оролцохгүй). */
function keyDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

/** «23-ны», «1-ний» — тооны дуудлагын эгшиг зохицол (нэг, дөрөв, ес → -ний). */
export function dayGenitive(day: number): string {
  const last = day % 10;
  const soft = day % 10 !== 0 && (last === 1 || last === 4 || last === 9);
  return `${day}-${soft ? "ний" : "ны"}`;
}

/** Хоёр өдрийг оролцуулаад хэд хоног. */
export function daysInclusive(startsOn: string, endsOn: string): number {
  return (
    Math.round(
      (keyDate(endsOn).getTime() - keyDate(startsOn).getTime()) / 86_400_000,
    ) + 1
  );
}

/** «11-р сарын 23-ны»; `withYear` бол «2027 оны 1-р сарын 3-ны». */
function dayPhrase(key: string, withYear: boolean): string {
  const [y, m, d] = key.split("-").map(Number);
  return `${withYear ? `${y} оны ` : ""}${m}-р сарын ${dayGenitive(d)}`;
}

export interface PeriodSentenceOptions {
  /**
   * Эхлэх өдөр хоосон бол юу гэж уншигдах вэ. `today` өгвөл «Өнөөдрөөс»
   * гэж, хоногийг өнөөдрөөс тоолно (хоосон эхлэл = «одооноос» гэсэн
   * утгатай талбарт — хямдрал). Өгөхгүй бол эхлэлгүй = хязгааргүй.
   */
  today?: string;
}

/**
 * Хугацааны өгүүлбэр. Аль аль нь хоосон, буруу хэлбэртэй, эсвэл дуусах нь
 * эхлэхээс өмнө бол null (талбарын алдаа өөрөө хэлнэ).
 *
 *  - хоёулаа: «… 00:00-оос … 23:59 хүртэл — N хоног (УБ)»
 *  - зөвхөн дуусах: «… 23:59 хүртэл (УБ)» / `today`-тэй бол «Өнөөдрөөс …»
 *  - зөвхөн эхлэх: «… 00:00-оос хугацаагүй (УБ)»
 */
export function periodSentence(
  startsOn: string,
  endsOn: string,
  { today }: PeriodSentenceOptions = {},
): string | null {
  const hasStart = DAY_RE.test(startsOn);
  const hasEnd = DAY_RE.test(endsOn);
  if (!hasStart && !hasEnd) return null;
  // Он нь хоёр өдрийн хооронд солигдвол л бичнэ (12-р сар → 1-р сар).
  const withYear =
    hasStart && hasEnd && startsOn.slice(0, 4) !== endsOn.slice(0, 4);
  const zone = `(${UB_ZONE_NOTE})`;

  if (hasStart && hasEnd) {
    if (endsOn < startsOn) return null;
    return `${dayPhrase(startsOn, withYear)} 00:00-оос ${dayPhrase(
      endsOn,
      withYear,
    )} 23:59 хүртэл — ${daysInclusive(startsOn, endsOn)} хоног ${zone}`;
  }
  if (hasEnd) {
    const end = `${dayPhrase(endsOn, false)} 23:59 хүртэл`;
    if (today && DAY_RE.test(today)) {
      if (endsOn < today) return null;
      return `Өнөөдрөөс ${end} — ${daysInclusive(today, endsOn)} хоног ${zone}`;
    }
    return `${end} ${zone}`;
  }
  return `${dayPhrase(startsOn, false)} 00:00-оос хугацаагүй ${zone}`;
}

/** «11-р сарын 21-ний 14:00-д (Улаанбаатарын цагаар)» — нэг мөч (илгээх цаг). */
export function momentSentence(day: string, time: string): string | null {
  if (!DAY_RE.test(day) || !/^\d{2}:\d{2}$/u.test(time)) return null;
  return `${dayPhrase(day, false)} ${time}-д (${UB_ZONE_NOTE})`;
}
