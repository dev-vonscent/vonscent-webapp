import { NextResponse } from "next/server";
import { z } from "zod";
import { vialAdminGate } from "@/features/extras/vial-route";

/** Савны сүүлийн 20 хөдөлгөөн (plan §8). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await vialAdminGate();
  if ("error" in gate) return gate.error;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Буруу хүсэлт." }, { status: 400 });
  }
  const { data } = await gate.supabase
    .from("vial_movements")
    .select(
      "id, kind, delta_on_hand, delta_reserved, note, cost, created_at, order_items(orders(order_no))",
    )
    .eq("vial_id", id)
    .order("created_at", { ascending: false })
    .limit(20);
  const rows = (
    (data as
      | {
          id: number;
          kind: string;
          delta_on_hand: number;
          delta_reserved: number;
          note: string;
          cost: number | null;
          created_at: string;
          order_items: { orders: { order_no: string } | null } | null;
        }[]
      | null) ?? []
  ).map((r) => ({
    id: r.id,
    kind: r.kind,
    deltaOnHand: r.delta_on_hand,
    deltaReserved: r.delta_reserved,
    note: r.note,
    at: r.created_at,
    orderNo: r.order_items?.orders?.order_no ?? null,
    // bigint — PostgREST тоо эсвэл мөр буцааж болно.
    cost: r.cost == null ? null : Number(r.cost),
  }));
  return NextResponse.json({ items: rows });
}
