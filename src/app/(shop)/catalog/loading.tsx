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
    <div className="mx-auto max-w-352 px-4 py-8 md:px-8">
      <HeadingSkeleton className="mb-6" />

      {/* Tabs + sort bar */}
      <div className="flex items-center gap-6 py-2">
        <SkeletonBlock className="h-4 w-16" />
        <SkeletonBlock className="h-4 w-24" />
        <SkeletonBlock className="ml-auto hidden h-9 w-45 lg:block" />
      </div>

      <CatalogBodySkeleton />
    </div>
  );
}
