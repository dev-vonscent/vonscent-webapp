import { NextResponse } from "next/server";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { SALE_EVENT_SLUG_RE } from "@/lib/validators/sale-event";

/**
 * Арга хэмжээний богино хаяг — `/sale/black-friday` (сошиал пост, сторид).
 * Тусдаа хуудас БИШ (plan §6.2): бүх төлөвийг (явж байгаа / эхлээгүй /
 * дууссан) каталог өөрөө `?event=`-ээр харуулна. Slug жил бүр дахин
 * ашиглагддаг тул нэг хаяг жилээс жилд ажилласаар.
 *
 * Route handler (хуудас биш): shop layout stream эхлүүлсний дараах
 * `redirect()` нь 200 + meta refresh болдог — энд жинхэнэ 307.
 * Туг хаалттай бол энгийн каталог руу (404 биш — хаяг тараагдсан байж болно).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const on =
    SALE_EVENT_SLUG_RE.test(slug) && (await isFeatureEnabled("sale_events"));
  const target = on ? `/catalog?event=${slug}` : "/catalog";
  return NextResponse.redirect(new URL(target, req.url), 307);
}
