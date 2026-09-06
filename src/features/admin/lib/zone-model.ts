/**
 * Which сум / хороо each delivery zone covers — the data model behind the
 * settings editor (todo.md B5b).
 *
 * The editor used to keep one list of area keys per zone, which made "move this
 * хороо to Б" a delete here plus a three-select re-add there, and let the same
 * хороо end up in two zones. Everything here is instead derived from one map,
 * `unit key → zone id`: a move is a single key write, and two zones holding one
 * хороо is not representable.
 *
 * The stored shape (`zone.areas: string[]`) is untouched — it is expanded into
 * the map on the way in and collapsed back on the way out.
 */
import { AIMAGS, ULAANBAATAR_CODE } from "@/lib/geo/locations";
import type { ShippingZoneConfig } from "@/lib/constants";

/** One card open at a time; flip to false to let the operator open several. */
export const ONE_ZONE_OPEN_AT_A_TIME = true;

/** Group id of the countryside units — the аймаг list lives outside the capital. */
export const AIMAG_GROUP = "AIMAGS";

/**
 * The smallest thing a zone can hold. `areas` is what it expands to in storage:
 * one khoroo key for the capital, every сум of an аймаг in the countryside.
 */
export interface Unit {
  key: string;
  group: string;
  label: string;
  areas: string[];
}

export interface Group {
  id: string;
  /** "Баянзүрх" — what the chips are grouped under. */
  title: string;
  /** Full label for the picker's select, e.g. "Улаанбаатар — Баянзүрх". */
  pickerLabel: string;
  /** Counting word for this group's units: "15 хороо". */
  noun: string;
  /** The same word with the reflexive suffix: "нэмэх хороогоо сонго". */
  nounOwn: string;
  units: Unit[];
}

export type Assignments = Record<string, string>;

/** Stable accordion / assignment id of a zone; code is what orders store. */
export function zoneId(zone: ShippingZoneConfig, i: number): string {
  return zone.code || `#${i}`;
}

/**
 * The unit list, derived from what is currently stored.
 *
 * The capital is always хороо-level. The countryside is аймаг-level — that is
 * how the client's price table is written — but an аймаг whose сум are split
 * across zones (only reachable through the old editor) falls back to сум-level
 * units so that reading and re-saving can never quietly widen it.
 */
export function buildGroups(zones: ShippingZoneConfig[]): Group[] {
  const stored = new Map<string, string>();
  zones.forEach((z, i) => {
    for (const area of z.areas ?? []) {
      if (!stored.has(area)) stored.set(area, zoneId(z, i));
    }
  });

  const groups: Group[] = [];

  for (const child of AIMAGS.find((a) => a.code === ULAANBAATAR_CODE)
    ?.children ?? []) {
    groups.push({
      id: child.code,
      title: child.name,
      pickerLabel: `Улаанбаатар — ${child.name}`,
      noun: "хороо",
      nounOwn: "хороогоо",
      units: (child.khoroos ?? []).map((n) => ({
        key: `${child.code}:${n}`,
        group: child.code,
        label: String(n),
        areas: [`${child.code}:${n}`],
      })),
    });
  }

  const aimagUnits: Unit[] = [];
  for (const aimag of AIMAGS) {
    if (aimag.code === ULAANBAATAR_CODE) continue;
    const sums = aimag.children;
    const zonesOf = new Set(sums.map((c) => stored.get(c.code) ?? ""));
    if (zonesOf.size <= 1) {
      aimagUnits.push({
        key: `aimag:${aimag.code}`,
        group: AIMAG_GROUP,
        label: aimag.name,
        areas: sums.map((c) => c.code),
      });
    } else {
      for (const c of sums) {
        aimagUnits.push({
          key: c.code,
          group: AIMAG_GROUP,
          label: `${aimag.name}, ${c.name}`,
          areas: [c.code],
        });
      }
    }
  }
  groups.push({
    id: AIMAG_GROUP,
    title: "Аймгууд",
    pickerLabel: "Орон нутаг (аймгууд)",
    noun: "нэгж",
    nounOwn: "нэгжээ",
    units: aimagUnits,
  });

  return groups;
}

/** Stored areas → the assignment map. A district-wide key covers its khoroos. */
export function readAssignments(
  zones: ShippingZoneConfig[],
  groups: Group[],
): Assignments {
  const stored = new Map<string, string>();
  zones.forEach((z, i) => {
    for (const area of z.areas ?? []) {
      if (!stored.has(area)) stored.set(area, zoneId(z, i));
    }
  });

  const out: Assignments = {};
  for (const group of groups) {
    // "MN1107" with no khoroo is the whole district — every khoroo inherits it
    // unless a narrower key names one, which is the same precedence
    // `resolveZone` applies at checkout.
    const wide = group.id === AIMAG_GROUP ? undefined : stored.get(group.id);
    for (const unit of group.units) {
      const zone = stored.get(unit.areas[0]) ?? wide;
      if (zone) out[unit.key] = zone;
    }
  }
  return out;
}

/**
 * The assignment map → stored areas. A district whose every хороо sits in one
 * zone collapses back to the bare district key, so the shipped defaults
 * round-trip unchanged and an address with no хороо still resolves.
 */
export function writeAssignments(
  zones: ShippingZoneConfig[],
  groups: Group[],
  assignments: Assignments,
): ShippingZoneConfig[] {
  const areasOf = new Map<string, string[]>();
  const push = (zone: string, ...areas: string[]) => {
    const list = areasOf.get(zone);
    if (list) list.push(...areas);
    else areasOf.set(zone, [...areas]);
  };

  for (const group of groups) {
    const byZone = new Map<string, Unit[]>();
    for (const unit of group.units) {
      const zone = assignments[unit.key];
      if (!zone) continue;
      const list = byZone.get(zone);
      if (list) list.push(unit);
      else byZone.set(zone, [unit]);
    }
    for (const [zone, units] of byZone) {
      if (group.id !== AIMAG_GROUP && units.length === group.units.length) {
        push(zone, group.id);
      } else {
        push(zone, ...units.flatMap((u) => u.areas));
      }
    }
  }

  return zones.map((z, i) => ({ ...z, areas: areasOf.get(zoneId(z, i)) ?? [] }));
}

