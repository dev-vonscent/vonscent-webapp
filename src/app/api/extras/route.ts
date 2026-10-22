import { NextResponse } from "next/server";
import { z } from "zod";
import { getShopExtra, getShopExtras } from "@/features/extras/api";
import { isFeatureEnabled } from "@/lib/feature-flags";

const slugSchema = z.string().trim().min(1).max(200);

/**
 *   /api/extras             → сагсны «Захиалгаа гүйцээх» — гоёмсог бэлгийн
 *                             сав (хайрцаг, уут; зарагдаж буй)
 *   /api/extras?slug=<slug> → нэг бараа хувилбартайгаа (картын «Сагсанд
 *                             нэмэх» цонх)
 * Туг хаалттай бол 404.
 */
export async function GET(req: Request) {
  if (!(await isFeatureEnabled("extras_shop"))) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const rawSlug = new URL(req.url).searchParams.get("slug");
  if (rawSlug !== null) {
    const slug = slugSchema.safeParse(rawSlug);
    if (!slug.success) {
      return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
    }
    const extra = await getShopExtra(slug.data);
    if (!extra) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ extra });
  }

  const items = (await getShopExtras())
    .filter(
      (e) =>
        // «Брэндийн уут» нь «Гоёмсог бэлгийн сав»-д нэгдсэн (0153).
        !e.soldOut && e.categorySlug === "gift-box",
    )
    .slice(0, 8);
  return NextResponse.json(
    { items },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
