import { NextResponse } from "next/server";
import { revalidatePublic } from "@/lib/cache";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";

const patchSchema = z.object({
  title: z.string().optional(),
  excerpt: z.string().optional(),
  body: z.string().optional(),
  coverUrl: z.string().nullable().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isPublished: z.boolean().optional(),
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
  if (d.title !== undefined) update.title = d.title;
  if (d.excerpt !== undefined) update.excerpt = d.excerpt;
  if (d.body !== undefined) update.body = d.body;
  if (d.coverUrl !== undefined) update.cover_url = d.coverUrl;
  if (d.category !== undefined) update.category = d.category;
  if (d.tags !== undefined) update.tags = d.tags;
  if (d.isPublished !== undefined) update.is_published = d.isPublished;

  await g.supabase.from("blog_posts").update(update).eq("id", id);
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
  await g.supabase.from("blog_posts").delete().eq("id", id);
  revalidatePublic();
  return NextResponse.json({ ok: true });
}
