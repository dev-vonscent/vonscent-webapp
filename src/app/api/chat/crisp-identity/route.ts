import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { env, isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Нэвтэрсэн хэрэглэгчийг Crisp-д таниулах өгөгдөл.
 *
 * `token` (`CRISP_TOKEN_ID`) нь session continuity — хэрэглэгч өөр
 * төхөөрөмжөөс ч өмнөх яриагаа харна. Token-ийг мэдсэн хүн тэр яриаг
 * уншиж чадах тул `userId` шууд биш, HMAC-SHA256(userId, CRISP_TOKEN_SECRET)
 * — клиент өөр хүнийхийг зохиож чадахгүй. Нууц тавигдаагүй бол token-гүй
 * (түүх зөвхөн тухайн хөтөчид).
 *
 * Имэйлийг санаатайгаар буцаахгүй: Crisp-ийн үнэгүй багцын 100 профайл
 * имэйлээр үүсдэг.
 *
 * Зочин бол 204 — клиент Crisp-г зочноор нээнэ.
 */
export async function GET() {
  if (!isSupabaseConfigured) return new NextResponse(null, { status: 204 });
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
  const digits = (profile?.phone ?? "").replace(/\D/g, "");

  return NextResponse.json(
    {
      token: env.crispTokenSecret
        ? createHmac("sha256", env.crispTokenSecret)
            .update(user.id)
            .digest("hex")
        : undefined,
      name: profile?.full_name || undefined,
      // Монгол 8 оронтой дугаарт улсын код нэмнэ.
      phone: digits.length === 8 ? `+976${digits}` : undefined,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
