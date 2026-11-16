import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { cronGuard } from "@/lib/cron-auth";
import { revalidateStock } from "@/lib/cache";

/**
 * Хямдралын хилийн шөнийн кэш цэвэрлэгч (vercel.json → УБ 00:01, 00:04).
 *
 * **Яагаад.** Үнэ харуулдаг хуудсууд (нүүр, бараа, багц) ISR-ээр 1 цаг
 * кэшлэгддэг. Хугацаатай хямдрал (0166) `isSaleActive(now)`-оор цагаас
 * хамаарч эхэлж/дуусдаг ч тэр мөчид ямар ч бичилт болдоггүй — кэшийг хэн ч
 * цэвэрлэхгүй тул хямдрал 1 цаг хоцорч гарах/алга болох байсан.
 *
 * **Яагаад шөнө дунд.** Админ хямдралын хугацааг өдрөөр сонгодог:
 * `dayStartIso` = УБ 00:00:00.000, `dayEndIso` = УБ 23:59:59.999
 * (`features/admin/lib/date-range.ts`). Тэгэхээр хил үргэлж УБ-ын шөнө дунд.
 *
 * Хил өнгөрсөн `WINDOW_MINUTES` дотор байвал л цэвэрлэнэ — хямдралгүй шөнө
 * кэш хөндөгдөхгүй. Хоёр дахь ажиллалт (00:04) нь эхнийх алгассан үеийн
 * нөөц; хоёулаа хил олбол хоёр удаа цэвэрлэнэ, хор хөнөөлгүй.
 *
 * Checkout-ийн дүнд нөлөөгүй: үнийг сервер захиалгын мөчид дахин боддог
 * (`place_order` → SQL `variant_price()`), энэ нь зөвхөн харагдах үнэ.
 */

/**
 * Хэдэн минутын өмнөх хилийг барих вэ. 00:01-ийн ажиллалтад 23:59:59.999-ийн
 * төгсгөл ~1 мин, 00:04-д ~4 мин өмнө — 10 мин нь cron хэдэн минут хоцорсон ч
 * хоёуланг нь багтаана.
 */
const WINDOW_MINUTES = 10;

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = cronGuard(req);
  if (denied) return denied;

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ ok: true, skipped: "NO_DB" });

  const now = new Date();
  const to = now.toISOString();
  const from = new Date(
    now.getTime() - WINDOW_MINUTES * 60 * 1000,
  ).toISOString();

  // Эхлэл, төгсгөл тус тусдаа — `.or()`-ийн raw PostgREST синтаксд ISO
  // огнооны `.` / `:`-ийг escape хийх шаардлагагүй.
  const boundary = (column: "sale_starts_at" | "sale_ends_at") =>
    supabase
      .from("product_variants")
      .select("id")
      .eq("is_active", true)
      .gte(column, from)
      .lte(column, to)
      .limit(1);

  const [starts, ends] = await Promise.all([
    boundary("sale_starts_at"),
    boundary("sale_ends_at"),
  ]);

  const error = starts.error ?? ends.error;
  if (error) {
    // Мэдэхгүй байхад кэшийг «ямар ч байсан» цэвэрлэхгүй — алдааг л мэдэгдэнэ.
    Sentry.captureException(new Error(`midnight-revalidate: ${error.message}`));
    return NextResponse.json({ error: "QUERY_FAILED" }, { status: 500 });
  }

  const hit = (starts.data?.length ?? 0) > 0 || (ends.data?.length ?? 0) > 0;
  if (hit) revalidateStock();
  return NextResponse.json({ ok: true, revalidated: hit });
}
