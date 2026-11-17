import { notFound } from "next/navigation";
import { getShopExtra } from "@/features/extras/api";
import { isFeatureEnabled } from "@/lib/feature-flags";

/**
 * Туг хаалттай эсвэл байхгүй slug → 404 статус (#281-ийн арга,
 * `products/[slug]/layout.tsx`-ийг үз).
 *
 * Хуудас өөрөө `notFound()` дууддаг ч тэр нь хажуугийн `loading.tsx`-ийн
 * Suspense дотор — хариуны толгой (200) аль хэдийн явсан тул soft 404 болж,
 * ISR-д 200-аар кэшлэгддэг байв. Layout нь тэр boundary-ээс ДЭЭР. Туг эхэнд:
 * хаалттай үед сан асуухгүй. `getShopExtra` нь request-scoped `cache` —
 * хуудас ба metadata-тай нэг RPC.
 */
export default async function ExtraLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  if (!(await isFeatureEnabled("extras_shop"))) notFound();
  const { slug } = await params;
  if (!(await getShopExtra(slug))) notFound();
  return children;
}
