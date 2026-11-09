import "server-only";
import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { callRpc } from "@/lib/supabase/rpc";
import { profilePointsOf } from "@/lib/loyalty";
import { PROFILE_GENDERS, type ProfileGender } from "@/lib/constants";
import { sanitizeFamilies } from "@/features/taxonomy/api";
import type { ProfileInfoPatch } from "@/lib/validators/profile-info";
import type { ProfileInfo } from "./types";

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

/**
 * Хэрэглэгчийн route-ын хаалга: туг (404) → нэвтэрсэн (401) → service-role.
 * Мөр бүрийг `user.id`-аар өөрсдөө хязгаарлана.
 */
export async function profileInfoGate() {
  if (!(await isFeatureEnabled("profile_info"))) {
    return {
      response: NextResponse.json({ error: "NOT_FOUND" }, { status: 404 }),
    } as const;
  }
  if (!isSupabaseConfigured) {
    return {
      response: NextResponse.json({ error: "NO_DB" }, { status: 503 }),
    } as const;
  }
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!user) {
    return {
      response: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }),
    } as const;
  }
  const admin = createAdminClient();
  if (!admin) {
    return {
      response: NextResponse.json({ error: "NO_DB" }, { status: 500 }),
    } as const;
  }
  return { admin, user } as const;
}

interface ProfileDbRow {
  full_name: string | null;
  phone: string | null;
  phone_verified: boolean | null;
  avatar_url: string | null;
  gender: string | null;
  birthday: string | null;
  job: string | null;
  scent_preferences: string[] | null;
  favorite_perfumes: string[] | null;
}

interface AddressDbRow {
  city: string | null;
  district: string | null;
  detail: string | null;
  is_default: boolean;
}

function asGender(value: string | null): ProfileGender | null {
  return (PROFILE_GENDERS as readonly string[]).includes(value ?? "")
    ? (value as ProfileGender)
    : null;
}

export async function getProfileInfo(
  admin: AdminClient,
  userId: string,
): Promise<ProfileInfo> {
  const [profile, email, addresses, settings, reward] = await Promise.all([
    admin
      .from("profiles")
      .select(
        "full_name, phone, phone_verified, avatar_url, gender, birthday, job, scent_preferences, favorite_perfumes",
      )
      .eq("id", userId)
      .maybeSingle(),
    admin
      .from("newsletter_subscribers")
      .select("email")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle(),
    admin
      .from("addresses")
      .select("city, district, detail, is_default")
      .eq("user_id", userId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true }),
    admin.from("settings").select("value").eq("key", "loyalty").maybeSingle(),
    admin
      .from("profile_rewards")
      .select("points")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  const failed = [profile, email, addresses, settings, reward].find(
    (r) => r.error,
  );
  if (failed?.error) throw new Error(`profile-info: ${failed.error.message}`);

  const p = profile.data as ProfileDbRow | null;
  const addressRows = (addresses.data as AddressDbRow[] | null) ?? [];
  const main = addressRows[0];

  return {
    avatarUrl: p?.avatar_url ?? null,
    fullName: p?.full_name ?? "",
    phone: p?.phone ?? "",
    phoneVerified: Boolean(p?.phone_verified),
    email: (email.data as { email: string } | null)?.email ?? null,
    gender: asGender(p?.gender ?? null),
    birthday: p?.birthday ?? null,
    job: p?.job ?? "",
    scentPreferences: p?.scent_preferences ?? [],
    favoritePerfumes: p?.favorite_perfumes ?? [],
    address: {
      count: addressRows.length,
      summary: main
        ? [main.city, main.district, main.detail].filter(Boolean).join(", ")
        : null,
    },
    reward: {
      points: profilePointsOf(
        (settings.data as { value?: unknown } | null)?.value,
      ),
      claimedPoints: (reward.data as { points: number } | null)?.points ?? null,
    },
  };
}

/**
 * Зөвхөн өөрийн upload (`/api/upload`, folder=avatars) — замд нь
 * `avatars/<user.id>-` орсон байх ёстой. Бусдын, гадны зургийг хүлээхгүй.
 */
export function isOwnAvatarUrl(url: string, userId: string): boolean {
  try {
    return new URL(url).pathname.includes(`/avatars/${userId}-`);
  } catch {
    return false;
  }
}

export type UpdateResult = { ok: true } | { ok: false; error: string };

export async function updateProfileInfo(
  admin: AdminClient,
  userId: string,
  patch: ProfileInfoPatch,
): Promise<UpdateResult> {
  const row: Record<string, unknown> = {};
  if (patch.fullName !== undefined) row.full_name = patch.fullName;
  if (patch.avatarUrl !== undefined) {
    if (!isOwnAvatarUrl(patch.avatarUrl, userId)) {
      return { ok: false, error: "BAD_AVATAR" };
    }
    row.avatar_url = patch.avatarUrl;
  }
  if (patch.gender !== undefined) row.gender = patch.gender;
  if (patch.birthday !== undefined) row.birthday = patch.birthday;
  if (patch.job !== undefined) row.job = patch.job;
  if (patch.scentPreferences !== undefined) {
    const families = await sanitizeFamilies(patch.scentPreferences);
    if (families.length === 0) return { ok: false, error: "BAD_FAMILY" };
    row.scent_preferences = families;
  }
  if (patch.favoritePerfumes !== undefined) {
    // Ижил нэрийг давхар хадгалахгүй (том жижиг үсэг үл хамаарна).
    const seen = new Set<string>();
    row.favorite_perfumes = patch.favoritePerfumes.filter((name) => {
      const key = name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const { error } = await admin.from("profiles").update(row).eq("id", userId);
  if (error) throw new Error(`profile-info update: ${error.message}`);
  return { ok: true };
}

/** Бүрэн бол нэг удаагийн урамшууллыг олгоно; олгосон оноо (эс бөгөөс 0). */
export async function claimProfileReward(
  admin: AdminClient,
  userId: string,
): Promise<number> {
  const { data, error } = await callRpc<number>(admin, "claim_profile_reward", {
    p_user: userId,
  });
  if (error) throw new Error(`claim_profile_reward: ${error.message}`);
  return data ?? 0;
}
