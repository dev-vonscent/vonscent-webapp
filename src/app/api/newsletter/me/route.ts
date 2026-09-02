import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Хэрэглэгчийн ӨӨРИЙН имэйл бүртгэл — унших ба цуцлах.
 *
 * `newsletter_subscribers` дээрх RLS нь зөвхөн staff-д уншуулдаг тул
 * (0014_newsletter_loyalty.sql) энд service-role клиентээр уншаад, эрхийг нь
 * `user_id`-аар нь өөрсдөө хатуу хязгаарлана — хэрэглэгч зөвхөн өөрийнхөө
 * мөрийг хардаг, өөрчилдөг.
 *
 * Имэйл солих нь `POST /api/newsletter` дээр (нэг данс = нэг имэйл), энд
 * зөвхөн харах ба мэдэгдлээс гарах.
 */

async function currentUserId(): Promise<string | null> {
  const session = await createClient();
  const {
    data: { user },
  } = (await session?.auth.getUser()) ?? { data: { user: null } };
  return user?.id ?? null;
}

export async function GET() {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ email: null, isActive: false, demo: true });
  }

  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });

  const { data } = await supabase
    .from("newsletter_subscribers")
    .select("email, is_active")
    .eq("user_id", userId)
    .maybeSingle();
  const row = data as { email: string; is_active: boolean } | null;

  return NextResponse.json({
    email: row?.email ?? null,
    isActive: Boolean(row?.is_active),
  });
}

/**
 * Мэдэгдлээс гарах. Мөрийг устгалгүй идэвхгүй болгоно — имэйл доторх token
 * линктэй ижил үйлдэл, дахин бүртгүүлбэл сэргэнэ.
 */
export async function DELETE() {
  if (!isSupabaseConfigured) return NextResponse.json({ ok: true, demo: true });

  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });

  const { error } = await supabase
    .from("newsletter_subscribers")
    .update({ is_active: false })
    .eq("user_id", userId);
  if (error) {
    return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
