/**
 * Address → delivery zone (todo.md B5b).
 *
 * The zone used to be a dropdown the customer picked themselves, which is both
 * a guess and an invitation to choose the cheapest option. Each zone in
 * `settings.shipping.zones` may now carry the areas it covers, and the server
 * derives the zone from the аймаг → сум/дүүрэг → хороо the customer already
 * selected. A zone with no areas stays manual-only, so the feature is inert
 * until the client's А/Б table is filled in.
 *
 * An area is written as an adm2 p-code, optionally narrowed to one khoroo:
 *   "MN1107"     — the whole district / сум
 *   "MN1107:12"  — 12-р хороо of Баянгол only
 * A khoroo-specific rule wins over a district-wide one, so the admin can put a
 * district in зone Б and lift three of its khoroos into А.
 */
import { AIMAGS, ULAANBAATAR_CODE, getAimag } from "./locations";

const UB_NAME = getAimag(ULAANBAATAR_CODE)?.name ?? "Улаанбаатар";

export interface ZoneAreaRule {
  /** Stable id (A/B/C/R/X); absent on legacy rows saved before codes existed. */
  code?: string;
  name: string;
  areas?: string[];
}

/**
 * What identifies a zone everywhere else: its code, or its name for rows saved
 * before codes existed. Keeping the fallback here means one renamed zone can't
 * silently detach itself from the orders that reference it.
 */
export function zoneKey(zone: Pick<ZoneAreaRule, "code" | "name">): string {
  return zone.code?.trim() || zone.name;
}

/** Build the area key for an adm2 code (+ khoroo). */
export function areaKey(adm2Code: string, khoroo?: number | null): string {
  return khoroo == null ? adm2Code : `${adm2Code}:${khoroo}`;
}

const ADM2_BY_NAME = new Map<string, string>(
  AIMAGS.flatMap((a) =>
    a.children.map((c) => [`${a.name}|${c.name}`, c.code] as const),
  ),
);

/**
 * adm2 p-code for a Cyrillic (аймаг, сум/дүүрэг) pair — the shape actually
 * stored on an order, since `orders.ship_city` / `ship_district` are text.
 */
export function adm2CodeFor(city: string, district: string): string | null {
  return ADM2_BY_NAME.get(`${city}|${district}`) ?? null;
}

/**
 * The zone *key* covering an address, or null when no rule matches (the
 * customer's own choice then stands).
 */
export function resolveZone(
  zones: readonly ZoneAreaRule[],
  address: { city: string; district: string; khoroo?: number | null },
): string | null {
  const code = adm2CodeFor(address.city, address.district);
  if (!code) return null;

  const exact = address.khoroo != null ? areaKey(code, address.khoroo) : null;
  let districtMatch: string | null = null;

  for (const zone of zones) {
    if (!zone.areas?.length) continue;
    // The narrower rule wins, so a hit on it can return straight away.
    if (exact && zone.areas.includes(exact)) return zoneKey(zone);
    if (districtMatch === null && zone.areas.includes(code)) {
      districtMatch = zoneKey(zone);
    }
  }
  return districtMatch;
}

/**
 * Ачаа нь унаагаар явах хаяг эсэх — үүдэнд хүргэдэггүй тул дэлгэрэнгүй хаяг
 * (байр, орц, тоот) асуухгүй, оронд нь «унаа явах газар» бичүүлнэ.
 *
 * Хотоор биш БҮСЭЭР шийднэ: Налайх, Багануур, Багахангай нь УБ-ын дүүрэг ч
 * орон нутгийн (remote) бүсэд байдаг. Улаанбаатараас гадуурх хаяг үргэлж
 * унаагаар явна — `resolveShipping`-ийн ruralFallback-тай ижил дүрэм.
 */
export function isRemoteAddress(
  zones: readonly (ZoneAreaRule & { remote?: boolean })[],
  address: { city: string; district: string; khoroo?: number | null },
): boolean {
  if (!address.city) return false;
  if (address.city !== UB_NAME) return true;
  const key = resolveZone(zones, address);
  return key != null && zones.find((z) => zoneKey(z) === key)?.remote === true;
}
