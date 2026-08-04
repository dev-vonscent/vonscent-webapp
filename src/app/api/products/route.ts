import { NextResponse } from "next/server";
import {
  getProductsByIds,
  getProductDetailsByIds,
  getCatalog,
  getProductBySlug,
} from "@/features/products/api";

/**
 * Public product data for client components.
 *   /api/products?slug=<slug>            → one product (detail shape, with variants)
 *   /api/products?ids=<uuid>,<uuid>      → those products (list shape)
 *   /api/products?ids=<uuid>&details=1   → those products (detail shape, variants)
 *   /api/products?q=<text>&limit=<n>     → type-ahead search (list shape)
 *   /api/products                        → full catalogue (list shape)
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;

  const q = params.get("q");
  if (q != null) {
    const term = q.trim();
    if (!term) return NextResponse.json({ items: [] });
    const limit = Math.min(Number(params.get("limit")) || 6, 20);
    const { items } = await getCatalog({ search: term, perPage: limit });
    return NextResponse.json({ items });
  }

  const slug = params.get("slug");
  if (slug) {
    const product = await getProductBySlug(slug);
    if (!product) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ product });
  }

  const ids = params.get("ids");
  if (ids) {
    const idList = ids.split(",").filter(Boolean);
    if (params.get("details")) {
      const items = await getProductDetailsByIds(idList);
      return NextResponse.json({ items });
    }
    const items = await getProductsByIds(idList);
    return NextResponse.json({ items });
  }

  const { items } = await getCatalog({ perPage: 200 });
  return NextResponse.json({ items });
}
