/**
 * Feed/poll-ын opaque cursor — `(visible_at, id)` хос (plan §5).
 *
 * Client timestamp биш: сервер мөрийн `visible_at`-ийг САНГААС ирсэн хэвээр
 * (микросекундтэй) хадгална. JS `Date` болгож буулгавал миллисекундээр
 * тасарч, ижил мс доторх мөрүүдийг keyset алгасна.
 */
export interface NotificationCursor {
  visibleAt: string;
  id: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Postgres/PostgREST-ийн timestamptz текст: `2026-10-18T04:00:00.123456+00:00`. */
const TS_RE =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(\.\d{1,6})?(Z|[+-]\d{2}(:?\d{2})?)$/;

/**
 * `Date.parse` нь `2026-02-30`, `24:00`, `0000` оныг хүлээн авдаг ч Postgres
 * татгалзана (→ 500). Хуанлийн хувьд бодит, боломжит хүрээнд байхыг шаардана.
 */
function isRealTimestamp(m: RegExpExecArray): boolean {
  const [y, mo, d, h, mi, sec] = m.slice(1, 7).map(Number);
  if (y < 2000 || y > 2100 || h > 23 || mi > 59 || sec > 59) return false;
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/** Хоосон feed-ийн poll cursor-д — ямар ч жинхэнэ id-аас бага. */
export const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

function toBase64Url(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  return atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
}

export function encodeCursor(c: NotificationCursor): string {
  return toBase64Url(`${c.visibleAt}|${c.id}`);
}

/**
 * Хоёр cursor-оос `visible_at`-аар хожуу нь (тэнцүү бол `a`). Poll-ын cursor
 * зөвхөн урагшлахын тулд. Мс-ээр харьцуулна — ижил мс доторх зөрүүг poll-ын
 * ухарсан цонх барина.
 */
export function laterOf(
  a: NotificationCursor,
  b: NotificationCursor,
): NotificationCursor {
  return Date.parse(b.visibleAt) > Date.parse(a.visibleAt) ? b : a;
}

/** Буруу/хуурамч cursor → null (route нь 400 буцаана). */
export function decodeCursor(raw: string): NotificationCursor | null {
  let text: string;
  try {
    text = fromBase64Url(raw);
  } catch {
    return null;
  }
  const [visibleAt, id, ...rest] = text.split("|");
  if (rest.length || !visibleAt || !id) return null;
  const ts = TS_RE.exec(visibleAt);
  if (!ts || !isRealTimestamp(ts) || !UUID_RE.test(id)) return null;
  if (Number.isNaN(Date.parse(visibleAt))) return null;
  return { visibleAt, id: id.toLowerCase() };
}
