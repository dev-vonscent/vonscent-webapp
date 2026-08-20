import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const patchSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(500).optional(),
});

async function requireUser() {
  const supabase = await createClient();
  if (!supabase) return { supabase: null, userId: null } as const;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null } as const;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { supabase, userId } = await requireUser();
  if (!supabase)
    return NextResponse.json({ error: "UNAVAILABLE" }, { status: 503 });
  if (!userId)
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }

  // RLS confines the update to the owner's own custom collections.
  const { error } = await supabase
    .from("collections")
    .update(parsed.data)
    .eq("id", id)
    .eq("user_id", userId)
    .eq("type", "custom");
  if (error)
    return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { supabase, userId } = await requireUser();
  if (!supabase)
    return NextResponse.json({ error: "UNAVAILABLE" }, { status: 503 });
  if (!userId)
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { error } = await supabase
    .from("collections")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .eq("type", "custom");
  if (error)
    return NextResponse.json({ error: "DELETE_FAILED" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
