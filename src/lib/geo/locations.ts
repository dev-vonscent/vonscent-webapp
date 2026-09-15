/**
 * Mongolian administrative divisions for the address form.
 *
 * Data: HDX / OCHA "Mongolia - Subnational Administrative Boundaries" (COD-AB),
 * CC BY-IGO, retrieved 2026-07-31 — see mn-locations.json for provenance.
 *   adm1 (22) = 21 аймаг + Улаанбаатар
 *   adm2 (339) = сум, and for Улаанбаатар the 9 дүүрэг
 *
 * The hierarchy is uniform, so one cascading pair of selects covers both the
 * capital and the countryside. Хороо / баг are NOT in this dataset (they change
 * more often and are the level delivery zones actually hinge on) — that list
 * comes from the client, keyed by adm2 `code`.
 *
 * To refresh: download the XLSX from the _url in the JSON and regenerate.
 *
 * Bundling (todo.md B5b): the JSON is ~47KB raw / ~12KB gzipped and is
 * imported statically. Only checkout, the address book and the admin zone
 * editor pull it in, so Next's per-route splitting already keeps it out of the
 * shared bundle — and the cascade stays instant, with no request to wait on
 * mid-checkout. Serving it from an API endpoint was considered and rejected on
 * that basis; revisit only if it grows (e.g. баг-level data).
 */
import data from "./mn-locations.json";

export interface Adm2 {
  /** Stable p-code, e.g. "MN1107" (Баянгол). */
  code: string;
  /** Cyrillic display name. */
  name: string;
  nameEn: string;
  /**
   * Khoroo numbers 1..N — capital districts only; сум don't have them and the
   * countryside address stops at сум by design.
   */
  khoroos?: number[];
}

export interface Adm1 extends Omit<Adm2, "code"> {
  code: string;
  /** True for Улаанбаатар — its children are дүүрэг, not сум. */
  isCapital: boolean;
  children: Adm2[];
}

export const AIMAGS: Adm1[] = data.aimags;

/** p-code of Улаанбаатар; its adm2 children are дүүрэг. */
export const ULAANBAATAR_CODE = "MN11";

const BY_CODE = new Map(AIMAGS.map((a) => [a.code, a]));

export function getAimag(code: string | null | undefined): Adm1 | null {
  return code ? (BY_CODE.get(code) ?? null) : null;
}

/** сум / дүүрэг of an aimag; empty for an unknown code. */
export function getChildren(aimagCode: string | null | undefined): Adm2[] {
  return getAimag(aimagCode)?.children ?? [];
}

export function isCapital(aimagCode: string | null | undefined): boolean {
  return aimagCode === ULAANBAATAR_CODE;
}

/**
 * Label for the second select — дүүрэг in the capital, сум elsewhere. Keeping
 * this in one place stops the two spellings drifting apart across forms.
 */
export function childLabel(aimagCode: string | null | undefined): string {
  return isCapital(aimagCode) ? "Дүүрэг" : "Сум";
}

const CHILD_BY_CODE = new Map(
  AIMAGS.flatMap((a) =>
    a.children.map((c) => [c.code, { aimag: a, child: c }]),
  ),
);

/** Resolve an adm2 p-code back to its pair, e.g. for rendering a saved address. */
export function resolveAdm2(
  code: string | null | undefined,
): { aimag: Adm1; child: Adm2 } | null {
  return code ? (CHILD_BY_CODE.get(code) ?? null) : null;
}

/** "Улаанбаатар, Баянгол" — for order/address summaries. */
export function formatLocation(adm2Code: string | null | undefined): string {
  const hit = resolveAdm2(adm2Code);
  return hit ? `${hit.aimag.name}, ${hit.child.name}` : "";
}

/** Khoroo numbers of a district; empty for сум (countryside stops at сум). */
export function getKhoroos(adm2Code: string | null | undefined): number[] {
  return resolveAdm2(adm2Code)?.child.khoroos ?? [];
}

/** "12-р хороо" — the way khoroos are written in Mongolian addresses. */
export function formatKhoroo(n: number): string {
  return `${n}-р хороо`;
}

/**
 * Энэ хаягт хороо ЗААВАЛ эсэх — Cyrillic нэрээр (хадгалагддаг хэлбэр нь энэ).
 *
 * «Нийслэл үү?» гэж асуухаас илүү нарийн: шалгуур нь тухайн сум/дүүрэгт хорооны
 * жагсаалт байгаа эсэх. Одоогийн өгөгдөлд энэ нь УБ-ын 9 дүүрэг (5–43 хороо),
 * орон нутагт нэг ч үгүй — гэхдээ маргааш өгөгдөл өөрчлөгдвөл дүрэм өөрөө
 * дагаж, сонгох боломжгүй талбарыг хэзээ ч шаардахгүй.
 *
 * Яагаад заавал: хороо нь зөвхөн хаягийн чимэг биш — `resolveZone` дээр
 * хороо-тусгай дүрэм (`MN1107:12`) дүүрэг-даяарын дүрмийг дардаг тул хүргэлтийн
 * ҮНЭ түүнээс хамаарна, мөн хүргэгч хорооноос хамаарч хаяг олдог.
 */
export function khorooRequired(city: string, district: string): boolean {
  const aimag = AIMAGS.find((a) => a.name === city);
  const child = aimag?.children.find((c) => c.name === district);
  return (child?.khoroos?.length ?? 0) > 0;
}
