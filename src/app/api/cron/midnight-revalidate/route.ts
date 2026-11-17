import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { cronGuard } from "@/lib/cron-auth";
import { revalidateHero, revalidatePublic, revalidateStock } from "@/lib/cache";
import { isFeatureEnabled } from "@/lib/feature-flags";
import {
  seasonBoundaryWithin,
  type SeasonRowLike,
} from "@/features/heroes/season";

/**
 * Шөнийн кэш цэвэрлэгч (vercel.json → УБ 00:01, 00:04).
 *
 * **Яагаад.** Үнэ, арга хэмжээ, hero харуулдаг хуудсууд ISR-ээр 1 цаг
 * кэшлэгддэг. Доорх хилүүд цагаас хамаарч солигддог ч тэр мөчид ямар ч
 * бичилт болдоггүй — кэшийг хэн ч цэвэрлэхгүй тул 1 цаг хоцрох байсан.
 *
 * **Яагаад шөнө дунд.** Бүх хил өдрөөр, УБ 00:00 дээр:
 *  - хэмжээ бүрийн хугацаатай хямдрал (0166) — `sale_starts_at` /
 *    `sale_ends_at`, админ өдрөөр сонгоно;
 *  - арга хэмжээ (0181) — `startsOn`/`endsOn` нь `YYYY-MM-DD` (Zod),
 *    `dayStartIso` = УБ 00:00, `dayEndIso` = дараагийн өдрийн УБ 00:00
 *    (exclusive) — `features/sale-events/server.ts`;
 *  - өөрийн хугацаатай hero (0182) — мөн адил (`features/heroes/server.ts`);
 *    арга хэмжээтэй холбоотой hero нь арга хэмжээний хугацааг авна;
 *  - улирлын баннер (0185) — `season_start_md`-ийн УБ 00:00 (`ubMidnight`).
 * Өмнө нь арга хэмжээ / hero-д минут тутмын `/api/cron/sale-events` байсан —
 * өдөрт 1440 дуудлага, хил нь зөвхөн шөнө дунд.
 *
 * **Хүрээ** — хил тус бүрт хамгийн бага хэрнээ зөв:
 *  - хэмжээний хямдрал → `revalidateStock()` (үнэ харуулдаг хуудсууд);
 *  - арга хэмжээ → `revalidatePublic()`: зурвас (ticker) `(shop)/layout`-д
 *    тул дэлгүүрийн БҮХ хуудсанд, үнэ (`variant_price`) каталогийн
 *    `catalog` кэшид. Сард хэдхэн шөнө л тохиолдоно;
 *  - hero / улирал → `revalidateHero()` — зөвхөн нүүр.
 * Хил өнгөрсөн `WINDOW_MINUTES` дотор байвал л цэвэрлэнэ — хилгүй шөнө кэш
 * хөндөгдөхгүй. 00:04-ийн ажиллалт нь эхнийх алгассан үеийн нөөц; давхар
 * цэвэрлэх нь хор хөнөөлгүй.
 *
 * Туг (`sale_events`, `hero_admin`) хаалттай бол тэр хүснэгтийг асуухгүй.
 * Checkout-ийн дүнд нөлөөгүй: үнийг сервер захиалгын мөчид дахин боддог.
 */

/**
 * Хэдэн минутын өмнөх хилийг барих вэ. 00:01-ийн ажиллалтад 23:59:59.999-ийн
 * төгсгөл ~1 мин, 00:04-д ~4 мин өмнө — 10 мин нь cron хэдэн минут хоцорсон ч
 * хоёуланг нь багтаана.
 */
const WINDOW_MINUTES = 10;

export const dynamic = "force-dynamic";

type Hit = { data: unknown[] | null; error: { message: string } | null };

/** `heroes`-ийн улирлын мөр (0185) — `SeasonRowLike`-ийн сангийн хэлбэр. */
interface SeasonRow {
  id: string;
  season: SeasonRowLike["season"];
  season_start_md: string | null;
  is_active: boolean;
  desktop_image: SeasonRowLike["desktopImage"];
  mobile_image: SeasonRowLike["mobileImage"];
}

export async function GET(req: Request) {
  const denied = cronGuard(req);
  if (denied) return denied;

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ ok: true, skipped: "NO_DB" });

  const [eventsOn, heroesOn] = await Promise.all([
    isFeatureEnabled("sale_events"),
    isFeatureEnabled("hero_admin"),
  ]);

  const nowMs = Date.now();
  const to = new Date(nowMs).toISOString();
  const from = new Date(nowMs - WINDOW_MINUTES * 60 * 1000).toISOString();

  // Эхлэл, төгсгөл тус тусдаа — `.or()`-ийн raw PostgREST синтаксд ISO
  // огнооны `.` / `:`-ийг escape хийх шаардлагагүй.
  const boundary = (
    table: "product_variants" | "sale_events" | "heroes",
    column: string,
  ): PromiseLike<Hit> =>
    supabase
      .from(table)
      .select("id")
      .eq("is_active", true)
      .gte(column, from)
      .lte(column, to)
      .limit(1);
  const none: Hit = { data: [], error: null };

  const [
    sizeStart,
    sizeEnd,
    eventStart,
    eventEnd,
    heroStart,
    heroEnd,
    seasons,
  ] = await Promise.all([
    boundary("product_variants", "sale_starts_at"),
    boundary("product_variants", "sale_ends_at"),
    eventsOn ? boundary("sale_events", "starts_at") : none,
    eventsOn ? boundary("sale_events", "ends_at") : none,
    heroesOn ? boundary("heroes", "starts_at") : none,
    heroesOn ? boundary("heroes", "ends_at") : none,
    heroesOn
      ? supabase
          .from("heroes")
          .select(
            "id, season, season_start_md, is_active, desktop_image, mobile_image",
          )
          .not("season", "is", null)
      : { data: [], error: null },
  ]);

  const error = [
    sizeStart,
    sizeEnd,
    eventStart,
    eventEnd,
    heroStart,
    heroEnd,
    seasons,
  ].find((r) => r.error)?.error;
  if (error) {
    // Мэдэхгүй байхад кэшийг «ямар ч байсан» цэвэрлэхгүй — алдааг л мэдэгдэнэ.
    Sentry.captureException(new Error(`midnight-revalidate: ${error.message}`));
    return NextResponse.json({ error: "QUERY_FAILED" }, { status: 500 });
  }

  const any = (...rs: Hit[]) => rs.some((r) => (r.data?.length ?? 0) > 0);
  const size = any(sizeStart, sizeEnd);
  const events = any(eventStart, eventEnd);
  const seasonRows = (seasons.data ?? []) as SeasonRow[];
  const season = seasonBoundaryWithin(
    seasonRows.map((r) => ({
      id: r.id,
      season: r.season,
      seasonStartMd: r.season_start_md,
      isActive: r.is_active,
      desktopImage: r.desktop_image,
      mobileImage: r.mobile_image,
    })),
    nowMs,
    WINDOW_MINUTES * 60 * 1000,
  );
  const hero = any(heroStart, heroEnd) || season;

  // `revalidatePublic()` нь бусад хоёрыг хамардаг.
  if (events) revalidatePublic();
  else {
    if (size) revalidateStock();
    if (hero) revalidateHero();
  }

  const revalidated = size || events || hero;
  return NextResponse.json({
    ok: true,
    revalidated,
    ...(revalidated ? { scope: { size, events, hero } } : {}),
  });
}
