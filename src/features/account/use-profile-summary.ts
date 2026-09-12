"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/browser";

export interface ProfileSummary {
  /** Дэлгэцэнд харуулах нэр — овоггүй, хоосон бол дугаар/имэйл рүү уначихна. */
  name: string;
  /** Хоёр дахь мөр: утасны дугаар эсвэл имэйл. */
  handle: string;
  avatar: string | null;
}

/**
 * Толгой хэсгийн цэсэнд хэрэглэгчийг таниулах хамгийн бага мэдээлэл.
 *
 * `ProfileMenu`-гийн (десктоп) логикийн ижил хувилбар, гэхдээ дуудагч нь ачаалж
 * буй төлөвийг ялгаж чаддаг: зочин гэж бичээд дараа нь нэр рүү үсрэхгүйн тулд
 * гар утасны цэс эхлээд хоосон мөр харуулна.
 */
export function useProfileSummary(): {
  profile: ProfileSummary | null;
  loading: boolean;
  /** Supabase тохируулаагүй орчинд нэвтрэх/гарах товчийг нуухад. */
  configured: boolean;
} {
  const [profile, setProfile] = React.useState<ProfileSummary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [configured, setConfigured] = React.useState(true);

  React.useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setConfigured(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        if (!cancelled) setLoading(false);
        return;
      }
      const { data: row } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", data.user.id)
        .maybeSingle();
      const p = row as {
        full_name?: string;
        avatar_url?: string | null;
      } | null;
      const email = data.user.email ?? "";
      // Утас-passcode бүртгэлийн дотоод имэйлээс зөвхөн дугаарыг нь харуулна.
      const handle = email.endsWith("@phone.vonscent.mn")
        ? email.split("@")[0]
        : email;
      if (cancelled) return;
      setProfile({
        name: p?.full_name || handle || "vonscent гишүүн",
        handle,
        avatar: p?.avatar_url ?? null,
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { profile, loading, configured };
}
