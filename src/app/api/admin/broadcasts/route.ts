import { NextResponse } from "next/server";
import { broadcastInputSchema } from "@/lib/validators/notification";
import {
  badRequest,
  broadcastAdminGate,
  getBroadcastsAdmin,
  serverError,
  toBroadcastColumns,
} from "@/features/notifications/broadcast-server";

export const dynamic = "force-dynamic";

/** Жагсаалт + уншсан тоо + нийт хүлээн авагч (профайлын тоо). */
export async function GET() {
  const gate = await broadcastAdminGate();
  if ("response" in gate) return gate.response;
  try {
    return NextResponse.json(await getBroadcastsAdmin(gate.supabase));
  } catch (err) {
    return serverError(err, "admin.broadcasts.list");
  }
}

/** Draft үүсгэх. Илгээх нь тусдаа (`/:id/send`). */
export async function POST(req: Request) {
  const gate = await broadcastAdminGate();
  if ("response" in gate) return gate.response;

  const parsed = broadcastInputSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) return badRequest();
  const cols = toBroadcastColumns(parsed.data);
  if (!cols.ok) return badRequest("Зургийг дахин байршуулна уу.");

  const { data, error } = await gate.supabase
    .from("notification_broadcasts")
    .insert({ ...cols.columns, status: "draft", created_by: gate.staff.id })
    .select("id")
    .single();
  if (error)
    return serverError(new Error(error.message), "admin.broadcasts.create");
  return NextResponse.json({ ok: true, id: (data as { id: string }).id });
}
