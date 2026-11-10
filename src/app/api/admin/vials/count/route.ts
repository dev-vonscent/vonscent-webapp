import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePublic } from "@/lib/cache";
import { numAblative } from "@/lib/mn-grammar";
import { callRpc } from "@/lib/supabase/rpc";
import { vialAdminGate } from "@/features/extras/vial-route";

const schema = z.object({
  vialId: z.string().uuid(),
  count: z.number().int().min(0).max(1_000_000),
  /** null = анх тоолж эхлэх (on_hand null). */
  expectedUpdatedAt: z.string().min(1).nullable(),
  note: z.string().trim().max(200).default(""),
});

/**
 * Савны «Нийт тоо» (plan §5.2, §8) — савлагдаад хүргэгдээгүй захиалгынхыг
 * оруулаад. Захиалгад орсноос бага байж болохгүй; цонх нээгдсэнээс хойш
 * өөрчлөгдсөн бол хадгалахгүй.
 */
export async function POST(req: Request) {
  const gate = await vialAdminGate();
  if ("error" in gate) return gate.error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Тоогоо шалгана уу." }, { status: 400 });
  }
  const { vialId, count, expectedUpdatedAt, note } = parsed.data;
  const { data, error } = await callRpc<{
    ok: boolean;
    reason?: "STALE" | "BELOW_RESERVED";
    on_hand: number | null;
    reserved: number;
    updated_at: string;
  }>(gate.supabase, "set_vial_count", {
    p_vial: vialId,
    p_count: count,
    p_expected_updated_at: expectedUpdatedAt,
    p_note: note,
    p_by: gate.staff.id,
  });
  if (error || !data) {
    return NextResponse.json({ error: "Хадгалж чадсангүй." }, { status: 500 });
  }
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
            : `Хүргэгдээгүй ${data.reserved} захиалгад энэ сав орсон тул ${numAblative(data.reserved)} бага тоо оруулах боломжгүй.`,
        current,
      },
      { status: 409 },
    );
  }
  revalidatePublic();
  return NextResponse.json({ ok: true, current });
}
