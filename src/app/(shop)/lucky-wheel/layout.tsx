import { notFound } from "next/navigation";
import { isFeatureEnabled } from "@/lib/feature-flags";

/**
 * Туг (`lucky_wheel`) хаалттай → 404 статус (CLAUDE.md: route-д 404). Хуудасны
 * өөрийн шалгалт хажуугийн `loading.tsx`-ийн Suspense дотор тул 200
 * буцаадаг байв; layout нь тэр boundary-ээс дээр.
 */
export default async function LuckyWheelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isFeatureEnabled("lucky_wheel"))) notFound();
  return children;
}
