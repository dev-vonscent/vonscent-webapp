import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import {
  badCursor,
  notificationsUserGate,
  parseCursor,
  pollNotifications,
} from "@/features/notifications/server";

export const dynamic = "force-dynamic";

/**
 * Хонхны poll (60с + window focus) — уншаагүйн тоо ба cursor-оос 10 мин
 * ухарсан цонхны уншаагүй мөрүүд (toast; давхардлыг клиент id-аар шүүнэ).
 * Cursor-гүй анхны дуудлага ч цонхыг буцаана — клиент toast болгохгүй,
 * зөвхөн «үзүүлсэн» гэж тэмдэглэнэ.
 */
export async function GET(req: Request) {
  const gate = await notificationsUserGate();
  if ("response" in gate) return gate.response;

  const raw = new URL(req.url).searchParams.get("cursor");
  if (raw && raw.length > 200) return badCursor();
  const cursor = parseCursor(raw);
  if (cursor === "invalid") return badCursor();

  try {
    const poll = await pollNotifications(gate.admin, gate.user.id, cursor);
    return NextResponse.json(poll, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: "notifications.poll" } });
    return NextResponse.json({ error: "SERVER" }, { status: 500 });
  }
}
