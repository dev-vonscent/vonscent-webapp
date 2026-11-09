import type { ProfileInfo } from "./types";

/**
 * «Миний мэдээлэл»-ийн талбарууд, харуулах дарааллаар (0163).
 *
 * `filled` нь SQL-ийн `profile_info_complete`-тэй таарах ёстой — энд «бүрэн»
 * гэж харагдсан мөртлөө урамшуулал олгогдохгүй байх ёсгүй.
 */
export const PROFILE_INFO_FIELDS = [
  "avatar",
  "fullName",
  "phone",
  "email",
  "gender",
  "birthday",
  "job",
  "address",
  "scentPreferences",
  "favoritePerfumes",
] as const;

export type ProfileInfoField = (typeof PROFILE_INFO_FIELDS)[number];

const blank = (v: string | null | undefined) => !v?.trim();

export function isFieldFilled(
  info: ProfileInfo,
  field: ProfileInfoField,
): boolean {
  switch (field) {
    case "avatar":
      return !blank(info.avatarUrl);
    case "fullName":
      return !blank(info.fullName);
    case "phone":
      return info.phoneVerified;
    case "email":
      return !blank(info.email);
    case "gender":
      return info.gender !== null;
    case "birthday":
      return info.birthday !== null;
    case "job":
      return !blank(info.job);
    case "address":
      return info.address.count > 0;
    case "scentPreferences":
      return info.scentPreferences.length > 0;
    case "favoritePerfumes":
      return info.favoritePerfumes.length > 0;
  }
}

export interface ProfileCompletion {
  done: number;
  total: number;
  /** 0…1 */
  ratio: number;
  complete: boolean;
}

export function profileCompletion(info: ProfileInfo): ProfileCompletion {
  const total = PROFILE_INFO_FIELDS.length;
  const done = PROFILE_INFO_FIELDS.filter((f) => isFieldFilled(info, f)).length;
  return { done, total, ratio: done / total, complete: done === total };
}

/** `1995-03-14` → «1995 оны 3-р сарын 14». */
export function formatBirthday(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y} оны ${m}-р сарын ${d}`;
}

/** Бөглөөгүй эхний талбар (харуулах дарааллаар), бүгд бөглөсөн бол null. */
export function nextMissingField(info: ProfileInfo): ProfileInfoField | null {
  return PROFILE_INFO_FIELDS.find((f) => !isFieldFilled(info, f)) ?? null;
}

/** Төрсөн өдрөөс `today` (`YYYY-MM-DD`) хүртэлх бүтэн нас. */
export function ageOn(birthday: string, today: string): number {
  const years = Number(today.slice(0, 4)) - Number(birthday.slice(0, 4));
  // Энэ жилийн төрсөн өдөр хараахан болоогүй бол нэг дутуу.
  return today.slice(5) < birthday.slice(5) ? years - 1 : years;
}
