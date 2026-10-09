import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { env, isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * tawk.to-д нэвтэрсэн хэрэглэгчийг таниулах өгөгдөл (`Tawk_API.login`).
 *
 * `hash` = HMAC-SHA256(userId, TAWK_API_KEY) — tawk нь үүнийг өөрийн талд
 * шалгадаг тул клиент өөр хүний `userId`-г зохиож, түүний чатын түүхийг
 * уншиж чадахгүй. Түлхүүр зөвхөн серверт байх ёстой тул энд гаргана.
 *
 * Зочин, эсвэл түлхүүр тавигдаагүй үед 204 — клиент tawk-г зочноор нээнэ
 * (pre-chat форм нэр, утас асууна).
 */
export async function GET() {
  if (!isSupabaseConfigured || !env.tawkApiKey)
    return new NextResponse(null, { status: 204 });
  const supabase = await createClient();
  if (!supabase) return new NextResponse(null, { status: 204 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 204 });

  const { data } = await supabase
    .from("profiles")
    .select("full_name, phone")
    .eq("id", user.id)
    .maybeSingle();
  const profile = data as { full_name?: string; phone?: string | null } | null;

  // Утас-passcode бүртгэлийн дотоод имэйл (`<утас>@phone.vonscent.mn`)
  // админд утга өгөхгүй — жинхэнэ имэйлтэй үед л дамжуулна.
  const email =
    user.email && !user.email.endsWith("@phone.vonscent.mn")
      ? user.email
      : undefined;
  const digits = (profile?.phone ?? "").replace(/\D/g, "");

  return NextResponse.json(
    {
      userId: user.id,
      hash: createHmac("sha256", env.tawkApiKey).update(user.id).digest("hex"),
      name: profile?.full_name || undefined,
      email,
      // tawk нь E.164 шаарддаг; монгол 8 оронтой дугаарт улсын код нэмнэ.
      phone: digits.length === 8 ? `+976${digits}` : undefined,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
