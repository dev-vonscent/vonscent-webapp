import { notFound } from "next/navigation";
import { getProductPageBySlug } from "@/features/products/api";

/**
 * Байхгүй барааны slug → 404 статус.
 *
 * Хуудас өөрөө `notFound()` дууддаг ч тэр нь хажуугийн `loading.tsx`-ийн
 * Suspense дотор — хариуны толгой (200) аль хэдийн явсан байдаг тул soft 404
 * болж, ISR-д 200-аар кэшлэгддэг байв. Layout нь тэр boundary-ээс ДЭЭР тул
 * энд шидсэн `notFound()` жинхэнэ 404 өгнө. `getProductPageBySlug` нь
 * request-scoped `cache` — хуудас ба metadata-тай нэг л query.
 */
export default async function ProductLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!(await getProductPageBySlug(slug))) notFound();
  return children;
}
