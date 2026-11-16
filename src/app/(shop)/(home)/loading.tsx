import { HomeSkeleton } from "@/components/shared/skeletons";

/**
 * The home page's navigation boundary.
 *
 * In practice this segment has exactly one page of its own — every other shop
 * route (каталог, бүтээгдэхүүн, багц, блог, сагс, тооцоо…) ships a `loading.tsx`
 * beside its own `page.tsx`, so nothing else falls back here. A new shop route
 * must bring its own skeleton rather than inherit this one.
 *
 * It used to draw a centred spinner, which read as a stall on a page that is
 * mostly static: the hero and the category grids need no database at all. The
 * page now streams — its shell paints immediately and each rail arrives under
 * its own Suspense skeleton — so this boundary only covers the RSC round-trip,
 * and drawing the shape that is coming beats a spinning circle.
 */
export default function Loading() {
  return <HomeSkeleton />;
}
