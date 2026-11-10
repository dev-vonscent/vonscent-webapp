import { HeadingSkeleton, SkeletonBlock } from "@/components/shared/skeletons";
import { CatalogBodySkeleton } from "@/features/catalog/components/catalog-body-skeleton";

/**
 * Catalogue: the page a visitor filters and re-filters, so it is navigated to
 * more than any other. Every change of brand, price or sort is a fresh server
 * render, and holding the sidebar and grid in place across those makes the
 * list feel filtered rather than reloaded.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-420 px-4 py-8 md:px-8">
      <HeadingSkeleton className="mb-6" />

      {/* Sort bar — desktop only */}
      <div className="hidden items-center justify-end py-2 lg:flex">
        <SkeletonBlock className="h-9 w-45" />
      </div>

      <CatalogBodySkeleton />
    </div>
  );
}
