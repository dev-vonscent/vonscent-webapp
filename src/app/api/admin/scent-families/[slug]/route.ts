import { NextResponse } from "next/server";
import { revalidatePublic } from "@/lib/cache";
import { scentFamilyUpdateSchema } from "@/lib/validators/scent-family";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";

type Guard =
  | { demo: true }
  | { error: "FORBIDDEN" | "NO_DB" }
  | { supabase: NonNullable<ReturnType<typeof createAdminClient>> };

async function guard(): Promise<Guard> {
  if (!isSupabaseConfigured) return { demo: true as const };
  const staff = await getStaffUser();
  if (!staff) return { error: "FORBIDDEN" as const };
  const supabase = createAdminClient();
  if (!supabase) return { error: "NO_DB" as const };
  return { supabase };
}

function fail(error: "FORBIDDEN" | "NO_DB") {
  return NextResponse.json(
    { error },
    { status: error === "FORBIDDEN" ? 403 : 500 },
  );
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const body = await req.json().catch(() => null);
  const parsed = scentFamilyUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  const g = await guard();
  if ("demo" in g) return NextResponse.json({ demo: true });
  if ("error" in g) return fail(g.error);

  const input = parsed.data;
  const update: Record<string, unknown> = {};
  if (input.label !== undefined) update.label = input.label;
  if (input.iconUrl !== undefined) update.icon_url = input.iconUrl;
  if (input.sortOrder !== undefined) update.sort_order = input.sortOrder;
  if (input.isActive !== undefined) update.is_active = input.isActive;
  if (!Object.keys(update).length) return NextResponse.json({ ok: true });

  const { error } = await g.supabase
    .from("scent_families")
    .update(update)
    .eq("slug", slug);
  if (error)
    return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 500 });
  revalidatePublic();
  return NextResponse.json({ ok: true });
}
