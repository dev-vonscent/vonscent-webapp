import { NextResponse } from "next/server";
import { z } from "zod";
import { callRpc } from "@/lib/supabase/rpc";
import {
  badRequest,
  broadcastAdminGate,
  serverError,
} from "@/features/notifications/broadcast-server";

const idSchema = z.string().uuid();
type Ctx = { params: Promise<{ id: string }> };

/**
 * Буцааж татах: хэрэглэгчдийн мөрийг устгана, broadcast нь `cancelled`
 * төлөвтэй audit-д үлдэнэ. Хуваарьт (илгээгдээгүй) мэдэгдлийг ч цуцална.
 */
export async function POST(_req: Request, { params }: Ctx) {
  const gate = await broadcastAdminGate();
  if ("response" in gate) return gate.response;

  const id = idSchema.safeParse((await params).id);
  if (!id.success) return badRequest();

  const { data, error } = await callRpc<number>(
    gate.supabase,
    "cancel_broadcast",
    {
      p_id: id.data,
      p_by: gate.staff.id,
    },
  );
  if (error) {
    if (error.message.includes("not found")) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    return serverError(new Error(error.message), "admin.broadcasts.cancel");
  }
  return NextResponse.json({ ok: true, removed: data ?? 0 });
}
