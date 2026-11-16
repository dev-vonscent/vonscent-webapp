import { notFound } from "next/navigation";
import { CONTENT_PAGES_HIDDEN } from "@/lib/constants";

/**
 * Нуугдсан хуудас (CONTENT_PAGES_HIDDEN) → 404 статус. Хуудасны өөрийн
 * шалгалт хажуугийн `loading.tsx`-ийн Suspense дотор тул 200 буцаадаг байв;
 * layout нь тэр boundary-ээс дээр.
 */
export default function HiddenContentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (CONTENT_PAGES_HIDDEN) notFound();
  return children;
}
