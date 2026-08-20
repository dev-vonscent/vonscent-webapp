import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  role: z
    .enum(["guest", "customer", "courier", "operator", "super_admin"])
    .optional(),
  loyaltyPoints: z.number().int().nonnegative().optional(),
  isBlocked: z.boolean().optional(),
});

/** Update a customer's role / loyalty / blocked flag. Role changes need super_admin. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }

  if (!isSupabaseConfigured) return NextResponse.json({ demo: true });

  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (parsed.data.role !== undefined && staff.role !== "super_admin") {
    return NextResponse.json({ error: "FORBIDDEN_ROLE" }, { status: 403 });
  }

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });

  const update: Record<string, unknown> = {};
  if (parsed.data.role !== undefined) update.role = parsed.data.role;
  if (parsed.data.loyaltyPoints !== undefined)
    update.loyalty_points = parsed.data.loyaltyPoints;
  if (parsed.data.isBlocked !== undefined)
    update.is_blocked = parsed.data.isBlocked;

  if (Object.keys(update).length > 0) {
    const { error } = await supabase
      .from("profiles")
      .update(update)
      .eq("id", id);
    if (error)
      return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
