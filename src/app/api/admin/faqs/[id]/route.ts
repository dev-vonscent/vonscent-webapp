import { NextResponse } from "next/server";
import { revalidatePublic } from "@/lib/cache";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";

const patchSchema = z.object({
  category: z.string().optional(),
  question: z.string().optional(),
  answer: z.string().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

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
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  const g = await guard();
  if ("demo" in g) return NextResponse.json({ demo: true });
  if ("error" in g)
    return NextResponse.json({ error: g.error }, { status: g.error === "FORBIDDEN" ? 403 : 500 });

  const d = parsed.data;
  const update: Record<string, unknown> = {};
  if (d.category !== undefined) update.category = d.category;
  if (d.question !== undefined) update.question = d.question;
  if (d.answer !== undefined) update.answer = d.answer;
  if (d.sortOrder !== undefined) update.sort_order = d.sortOrder;
  if (d.isActive !== undefined) update.is_active = d.isActive;

  await g.supabase.from("faqs").update(update).eq("id", id);
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
    return NextResponse.json({ error: g.error }, { status: g.error === "FORBIDDEN" ? 403 : 500 });
  await g.supabase.from("faqs").delete().eq("id", id);
  revalidatePublic();
  return NextResponse.json({ ok: true });
}
