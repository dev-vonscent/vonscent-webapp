import { NextResponse } from "next/server";
import { revalidatePublic } from "@/lib/cache";
import { numAblative } from "@/lib/mn-grammar";
import { callRpc } from "@/lib/supabase/rpc";
import { extraStockSchema } from "@/lib/validators/extras";
import { extrasAdminGate, extrasRpcError } from "@/features/extras/admin-route";

interface StockResult {
  ok: boolean;
  reason?: "STALE" | "BELOW_RESERVED";
  on_hand: number;
  reserved: number;
  updated_at: string;
}

/**
 * Энгийн барааны «Одоо байгаа тоо» (plan §7.3). Цонх нээгдсэнээс хойш
 * захиалга орж/гарч тоо өөрчлөгдсөн бол чимээгүй дарж бичихгүй — шинэ тоог
 * буцааж, админ дахин шалгана.
 */
export async function POST(req: Request) {
  const gate = await extrasAdminGate();
  if ("error" in gate) return gate.error;

  const parsed = extraStockSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Тоогоо шалгана уу.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { variantId, onHand, expectedUpdatedAt, note } = parsed.data;
  const { data, error } = await callRpc<StockResult>(
    gate.supabase,
    "extras_set_stock",
    {
      p_variant: variantId,
      p_on_hand: onHand,
      p_expected_updated_at: expectedUpdatedAt,
      p_note: note,
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
        error:
          data.reason === "STALE"
            ? "Нөөц энэ хооронд өөрчлөгдсөн байна. Шинэ тоог шалгана уу."
            : `Хүргэгдээгүй ${data.reserved} захиалгад энэ бараа орсон тул ${numAblative(data.reserved)} бага тоо оруулах боломжгүй.`,
        reason: data.reason,
        current,
      },
      { status: 409 },
    );
  }
  revalidatePublic();
  return NextResponse.json({ ok: true, current });
}
