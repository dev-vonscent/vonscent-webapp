import { NextResponse } from "next/server";
import { revalidatePublic } from "@/lib/cache";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  category: z.string().default(""),
  question: z.string().min(1),
  answer: z.string().min(1),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

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
  const { error } = await supabase.from("faqs").insert({
    category: i.category,
    question: i.question,
    answer: i.answer,
    sort_order: i.sortOrder,
    is_active: i.isActive,
  });
  if (error)
    return NextResponse.json({ error: "INSERT_FAILED" }, { status: 500 });
  revalidatePublic();
  return NextResponse.json({ ok: true });
}
