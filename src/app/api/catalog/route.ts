import { NextResponse } from "next/server";
import { z } from "zod";
import { getCatalog } from "@/features/products/api";
import { parseFilters } from "@/features/catalog/parse";
import { CATALOG_PAGE_SIZE } from "@/lib/constants";

/**
 * Каталогийн дараагийн ачаалалт — `/api/catalog?<шүүлтүүр>&page=<n>`.
 *
 * Каталог хуудас эхний 24-ийг серверээр зурдаг; доош гүйлгэхэд дараагийнх нь
 * эндээс ирнэ. Шүүлтүүрийн утгуудыг `parseFilters` хуудастай яг адилаар
 * уншдаг тул хоёр зам хэзээ ч өөр үр дүн өгөхгүй. Хуудасны хэмжээ серверт
 * тогтмол — клиент `perPage` дамжуулж бүх каталогийг нэг дор татах боломжгүй.
 *
 * Хариу нь нийтийн өгөгдөл: CDN-д богино хугацаагаар кэшлэгдэнэ.
 */

const querySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(1000).default(1),
    q: z.string().max(100).optional(),
  })
  .passthrough();

export async function GET(req: Request) {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const result = await getCatalog({
    ...parseFilters(params),
    page: parsed.data.page,
    perPage: CATALOG_PAGE_SIZE,
  });
  return NextResponse.json(result, {
    headers: {
      "Cache-Control":
        "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
