import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePublic } from "@/lib/cache";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Нэмэлт таг-ийн сан (A2). Free-form internal tags: the admin builds the pool
 * here, products pick from it on the product form, search matches on them.
 */

const createSchema = z.object({
  name: z.string().min(1).max(60),
});

/** Cyrillic-safe slug: lowercase, spaces → dashes, keep letters/digits. */
function slugifyTag(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function guard() {
  if (!isSupabaseConfigured) return { demo: true as const };
  const staff = await getStaffUser();
  if (!staff) return { error: "FORBIDDEN" as const };
  const supabase = createAdminClient();
  if (!supabase) return { error: "NO_DB" as const };
  return { supabase };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  const g = await guard();
  if ("demo" in g) return NextResponse.json({ demo: true });
  if ("error" in g) {
    return NextResponse.json(
      { error: g.error },
      { status: g.error === "FORBIDDEN" ? 403 : 500 },
    );
  }

  const name = parsed.data.name.trim();
  const slug = slugifyTag(name);
  if (!slug) return NextResponse.json({ error: "VALIDATION" }, { status: 400 });

  // Returns the row, not just `ok`: the product form can add a tag inline and
  // has to select it immediately, which needs the id the database just made.
  const { data, error } = await g.supabase
    .from("custom_tags")
    .insert({ name, slug })
    .select("id, name, slug")
    .single();
  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "23505")
      return NextResponse.json({ error: "DUPLICATE" }, { status: 409 });
    if (code === "42P01")
      return NextResponse.json({ error: "NOT_MIGRATED" }, { status: 503 });
    return NextResponse.json({ error: "INSERT_FAILED" }, { status: 500 });
  }
  revalidatePublic();
  return NextResponse.json({ ok: true, tag: data });
}
