import { NextResponse } from "next/server";
import { getShopExtras } from "@/features/extras/api";
import { isFeatureEnabled } from "@/lib/feature-flags";

/**
 * Сагсны «Захиалгаа гүйцээх» — бэлгийн хайрцаг, брэндийн уут (зарагдаж
 * буй). Туг хаалттай бол 404.
 */
export async function GET() {
  if (!(await isFeatureEnabled("extras_shop"))) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const items = (await getShopExtras())
    .filter(
      (e) =>
        !e.soldOut &&
        (e.categorySlug === "gift-box" || e.categorySlug === "brand-pouch"),
    )
    .slice(0, 8);
  return NextResponse.json(
    { items },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
