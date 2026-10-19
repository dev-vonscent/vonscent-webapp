import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { notificationReadSchema } from "@/lib/validators/notification";
import { callRpc } from "@/lib/supabase/rpc";
import { notificationsUserGate } from "@/features/notifications/server";

export const dynamic = "force-dynamic";

/**
 * Уншсан болгох — `{ ids }` эсвэл `{ all: true }`. Хэрэглэгчийн id нь
 * SESSION-оос; RPC нь зөвхөн тухайн хэрэглэгчийн харагдаж буй мөрийг засна.
 */
export async function POST(req: Request) {
  const gate = await notificationsUserGate();
  if ("response" in gate) return gate.response;

  const parsed = notificationReadSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }

  const { data, error } = await callRpc<number>(
    gate.admin,
    "mark_notifications_read",
    {
      p_user: gate.user.id,
      p_ids: "ids" in parsed.data ? parsed.data.ids : null,
    },
  );
  if (error) {
    Sentry.captureException(new Error(error.message), {
      tags: { route: "notifications.read" },
    });
    return NextResponse.json({ error: "SERVER" }, { status: 500 });
  }
  return NextResponse.json({ updated: data ?? 0 });
}
