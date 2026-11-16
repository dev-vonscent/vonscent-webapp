import { notFound } from "next/navigation";
import { getCollectionBySlug } from "@/features/collections/api";

/**
 * Байхгүй багцын slug → 404 статус (`products/[slug]/layout.tsx`-ийг үз).
 * «Багц олдсонгүй» хуудас нь `collections/not-found.tsx` — layout-д шидсэн
 * `notFound()`-ийг эцэг сегментийн boundary барина. `/collections`
 * жагсаалтын `loading.tsx` нь `(list)` бүлэгт: энэ layout-ыг Suspense-ээр
 * ороохгүйн тулд.
 */
export default async function CollectionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!(await getCollectionBySlug(slug))) notFound();
  return children;
}
