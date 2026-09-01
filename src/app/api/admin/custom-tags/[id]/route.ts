import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePublic } from "@/lib/cache";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";

const patchSchema = z.object({ name: z.string().min(1).max(60) });

/** Cyrillic-safe slug — same rule the create route uses. */
function slugifyTag(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Rename a custom tag.
 *
 * The slug is re-derived rather than kept: it is an internal key for search
 * and the quiz, nothing links to it by URL, and leaving a stale slug behind a
 * corrected name is how the two drift apart. `product_custom_tags` joins on
 * the id, so every product keeps the tag through a rename.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  if (!isSupabaseConfigured) return NextResponse.json({ demo: true });

  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });

  const name = parsed.data.name.trim();
  const slug = slugifyTag(name);
  if (!slug) return NextResponse.json({ error: "VALIDATION" }, { status: 400 });

  const { data, error } = await supabase
    .from("custom_tags")
    .update({ name, slug })
    .eq("id", id)
    .select("id, name, slug")
    .single();
  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "23505")
      return NextResponse.json({ error: "DUPLICATE" }, { status: 409 });
    return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 500 });
  }
  revalidatePublic();
  return NextResponse.json({ ok: true, tag: data });
}

/** Remove a custom tag; the join rows cascade with it. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isSupabaseConfigured) return NextResponse.json({ demo: true });

  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });

  const { error } = await supabase.from("custom_tags").delete().eq("id", id);
  if (error)
    return NextResponse.json({ error: "DELETE_FAILED" }, { status: 500 });
  revalidatePublic();
  return NextResponse.json({ ok: true });
}
