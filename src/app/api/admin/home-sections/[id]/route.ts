import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";

const patchSchema = z.object({
  title: z.string().min(1).max(80).optional(),
  subtitle: z.string().max(160).optional(),
  href: z.string().max(200).optional(),
  kind: z.enum(["manual", "tag"]).optional(),
  tag: z.enum(["new", "hot", "sale"]).nullable().optional(),
  maxItems: z.number().int().min(1).max(24).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  /** Full replacement of the hand-picked list, in display order. */
  products: z.array(z.string().uuid()).max(24).optional(),
});

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
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  const g = await guard();
  if ("demo" in g) return NextResponse.json({ demo: true });
  if ("error" in g) return fail(g.error);

  const d = parsed.data;
  const update: Record<string, unknown> = {};
  if (d.title !== undefined) update.title = d.title;
  if (d.subtitle !== undefined) update.subtitle = d.subtitle;
  if (d.href !== undefined) update.href = d.href;
  if (d.kind !== undefined) {
    update.kind = d.kind;
    // Switching to a manual list drops the tag, so the two can't disagree.
    if (d.kind === "manual") update.tag = null;
  }
  if (d.tag !== undefined && update.tag === undefined) update.tag = d.tag;
  if (d.maxItems !== undefined) update.max_items = d.maxItems;
  if (d.sortOrder !== undefined) update.sort_order = d.sortOrder;
  if (d.isActive !== undefined) update.is_active = d.isActive;

  if (Object.keys(update).length) {
    const { error } = await g.supabase
      .from("home_sections")
      .update(update)
      .eq("id", id);
    if (error)
      return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 500 });
  }

  if (d.products) {
    // Replace wholesale: the payload is the complete list in its final order,
    // so reconciling row by row would only add ways to end up half-applied.
    await g.supabase.from("home_section_products").delete().eq("section_id", id);
    if (d.products.length) {
      const { error } = await g.supabase.from("home_section_products").insert(
        d.products.map((productId, i) => ({
          section_id: id,
          product_id: productId,
          sort_order: i,
        })),
      );
      if (error)
        return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guard();
  if ("demo" in g) return NextResponse.json({ demo: true });
  if ("error" in g) return fail(g.error);
  // home_section_products cascades on the FK.
  await g.supabase.from("home_sections").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
