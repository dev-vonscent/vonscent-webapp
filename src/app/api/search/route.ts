import { NextResponse } from "next/server";
import { z } from "zod";
import { globalSearch } from "@/features/search/api";
import { isSearchable } from "@/lib/search";
import { EMPTY_SEARCH_RESULTS } from "@/features/search/types";
import { SEARCH_LIMIT_PER_KIND } from "@/lib/constants";

/**
 * Глобал хайлт — `/api/search?q=<текст>&limit=<n>`.
 *
 * Үр дүн нь төрлөөр бүлэглэгдсэн (бараа / багц / нийтлэл / брэнд). Шүүлт
 * бүхэлдээ Postgres дээр (features/search/api.ts), тул энэ маршрут ямар ч
 * жагсаалт санах ойд ачаалахгүй.
 *
 * Хариу нь хувь хүнд хамаарахгүй нийтийн өгөгдөл учир CDN-д богино хугацаагаар
 * кэшлэгдэнэ: нэг үг олон хүн бичихэд сан руу дахин очихгүй.
 */

const querySchema = z.object({
  q: z.string().max(100).default(""),
  limit: z.coerce.number().int().min(1).max(20).default(SEARCH_LIMIT_PER_KIND),
});

export async function GET(req: Request) {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { q, limit } = parsed.data;
  // Хэт богино үгэнд сан руу огт очихгүй — «бичсээр бай» гэсэн хариу.
  if (!isSearchable(q)) {
    return NextResponse.json({ results: EMPTY_SEARCH_RESULTS, tooShort: true });
  }

  const results = await globalSearch(q, limit);
  return NextResponse.json(
    { results, tooShort: false },
    {
      headers: {
        "Cache-Control":
          "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
