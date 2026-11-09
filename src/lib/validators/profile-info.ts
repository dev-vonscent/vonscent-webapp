import { z } from "zod";
import {
  PROFILE_FAVORITE_PERFUMES_MAX,
  PROFILE_GENDERS,
  PROFILE_JOB_MAX,
  PROFILE_NAME_MAX,
  PROFILE_PERFUME_NAME_MAX,
  PROFILE_SCENT_PREFS_MAX,
} from "@/lib/constants";

/** `YYYY-MM-DD`, 1900 оноос хойш, өнөөдрөөс хойш биш. */
export function isValidBirthday(value: string, today = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  // 2026-02-31 зэрэг огноог Date өөрөө дараагийн сар руу шилжүүлдэг.
  if (date.toISOString().slice(0, 10) !== value) return false;
  return value >= "1900-01-01" && value <= today.toISOString().slice(0, 10);
}

/**
 * «Миний мэдээлэл»-ийн нэг талбарын засвар (0163). Талбар бүр тусдаа
 * хадгалагдана — нэг хүсэлтэд нэг ба түүнээс дээш түлхүүр.
 * Утас, имэйл, хаяг өөрийн урсгалтай (verify.mn, /api/newsletter, addresses).
 */
export const profileInfoPatchSchema = z
  .object({
    fullName: z.string().trim().min(1).max(PROFILE_NAME_MAX),
    avatarUrl: z.string().url().max(2048),
    gender: z.enum(PROFILE_GENDERS),
    birthday: z.string().refine((v) => isValidBirthday(v)),
    job: z.string().trim().min(1).max(PROFILE_JOB_MAX),
    scentPreferences: z
      .array(z.string().min(1).max(40))
      .min(1)
      .max(PROFILE_SCENT_PREFS_MAX),
    favoritePerfumes: z
      .array(z.string().trim().min(1).max(PROFILE_PERFUME_NAME_MAX))
      .min(1)
      .max(PROFILE_FAVORITE_PERFUMES_MAX),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0);

export type ProfileInfoPatch = z.infer<typeof profileInfoPatchSchema>;
