import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { notificationFeedQuerySchema } from "@/lib/validators/notification";
import {
  badCursor,
  getNotificationFeed,
  notificationsUserGate,
  parseCursor,
} from "@/features/notifications/server";

export const dynamic = "force-dynamic";

/** Мэдэгдлийн feed (0138, туг `notifications`) — шинэ нь эхэнд, cursor-оор. */
export async function GET(req: Request) {
  const gate = await notificationsUserGate();
  if ("response" in gate) return gate.response;

  const params = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = notificationFeedQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  const cursor = parseCursor(parsed.data.cursor);
  if (cursor === "invalid") return badCursor();

  try {
    const page = await getNotificationFeed(
      gate.admin,
      gate.user.id,
      cursor,
      parsed.data.limit,
    );
    return NextResponse.json(page, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: "notifications.feed" } });
    return NextResponse.json({ error: "SERVER" }, { status: 500 });
  }
}
