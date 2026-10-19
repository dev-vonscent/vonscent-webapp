import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit } from "@/lib/rate-limit";
import { callRpc } from "@/lib/supabase/rpc";
import {
  badRequest,
  broadcastAdminGate,
  serverError,
} from "@/features/notifications/broadcast-server";

const idSchema = z.string().uuid();
type Ctx = { params: Promise<{ id: string }> };

/**
 * «Надад туршиж илгээх» — зөвхөн одоогийн staff-д нэг хувийн мөр.
 * `broadcast_id = null`, `dedupe_key = broadcast-test:<id>:<uuid>` —
 * жинхэнэ илгээлтийн `(user_id, broadcast_id)` unique-тэй зөрчилдөхгүй, олон
 * удаа туршиж болно (plan §3).
 */
export async function POST(req: Request, { params }: Ctx) {
  const gate = await broadcastAdminGate();
  if ("response" in gate) return gate.response;

  const id = idSchema.safeParse((await params).id);
  if (!id.success) return badRequest();

  const limited = await enforceRateLimit("broadcastTest", req, {
    subject: gate.staff.id,
  });
  if (limited) return limited;

  // Энэ route нь `notify_user`-ийг тойрч шууд бичдэг тул SQL давхаргын
  // шалгалтыг энд давтана — gate-ийн туг кэштэй, сангийн утга нь эх сурвалж.
  const { data: enabled } = await callRpc<boolean>(
    gate.supabase,
    "feature_enabled",
    { p_key: "notifications" },
  );
  if (enabled !== true) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const { data: b, error: readError } = await gate.supabase
    .from("notification_broadcasts")
    .select("kind, title, body, url, image_path")
    .eq("id", id.data)
    .maybeSingle();
  if (readError)
    return serverError(new Error(readError.message), "admin.broadcasts.test");
  if (!b) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const { error } = await gate.supabase.from("user_notifications").insert({
    ...(b as Record<string, unknown>),
    user_id: gate.staff.id,
    dedupe_key: `broadcast-test:${id.data}:${crypto.randomUUID()}`,
    data: { broadcastId: id.data, test: true },
  });
  if (error)
    return serverError(new Error(error.message), "admin.broadcasts.test");
  return NextResponse.json({ ok: true });
}
