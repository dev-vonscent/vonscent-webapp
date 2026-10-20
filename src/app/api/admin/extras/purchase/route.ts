import { NextResponse } from "next/server";
import { revalidatePublic } from "@/lib/cache";
import { callRpc } from "@/lib/supabase/rpc";
import { extraPurchaseSchema } from "@/lib/validators/extras";
import { extrasAdminGate, extrasRpcError } from "@/features/extras/admin-route";

interface PurchaseResult {
  ok: boolean;
  reason?: "STALE";
  on_hand: number;
  reserved: number;
  updated_at: string;
}

/**
 * Энгийн барааны «Нөөц нөхөх» (plan §18.4): +ширхэг, нэгж авсан үнэ, авсан
 * өдөр. Нийт өртөг тайланд тухайн өдрийн худалдан авалт болно (0153). Цонх
 * нээгдсэнээс хойш тоо өөрчлөгдсөн бол хадгалахгүй — шинэ тоог буцаана.
 */
export async function POST(req: Request) {
  const gate = await extrasAdminGate();
  if ("error" in gate) return gate.error;

  const parsed = extraPurchaseSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Маягтаа шалгана уу.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const { data, error } = await callRpc<PurchaseResult>(
    gate.supabase,
    "extras_purchase",
    {
      p_variant: d.variantId,
      p_qty: d.qty,
      p_unit_cost: d.unitCost,
      p_purchased_on: d.purchasedOn,
      p_expected_updated_at: d.expectedUpdatedAt,
      p_note: d.note,
      p_by: gate.staff.id,
    },
  );
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
        reason: data.reason,
        current,
      },
      { status: 409 },
    );
  }
  revalidatePublic();
  return NextResponse.json({ ok: true, current });
}
