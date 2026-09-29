import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";

export interface AdminRedemption {
  id: string;
  at: string;
  cancelledAt: string | null;
  userId: string | null;
  name: string | null;
  phone: string | null;
  orderId: string | null;
  orderNo: string | null;
}

/**
 * The full usage log of one coupon (0104) — unmasked, staff only. Cancelled
 * redemptions stay in the list (`cancelledAt`): the coupon went back to its
 * owner, but the admin still sees that it was used and by whom.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = z
    .string()
    .uuid()
    .safeParse((await params).id);
  if (!id.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  if (!isSupabaseConfigured) return NextResponse.json({ redemptions: [] });

  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });

  const { data } = await supabase
    .from("coupon_redemptions")
    .select("id, user_id, order_id, created_at, cancelled_at")
    .eq("coupon_id", id.data)
    .order("created_at", { ascending: false })
    .limit(500);
  const rows =
    (data as
      | {
          id: string;
          user_id: string | null;
          order_id: string | null;
          created_at: string;
          cancelled_at: string | null;
        }[]
      | null) ?? [];

  const userIds = [
    ...new Set(rows.map((r) => r.user_id).filter(Boolean)),
  ] as string[];
  const orderIds = [
    ...new Set(rows.map((r) => r.order_id).filter(Boolean)),
  ] as string[];
  const [{ data: profs }, { data: orders }] = await Promise.all([
    userIds.length
      ? supabase
          .from("profiles")
          .select("id, full_name, phone")
          .in("id", userIds)
      : Promise.resolve({ data: [] }),
    orderIds.length
      ? supabase.from("orders").select("id, order_no").in("id", orderIds)
      : Promise.resolve({ data: [] }),
  ]);
  const people = new Map(
    (
      (profs as
        | { id: string; full_name: string | null; phone: string | null }[]
        | null) ?? []
    ).map((p) => [p.id, p]),
  );
  const orderNo = new Map(
    ((orders as { id: string; order_no: string }[] | null) ?? []).map((o) => [
      o.id,
      o.order_no,
    ]),
  );

  const redemptions: AdminRedemption[] = rows.map((r) => {
    const p = r.user_id ? people.get(r.user_id) : undefined;
    return {
      id: r.id,
      at: r.created_at,
      cancelledAt: r.cancelled_at,
      userId: r.user_id,
      name: p?.full_name ?? null,
      phone: p?.phone ?? null,
      orderId: r.order_id,
      orderNo: r.order_id ? (orderNo.get(r.order_id) ?? null) : null,
    };
  });
  return NextResponse.json({ redemptions });
}
