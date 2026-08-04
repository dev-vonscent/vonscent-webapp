import { NextResponse } from "next/server";
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
  return NextResponse.json({ ok: true });
}

/**
 * Removing a family also strips it from every product that carried it —
 * `products.scent_families` is a text[] with no foreign key, so nothing else
 * would clean up the dangling slug.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const g = await guard();
  if ("demo" in g) return NextResponse.json({ demo: true });
  if ("error" in g) return fail(g.error);

  const { data: tagged } = await g.supabase
    .from("products")
    .select("id, scent_families")
    .contains("scent_families", [slug]);

  for (const p of (tagged as { id: string; scent_families: string[] }[]) ?? []) {
    await g.supabase
      .from("products")
      .update({ scent_families: p.scent_families.filter((f) => f !== slug) })
      .eq("id", p.id);
  }

  const { error } = await g.supabase
    .from("scent_families")
    .delete()
    .eq("slug", slug);
  if (error)
    return NextResponse.json({ error: "DELETE_FAILED" }, { status: 500 });
  return NextResponse.json({ ok: true, untagged: tagged?.length ?? 0 });
}
