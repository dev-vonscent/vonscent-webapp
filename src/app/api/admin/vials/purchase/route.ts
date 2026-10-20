import { NextResponse } from "next/server";
import { revalidatePublic } from "@/lib/cache";
import { callRpc } from "@/lib/supabase/rpc";
import { vialPurchaseSchema } from "@/lib/validators/extras";
import { extrasRpcError } from "@/features/extras/admin-route";
import { vialAdminGate } from "@/features/extras/vial-route";

/**
 * Савны «Нөөц нөхөх» (plan §18.4): 1/2/5/10/20ml бүгд — 1ml, 2ml-ийг
 * дангаар зарахгүй ч худалдан авалт нь тайланд зарлага болно (0153).
 * Эхний тооллогоос өмнө хориотой (`STOCK_NOT_COUNTED`).
 */
export async function POST(req: Request) {
  const gate = await vialAdminGate();
  if ("error" in gate) return gate.error;

  const parsed = vialPurchaseSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Маягтаа шалгана уу.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const { data, error } = await callRpc<{
    ok: boolean;
    reason?: "STALE";
    on_hand: number | null;
    reserved: number;
    updated_at: string;
  }>(gate.supabase, "vial_purchase", {
    p_vial: d.vialId,
    p_qty: d.qty,
    p_unit_cost: d.unitCost,
    p_purchased_on: d.purchasedOn,
    p_expected_updated_at: d.expectedUpdatedAt,
    p_note: d.note,
    p_by: gate.staff.id,
  });
  if (error || !data)
    return extrasRpcError(error?.message, "Хадгалж чадсангүй.");

  const current = {
    onHand: data.on_hand,
    reserved: data.reserved,
    updatedAt: data.updated_at,
  };
  if (!data.ok) {
    return NextResponse.json(
      {
        error: "Нөөц энэ хооронд өөрчлөгдсөн байна. Шинэ тоог шалгана уу.",
        current,
      },
      { status: 409 },
    );
  }
  revalidatePublic();
  return NextResponse.json({ ok: true, current });
}
