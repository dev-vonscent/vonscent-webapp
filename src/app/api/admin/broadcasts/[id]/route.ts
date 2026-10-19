import { NextResponse } from "next/server";
import { z } from "zod";
import { broadcastInputSchema } from "@/lib/validators/notification";
import {
  badRequest,
  broadcastAdminGate,
  conflict,
  EDITABLE_STATUSES,
  serverError,
  toBroadcastColumns,
} from "@/features/notifications/broadcast-server";

const idSchema = z.string().uuid();
type Ctx = { params: Promise<{ id: string }> };

/** Засах — зөвхөн илгээгдээгүй (`draft` / `scheduled`). Хуваарь хэвээр. */
export async function PUT(req: Request, { params }: Ctx) {
  const gate = await broadcastAdminGate();
  if ("response" in gate) return gate.response;

  const id = idSchema.safeParse((await params).id);
  const parsed = broadcastInputSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!id.success || !parsed.success) return badRequest();
  const cols = toBroadcastColumns(parsed.data);
  if (!cols.ok) return badRequest("Зургийг дахин байршуулна уу.");

  const { data, error } = await gate.supabase
    .from("notification_broadcasts")
    .update(cols.columns)
    .eq("id", id.data)
    .in("status", EDITABLE_STATUSES)
    .select("id");
  if (error)
    return serverError(new Error(error.message), "admin.broadcasts.update");
  if (!data?.length) {
    return conflict("Илгээгдсэн эсвэл буцаагдсан мэдэгдлийг засах боломжгүй.");
  }
  return NextResponse.json({ ok: true });
}
