import { NextResponse } from "next/server";
import { revalidatePublic } from "@/lib/cache";
import { scentFamilyCreateSchema } from "@/lib/validators/scent-family";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Scent family taxonomy CRUD (admin → Тохиргоо → Үнэрийн төрөл).
 * Adding a family here makes it selectable on the product form and, once a
 * product carries it, a chip in the catalog filter.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = scentFamilyCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  if (!isSupabaseConfigured) return NextResponse.json({ demo: true });

  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });

  const input = parsed.data;
  const { error } = await supabase.from("scent_families").insert({
    slug: input.slug,
    label: input.label,
    icon_url: input.iconUrl ?? null,
    sort_order: input.sortOrder ?? 99,
    is_active: true,
  });

  if (error) {
    const code = (error as { code?: string }).code;
    // 23505 = unique_violation on the slug primary key.
    if (code === "23505")
      return NextResponse.json({ error: "DUPLICATE" }, { status: 409 });
    // 42P01 = the scent_families table doesn't exist — 0018 hasn't run yet.
    if (code === "42P01")
      return NextResponse.json({ error: "NOT_MIGRATED" }, { status: 503 });
    return NextResponse.json({ error: "INSERT_FAILED" }, { status: 500 });
  }
  revalidatePublic();
  return NextResponse.json({ ok: true });
}
