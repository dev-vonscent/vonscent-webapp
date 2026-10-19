import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit } from "@/lib/rate-limit";
import { callRpc } from "@/lib/supabase/rpc";
import {
  BROADCAST_SCHEDULE_MAX_DAYS,
  broadcastSendSchema,
} from "@/lib/validators/notification";
import {
  badRequest,
  broadcastAdminGate,
  conflict,
  EDITABLE_STATUSES,
  serverError,
} from "@/features/notifications/broadcast-server";

const idSchema = z.string().uuid();
type Ctx = { params: Promise<{ id: string }> };

/** Үүнээс ойрхон хуваарь = «одоо» (cron 5 минут тутам). */
const NOW_SLACK_MS = 60_000;

/**
 * Одоо илгээх (`send_broadcast` — бүх профайл руу fan-out) эсвэл
 * `publishAt`-д хуваарьлах (`send-scheduled-broadcasts` cron илгээнэ).
 */
export async function POST(req: Request, { params }: Ctx) {
  const gate = await broadcastAdminGate();
  if ("response" in gate) return gate.response;

  const id = idSchema.safeParse((await params).id);
  const parsed = broadcastSendSchema.safeParse(
    await req.json().catch(() => ({})),
  );
  if (!id.success || !parsed.success) return badRequest();

  const limited = await enforceRateLimit("broadcastSend", req, {
    subject: gate.staff.id,
  });
  if (limited) return limited;

  const at = parsed.data.publishAt ? Date.parse(parsed.data.publishAt) : null;
  if (at !== null && at > Date.now() + NOW_SLACK_MS) {
    if (at > Date.now() + BROADCAST_SCHEDULE_MAX_DAYS * 86_400_000) {
      return badRequest(
        `Хуваарь ${BROADCAST_SCHEDULE_MAX_DAYS} хоногоос хол байж болохгүй.`,
      );
    }
    const { data, error } = await gate.supabase
      .from("notification_broadcasts")
      .update({ status: "scheduled", publish_at: new Date(at).toISOString() })
      .eq("id", id.data)
      .in("status", EDITABLE_STATUSES)
      .select("id");
    if (error)
      return serverError(new Error(error.message), "admin.broadcasts.schedule");
    if (!data?.length)
      return conflict("Энэ мэдэгдэл аль хэдийн илгээгдсэн эсвэл буцаагдсан.");
    return NextResponse.json({ ok: true, scheduled: true });
  }

  const { data, error } = await callRpc<number>(
    gate.supabase,
    "send_broadcast",
    {
      p_id: id.data,
    },
  );
  if (error) {
    if (error.message.includes("not found")) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    if (error.message.includes("already")) {
      return conflict("Энэ мэдэгдэл аль хэдийн илгээгдсэн эсвэл буцаагдсан.");
    }
    return serverError(new Error(error.message), "admin.broadcasts.send");
  }
  return NextResponse.json({
    ok: true,
    scheduled: false,
    recipients: data ?? 0,
  });
}
