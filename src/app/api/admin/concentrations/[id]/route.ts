import { NextResponse } from "next/server";
import { revalidatePublic } from "@/lib/cache";
import { concentrationPatchSchema } from "@/lib/validators/concentration";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CONCENTRATION_COLUMNS,
  toConcentrationOption,
  type ConcentrationRowJson,
} from "../row";

/**
 * Үнэртний төрөл засах / устгах (0085).
 *
 * Товчлол засахад `products.concentration` дагаж шинэчлэгдэнэ — FK нь
 * `on update cascade`, тиймээс энд бараануудыг гараар тойрох шаардлагагүй.
 * Устгахад `on delete restrict` хамгаалалт ажиллана: ашиглагдаж байгаа
 * төрлийг устгах гэвэл Postgres 23503 буцаана, бид түүнийг «ашиглагдаж
 * байна» гэж хэлнэ — бараануудыг чимээгүйхэн төрөлгүй болгохгүй.
 */

async function guard() {
  if (!isSupabaseConfigured) return { demo: true as const };
  const staff = await getStaffUser();
  if (!staff) return { error: "FORBIDDEN" as const, status: 403 };
  const supabase = createAdminClient();
  if (!supabase) return { error: "NO_DB" as const, status: 500 };
  return { supabase };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = concentrationPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const g = await guard();
  if ("demo" in g) return NextResponse.json({ demo: true });
  if ("error" in g)
    return NextResponse.json({ error: g.error }, { status: g.status });

  const patch: Record<string, unknown> = {};
  if (parsed.data.code !== undefined) patch.code = parsed.data.code;
  if (parsed.data.label !== undefined) patch.label = parsed.data.label;
  if (parsed.data.isActive !== undefined)
    patch.is_active = parsed.data.isActive;

  const { data, error } = await g.supabase
    .from("concentrations")
    .update(patch)
    .eq("id", id)
    .select(CONCENTRATION_COLUMNS)
    .single();

  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "23505")
      return NextResponse.json({ error: "DUPLICATE" }, { status: 409 });
    if (code === "42P01")
      return NextResponse.json({ error: "NOT_MIGRATED" }, { status: 503 });
    return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  revalidatePublic();
  return NextResponse.json({
    ok: true,
    concentration: toConcentrationOption(
      data as unknown as ConcentrationRowJson,
    ),
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guard();
  if ("demo" in g) return NextResponse.json({ demo: true });
  if ("error" in g)
    return NextResponse.json({ error: g.error }, { status: g.status });

  const { error } = await g.supabase
    .from("concentrations")
    .delete()
    .eq("id", id);

  if (error) {
    const code = (error as { code?: string }).code;
    // 23503 = foreign_key_violation: бараа энэ төрлийг ашиглаж байна.
    if (code === "23503")
      return NextResponse.json({ error: "IN_USE" }, { status: 409 });
    return NextResponse.json({ error: "DELETE_FAILED" }, { status: 500 });
  }

  revalidatePublic();
  return NextResponse.json({ ok: true });
}
