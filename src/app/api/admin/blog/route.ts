import { NextResponse } from "next/server";
import { revalidatePublic } from "@/lib/cache";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  title: z.string().min(1),
  slug: z.string().optional(),
  excerpt: z.string().default(""),
  body: z.string().default(""),
  coverUrl: z.string().nullable().default(null),
  category: z.string().default(""),
  tags: z.array(z.string()).default([]),
  isPublished: z.boolean().default(true),
});

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  if (!isSupabaseConfigured) return NextResponse.json({ demo: true });

  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });

  const i = parsed.data;
  const { error } = await supabase.from("blog_posts").insert({
    slug: i.slug || slugify(i.title) || crypto.randomUUID(),
    title: i.title,
    excerpt: i.excerpt,
    body: i.body,
    cover_url: i.coverUrl,
    category: i.category,
    tags: i.tags,
    is_published: i.isPublished,
  });
  if (error) return NextResponse.json({ error: "INSERT_FAILED" }, { status: 500 });
  revalidatePublic();
  return NextResponse.json({ ok: true });
}
