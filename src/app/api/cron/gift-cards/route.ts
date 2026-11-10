import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { retryPendingGiftCardEmails } from "@/features/gift-cards/email";

/**
 * Бэлгийн картын имэйлийн хуваарь (gift-cards-plan §6.4): төлбөрийн дараа
 * унасан илгээлтийг дахин оролдоно (`send_count` < 5). Туг хаалттай бол юу ч
 * хийхгүй. Хугацаа дуусгах нь pg_cron (`expire_gift_cards`, 0179).
 */
export const dynamic = "force-dynamic";

function authorised(req: Request): boolean {
  if (!env.cronSecret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${env.cronSecret}`;
  if (header.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

export async function GET(req: Request) {
  if (!env.cronSecret) {
    return NextResponse.json({ error: "CRON_NOT_CONFIGURED" }, { status: 503 });
  }
  if (!authorised(req)) {
    return NextResponse.json({ error: "UNAUTHORISED" }, { status: 401 });
  }
  if (!(await isFeatureEnabled("gift_cards"))) {
    return NextResponse.json({ ok: true, skipped: "FEATURE_DISABLED" });
  }
  const sent = await retryPendingGiftCardEmails();
  return NextResponse.json({ ok: true, sent });
}
