import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";

const patchSchema = z.object({
  isActive: z.boolean().optional(),
  value: z.number().int().nonnegative().optional(),
  minSubtotal: z.number().int().nonnegative().optional(),
  maxUses: z.number().int().positive().nullable().optional(),
  maxUsesPerUser: z.number().int().positive().nullable().optional(),
  /** Re-assign (or un-assign) the customer a coupon belongs to. */
  userId: z.string().uuid().nullable().optional(),
  endsAt: z.string().nullable().optional(),
});

async function guard() {
  if (!isSupabaseConfigured) return { demo: true as const };
  const staff = await getStaffUser();
  if (!staff) return { error: "FORBIDDEN" as const };
  const supabase = createAdminClient();
  if (!supabase) return { error: "NO_DB" as const };
  return { supabase };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  const g = await guard();
  if ("demo" in g) return NextResponse.json({ demo: true });
  if ("error" in g)
    return NextResponse.json(
      { error: g.error },
      { status: g.error === "FORBIDDEN" ? 403 : 500 },
    );

  const update: Record<string, unknown> = {};
  if (parsed.data.isActive !== undefined)
    update.is_active = parsed.data.isActive;
  if (parsed.data.value !== undefined) update.value = parsed.data.value;
  if (parsed.data.minSubtotal !== undefined)
    update.min_subtotal = parsed.data.minSubtotal;
  if (parsed.data.maxUses !== undefined) update.max_uses = parsed.data.maxUses;
  if (parsed.data.maxUsesPerUser !== undefined)
    update.max_uses_per_user = parsed.data.maxUsesPerUser;
  if (parsed.data.userId !== undefined) update.user_id = parsed.data.userId;
  if (parsed.data.endsAt !== undefined) update.ends_at = parsed.data.endsAt;

  await g.supabase.from("coupons").update(update).eq("id", id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guard();
  if ("demo" in g) return NextResponse.json({ demo: true });
  if ("error" in g)
    return NextResponse.json(
      { error: g.error },
      { status: g.error === "FORBIDDEN" ? 403 : 500 },
    );
  await g.supabase.from("coupons").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
