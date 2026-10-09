import { NextResponse } from "next/server";
import { revalidatePublic } from "@/lib/cache";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { CHAT_FAQ_LIMIT } from "@/lib/constants";
import { CHAT_LIMIT_ERROR, isChatLimitError } from "@/features/faq/chat";

import { faqCreateSchema as schema } from "@/lib/validators/faq";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  if (!isSupabaseConfigured) return NextResponse.json({ demo: true });

  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });

  const i = parsed.data;
  if (i.chatPinned) {
    const { count } = await supabase
      .from("faqs")
      .select("id", { count: "exact", head: true })
      .eq("chat_pinned", true);
    if ((count ?? 0) >= CHAT_FAQ_LIMIT)
      return NextResponse.json({ error: CHAT_LIMIT_ERROR }, { status: 409 });
  }
  const { error } = await supabase.from("faqs").insert({
    category: i.category,
    question: i.question,
    answer: i.answer,
    sort_order: i.sortOrder,
    is_active: i.isActive,
    chat_pinned: i.chatPinned,
  });
  // Урьдчилсан шалгалтыг зэрэг хүсэлт давж гарвал trigger (0117) барина.
  if (error && isChatLimitError(error))
    return NextResponse.json({ error: CHAT_LIMIT_ERROR }, { status: 409 });
  if (error)
    return NextResponse.json({ error: "INSERT_FAILED" }, { status: 500 });
  revalidatePublic();
  return NextResponse.json({ ok: true });
}
