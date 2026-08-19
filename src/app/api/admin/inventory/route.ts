import { NextResponse } from "next/server";
import { revalidatePublic } from "@/lib/cache";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { callRpc } from "@/lib/supabase/rpc";
import { getStaffUser } from "@/lib/auth/guard";

const schema = z.object({
  productId: z.string().min(1),
  delta: z.number().int(),
  reason: z.string().default("restock"),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }

  if (!isSupabaseConfigured) {
    return NextResponse.json({ demo: true });
  }

  const staff = await getStaffUser();
  if (!staff) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });

  const { error } = await callRpc(supabase, "restock_inventory", {
    p_product: parsed.data.productId,
    p_delta: parsed.data.delta,
    p_reason: parsed.data.reason,
    p_by: staff.id,
  });
  if (error) {
    return NextResponse.json({ error: "RESTOCK_FAILED" }, { status: 500 });
  }
  revalidatePublic();
  return NextResponse.json({ ok: true });
}
