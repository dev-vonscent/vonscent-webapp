import { NextResponse } from "next/server";
import { revalidatePublic } from "@/lib/cache";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { CHAT_FAQ_LIMIT } from "@/lib/constants";
import { CHAT_LIMIT_ERROR, isChatLimitError } from "@/features/faq/chat";

import { faqPatchSchema as patchSchema } from "@/lib/validators/faq";

async function guard() {
  if (!isSupabaseConfigured) return { demo: true as const };
  const staff = await getStaffUser();
  if (!staff) return { error: "FORBIDDEN" as const };
  const supabase = createAdminClient();
  if (!supabase) return { error: "NO_DB" as const };
  return { supabase };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  const g = await guard();
  if ("demo" in g) return NextResponse.json({ demo: true });
  if ("error" in g)
    return NextResponse.json(
      { error: g.error },
      { status: g.error === "FORBIDDEN" ? 403 : 500 },
    );

  const d = parsed.data;
  const update: Record<string, unknown> = {};
  if (d.category !== undefined) update.category = d.category;
  if (d.question !== undefined) update.question = d.question;
  if (d.answer !== undefined) update.answer = d.answer;
  if (d.sortOrder !== undefined) update.sort_order = d.sortOrder;
  if (d.isActive !== undefined) update.is_active = d.isActive;
  if (d.chatPinned !== undefined) update.chat_pinned = d.chatPinned;

  if (d.chatPinned) {
    const { count } = await g.supabase
      .from("faqs")
      .select("id", { count: "exact", head: true })
      .eq("chat_pinned", true)
      .neq("id", id);
    if ((count ?? 0) >= CHAT_FAQ_LIMIT)
      return NextResponse.json({ error: CHAT_LIMIT_ERROR }, { status: 409 });
  }

  const { error } = await g.supabase.from("faqs").update(update).eq("id", id);
  // Урьдчилсан шалгалтыг зэрэг хүсэлт давж гарвал trigger (0117) барина.
  if (error && isChatLimitError(error))
    return NextResponse.json({ error: CHAT_LIMIT_ERROR }, { status: 409 });
  if (error)
    return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 500 });
  revalidatePublic();
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guard();
  if ("demo" in g) return NextResponse.json({ demo: true });
  if ("error" in g)
    return NextResponse.json(
      { error: g.error },
      { status: g.error === "FORBIDDEN" ? 403 : 500 },
    );
  await g.supabase.from("faqs").delete().eq("id", id);
  revalidatePublic();
  return NextResponse.json({ ok: true });
}
