import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePublic } from "@/lib/cache";
import { callRpc } from "@/lib/supabase/rpc";
import { extraSaveSchema } from "@/lib/validators/extras";
import {
  extrasAdminGate,
  extrasRpcError,
  savePayload,
} from "@/features/extras/admin-route";

/** Барааг засах. Ангилал, горим өөрчлөгдөхгүй (0145 trigger). */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await extrasAdminGate();
  if ("error" in gate) return gate.error;

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Буруу хүсэлт." }, { status: 400 });
  }
  const body = await req.json().catch(() => null);
  const parsed = extraSaveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Маягтаа шалгана уу.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  // Горим нь сангийнхтай таарах ёстой — өөр горимын маягт ирвэл SQL талд
  // хувилбарын шалгалт унах ч энд тод мессежтэй татгалзана.
  const { data: row } = await gate.supabase
    .from("extra_products")
    .select("inventory_mode")
    .eq("id", id)
    .maybeSingle();
  const mode = (row as { inventory_mode: string } | null)?.inventory_mode;
  if (!mode) {
    return NextResponse.json(
      { error: "Бараа олдсонгүй. Хуудсаа сэргээнэ үү." },
      { status: 404 },
    );
  }
  if (mode !== parsed.data.mode) {
    return NextResponse.json({ error: "Буруу хүсэлт." }, { status: 400 });
  }

  const { data, error } = await callRpc<{ id: string; slug: string }>(
    gate.supabase,
    "extras_save",
    { p_payload: savePayload(parsed.data, { id }), p_by: gate.staff.id },
  );
  if (error || !data)
    return extrasRpcError(error?.message, "Хадгалж чадсангүй.");
  revalidatePublic();
  return NextResponse.json({ ok: true, id: data.id, slug: data.slug });
}
