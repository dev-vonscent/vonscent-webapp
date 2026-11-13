import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { env } from "@/lib/env";
import { revalidatePublic } from "@/lib/cache";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Арга хэмжээ (0181) ба нүүрний hero (0182)-гийн эхлэх / дуусах мөч (plan §10). Үнэ нь DB-д секундын
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
  const [eventsOn, heroesOn] = await Promise.all([
    isFeatureEnabled("sale_events"),
    isFeatureEnabled("hero_admin"),
  ]);
  if (!eventsOn && !heroesOn) {
    return NextResponse.json({ ok: true, skipped: "FEATURE_DISABLED" });
  }
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ ok: true, skipped: "NO_DB" });

  const now = Date.now();
  const from = new Date(now - WINDOW_MS).toISOString();
  const to = new Date(now).toISOString();
  const boundary = `and(starts_at.gt.${from},starts_at.lte.${to}),and(ends_at.gt.${from},ends_at.lte.${to})`;
  // Арга хэмжээ (hero-той холбоотой нь ч мөн эндээс) ба өөрийн хугацаатай
  // hero (0182) — аль нэг нь хил давсан бол.
  const checks = await Promise.all([
    eventsOn
      ? supabase.from("sale_events").select("id").eq("is_active", true).or(boundary).limit(1)
      : null,
    heroesOn
      ? supabase.from("heroes").select("id").eq("is_active", true).or(boundary).limit(1)
      : null,
  ]);
  let changed = false;
  for (const res of checks) {
    if (!res) continue;
    if (res.error) {
      Sentry.captureException(new Error(`cron sale-events: ${res.error.message}`));
      return NextResponse.json({ error: "DB" }, { status: 500 });
    }
    if ((res.data?.length ?? 0) > 0) changed = true;
  }
  if (changed) revalidatePublic();
  return NextResponse.json({ ok: true, revalidated: changed });
}
