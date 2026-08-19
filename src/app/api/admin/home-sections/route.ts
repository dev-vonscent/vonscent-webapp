import { NextResponse } from "next/server";
import { revalidatePublic } from "@/lib/cache";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";

/** Curated home page rails (todo.md B7). */
const schema = z.object({
  title: z.string().min(1).max(80),
  subtitle: z.string().max(160).default(""),
  href: z.string().max(200).default(""),
  kind: z.enum(["manual", "tag"]).default("manual"),
  tag: z.enum(["new", "hot", "sale"]).nullable().default(null),
  maxItems: z.number().int().min(1).max(24).default(8),
  sortOrder: z.number().int().default(0),
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
  const { error } = await supabase.from("home_sections").insert({
    title: i.title,
    subtitle: i.subtitle,
    href: i.href,
    kind: i.kind,
    // A manual section must not keep a stale tag around: `kind` is what the
    // reader switches on, and a leftover tag would be confusing in the admin.
    tag: i.kind === "tag" ? i.tag : null,
    max_items: i.maxItems,
    sort_order: i.sortOrder,
    is_active: true,
  });
  if (error)
    return NextResponse.json({ error: "INSERT_FAILED" }, { status: 500 });
  revalidatePublic();
  return NextResponse.json({ ok: true });
}
