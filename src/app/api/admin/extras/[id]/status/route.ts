import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePublic } from "@/lib/cache";
import { callRpc } from "@/lib/supabase/rpc";
import { extraStatusSchema } from "@/lib/validators/extras";
import { extrasAdminGate, extrasRpcError } from "@/features/extras/admin-route";
import { READINESS_MESSAGE } from "@/features/extras/messages";
import type { ExtraReadinessCode } from "@/features/extras/types";

/**
 * Нийтлэх / ноорог болгох / архивлах. Нийтлэхэд бэлэн биш бол юу дутуу
 * байгааг жагсааж 409 буцаана (форм ч мөн адил жагсаалт харуулдаг).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await extrasAdminGate();
  if ("error" in gate) return gate.error;

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Буруу хүсэлт." }, { status: 400 });
  }
  const parsed = extraStatusSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Буруу хүсэлт." }, { status: 400 });
  }

  const { data, error } = await callRpc<{
    ok: boolean;
    status?: string;
    missing?: ExtraReadinessCode[];
  }>(gate.supabase, "extras_set_status", {
    p_extra: id,
    p_status: parsed.data.status,
    p_by: gate.staff.id,
  });
  if (error || !data) {
    return extrasRpcError(error?.message, "Төлөв солиход алдаа гарлаа.");
  }
  if (!data.ok) {
    const missing = data.missing ?? [];
    return NextResponse.json(
      {
        error: missing.map((c) => READINESS_MESSAGE[c] ?? c).join(". "),
        missing,
      },
      { status: 409 },
    );
  }
  revalidatePublic();
  return NextResponse.json({ ok: true, status: data.status });
}
