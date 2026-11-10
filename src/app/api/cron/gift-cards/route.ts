import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { isFeatureEnabled } from "@/lib/feature-flags";
import {
  retryBuyerReceipts,
  retryPendingGiftCardEmails,
  sendGiftCardReminders,
} from "@/features/gift-cards/email";

/**
 * Бэлгийн картын имэйлийн хуваарь (gift-cards-plan §6.4): төлбөрийн дараа
 * унасан ба товлосон илгээлт (`send_count` < 5), мөн сануулга (§6.3: 7 хоног
 * ашиглаагүй, хугацаа 30 / 7 хоног — УБ 09–20 цагт). Туг хаалттай бол юу ч
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
  // Эрэмбэ: хүлээн авагчийн бэлэг → худалдан авагчийн баримт → сануулга
  // (өдрийн имэйлийн хязгаарт хүрвэл чухал нь түрүүлж явна).
  const sent = await retryPendingGiftCardEmails();
  const receipts = await retryBuyerReceipts();
  const reminded = await sendGiftCardReminders();
  return NextResponse.json({ ok: true, sent, receipts, reminded });
}
