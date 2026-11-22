import { NextResponse } from "next/server";
import { revalidatePublic } from "@/lib/cache";
import { callRpc } from "@/lib/supabase/rpc";
import { extraCreateSchema } from "@/lib/validators/extras";
import {
  extrasAdminGate,
  extrasRpcError,
  savePayload,
} from "@/features/extras/admin-route";

/** Шинэ нэмэлт бараа — ноорог (`draft`) болж үүснэ, нийтлэх нь тусдаа. */
export async function POST(req: Request) {
  const gate = await extrasAdminGate();
  if ("error" in gate) return gate.error;

  const body = await req.json().catch(() => null);
  const parsed = extraCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Маягтаа шалгана уу.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { data, error } = await callRpc<{ id: string; slug: string }>(
    gate.supabase,
    "extras_save",
    {
      p_payload: savePayload(parsed.data.extra, {
        categoryId: parsed.data.categoryId,
      }),
      p_by: gate.staff.id,
    },
  );
  if (error || !data)
    return extrasRpcError(error?.message, "Хадгалж чадсангүй.");
  revalidatePublic();
  return NextResponse.json({ ok: true, id: data.id, slug: data.slug });
}
