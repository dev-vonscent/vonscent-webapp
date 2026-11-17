import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { cronGuard } from "@/lib/cron-auth";
import { revalidateStock } from "@/lib/cache";

/**
 * Нөөцийн хугацаа дууссан захиалгын дараах кэш цэвэрлэгч
 * (vercel.json → 5 минут тутам, pg_cron-оос 2 минутын дараа).
 *
 * **Яагаад.** Төлөгдөөгүй захиалгын нөөцийг pg_cron `release_expired_reserves`
 * (`*\/5`) → `abandon_unpaid_order` апп-гүйгээр чөлөөлдөг — `revalidateStock()`
 * дуудагдахгүй. Захиалга үүсэхэд кэш «Дууссан» болж цэвэрлэгдсэн бол ml
 * буцаж ирсэн ч бараа ISR-ийн цонх (1 цаг) дуустал дууссан харагдана.
 *
 * Системийн цуцлалт (`changed_by` null) өнгөрсөн `WINDOW_MINUTES`-д байвал
 * л цэвэрлэнэ. Апп талын цуцлалт аль хэдийн өөрөө цэвэрлэсэн; давхардвал хор
 * хөнөөлгүй.
 */

/** pg_cron 5 минут тутам — 10 минут нь нэг ажиллалт алгасагдсан ч барина. */
const WINDOW_MINUTES = 10;

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = cronGuard(req);
  if (denied) return denied;

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ ok: true, skipped: "NO_DB" });

  const from = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("order_status_history")
    .select("id")
    .eq("status", "cancelled")
    .is("changed_by", null)
    .gte("created_at", from)
    .limit(1);

  if (error) {
    Sentry.captureException(
      new Error(`expired-reserves-revalidate: ${error.message}`),
    );
    return NextResponse.json({ error: "QUERY_FAILED" }, { status: 500 });
  }

  const hit = (data?.length ?? 0) > 0;
  if (hit) revalidateStock();
  return NextResponse.json({ ok: true, revalidated: hit });
}
