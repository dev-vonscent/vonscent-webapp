import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { env } from "@/lib/env";
import { revalidatePublic } from "@/lib/cache";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Арга хэмжээний эхлэх / дуусах мөч (plan §10). Үнэ нь DB-д секундын
 * нарийвчлалтай солигддог ч тэр мөчид бичилт байхгүй тул `revalidatePublic()`
 * дуудагдахгүй — ISR (60с) + `unstable_cache` (60с) нь chip, badge, зурвасыг
 * 2 мин хүртэл хоцроох байв. Vercel cron минут тутам: сүүлийн хоёр минутад
 * эхэлсэн/дууссан идэвхтэй арга хэмжээ байвал нийтийн кэшийг цэвэрлэнэ
 * (давхцсан цонх — алгасагдсан дуудлагыг нөхнө; давхар цэвэрлэх нь хор хөнөөлгүй).
 */
export const dynamic = "force-dynamic";

const WINDOW_MS = 120_000;

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
  if (!(await isFeatureEnabled("sale_events"))) {
    return NextResponse.json({ ok: true, skipped: "FEATURE_DISABLED" });
  }
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ ok: true, skipped: "NO_DB" });

  const now = Date.now();
  const from = new Date(now - WINDOW_MS).toISOString();
  const to = new Date(now).toISOString();
  const { data, error } = await supabase
    .from("sale_events")
    .select("id")
    .eq("is_active", true)
    .or(
      `and(starts_at.gt.${from},starts_at.lte.${to}),and(ends_at.gt.${from},ends_at.lte.${to})`,
    )
    .limit(1);
  if (error) {
    Sentry.captureException(new Error(`cron sale-events: ${error.message}`));
    return NextResponse.json({ error: "DB" }, { status: 500 });
  }
  const changed = (data?.length ?? 0) > 0;
  if (changed) revalidatePublic();
  return NextResponse.json({ ok: true, revalidated: changed });
}
