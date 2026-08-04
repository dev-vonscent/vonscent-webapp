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
import { AIMAGS } from "./locations";

export interface ZoneAreaRule {
  name: string;
  areas?: string[];
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
export function adm2CodeFor(
  city: string,
  district: string,
): string | null {
  return ADM2_BY_NAME.get(`${city}|${district}`) ?? null;
}

/**
 * The zone covering an address, or null when no rule matches (the customer's
 * own choice then stands).
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
    if (exact && zone.areas.includes(exact)) return zone.name;
    if (districtMatch === null && zone.areas.includes(code)) {
      districtMatch = zone.name;
    }
  }
  return districtMatch;
}
