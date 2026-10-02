"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/env";

export interface ProfileSummary {
  /** Дэлгэцэнд харуулах нэр — овоггүй, хоосон бол дугаар/имэйл рүү уначихна. */
  name: string;
  /** Хоёр дахь мөр: утасны дугаар эсвэл имэйл. */
  handle: string;
  avatar: string | null;
  /** /admin руу орох эрхтэй эсэх — зөвхөн холбоос харуулахад (cosmetic). */
  isStaff: boolean;
}

/** Profile edits invalidate this key so the header picks the change up. */
export const PROFILE_SUMMARY_KEY = ["profile-summary"] as const;

/** Roles allowed into /admin — mirrors getStaffUser() and the middleware. */
const STAFF_ROLES = ["operator", "super_admin"];

async function fetchProfileSummary(): Promise<ProfileSummary | null> {
  const supabase = createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: row } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, role")
    .eq("id", data.user.id)
    .maybeSingle();
  const p = row as {
    full_name?: string;
    avatar_url?: string | null;
    role?: string;
  } | null;
  const email = data.user.email ?? "";
  // Утас-passcode бүртгэлийн дотоод имэйлээс зөвхөн дугаарыг нь харуулна.
  const handle = email.endsWith("@phone.vonscent.mn")
    ? email.split("@")[0]
    : email;
  return {
    name: p?.full_name || handle || "vonscent гишүүн",
    handle,
    avatar: p?.avatar_url ?? null,
    isStaff: STAFF_ROLES.includes(p?.role ?? ""),
  };
}

/**
 * Толгой хэсгийн цэсэнд хэрэглэгчийг таниулах хамгийн бага мэдээлэл — десктоп
 * `ProfileMenu`, гар утасны цэс, админ холбоос бүгд энэ нэг query-г хуваалцана.
 *
 * Өмнө нь компонент бүр mount бүрдээ `getUser()` + `profiles` уншдаг байв.
 * Header нь layout бүрт тусдаа (shop / account / admin) тул админаас дэлгүүр
 * рүү ороход header шинээр mount болж, зураг, нэр секунд орчим хоосон байгаад
 * гарч ирдэг байв. Одоо TanStack Query-д таб даяар хадгалагдана: дахин mount
 * болоход шууд зурагдаж, хуучирсан бол ард нь чимээгүй шинэчлэгдэнэ.
 *
 * `gcTime: Infinity` — админ дээр удаан суугаад буцахад ч кэш устахгүй
 * (жижиг ганц мөр). Нэвтрэх/гарах нь хуудсыг бүтнээр ачаалдаг тул кэш өөрөө
 * цэвэрлэгдэнэ; бусад auth өөрчлөлтийг доорх listener барина.
 */
export function useProfileSummary(): {
  profile: ProfileSummary | null;
  /** Анх ачаалж буй үед л — кэштэй бол дахин mount-д false. */
  loading: boolean;
  /** Supabase тохируулаагүй орчинд нэвтрэх/гарах товчийг нуухад. */
  configured: boolean;
} {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({
    queryKey: PROFILE_SUMMARY_KEY,
    queryFn: fetchProfileSummary,
    enabled: isSupabaseConfigured,
    staleTime: 5 * 60_000,
    gcTime: Infinity,
  });

  // Session өөр газраас дуусах/солигдох (token сэргээлт амжилтгүй, өөр табаас
  // гарах/нэвтрэх) үед header шинэчлэгдэнэ. SIGNED_IN нь таб руу буцах бүрд ч
  // гардаг тул зөвхөн зочин гэж хадгалсан үед л дахин уншина; TOKEN_REFRESHED
  // нь хэн гэдгийг өөрчилдөггүй тул тоохгүй.
  React.useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      const stale =
        event === "SIGNED_OUT" ||
        event === "USER_UPDATED" ||
        (event === "SIGNED_IN" &&
          !queryClient.getQueryData(PROFILE_SUMMARY_KEY));
      if (stale) {
        void queryClient.invalidateQueries({ queryKey: PROFILE_SUMMARY_KEY });
      }
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);

  return {
    profile: data ?? null,
    loading: isSupabaseConfigured && isPending,
    configured: isSupabaseConfigured,
  };
}
