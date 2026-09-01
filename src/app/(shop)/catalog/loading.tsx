import {
  HeadingSkeleton,
  ProductGridSkeleton,
  SkeletonBlock,
} from "@/components/shared/skeletons";


/**
 * Catalogue: the page a visitor filters and re-filters, so it is navigated to
 * more than any other. Every change of brand, price or sort is a fresh server
 * render, and holding the sidebar and grid in place across those makes the
 * list feel filtered rather than reloaded.
 */
export default function Loading() {
  return (
    <div
      className="mx-auto max-w-352 px-4 py-8 md:px-8"
      role="status"
      aria-label="Каталог ачаалж байна"
    >
      <HeadingSkeleton className="mb-6" />

      {/* Mobile control strip */}
      <div className="flex items-center gap-2 py-3 lg:hidden">
        <SkeletonBlock className="h-10 w-24" />
        <SkeletonBlock className="size-10 " />
        <SkeletonBlock className="h-10 flex-1" />
      </div>

      <div className="mt-6 flex gap-10 lg:mt-8">
        <aside className="hidden w-72 shrink-0 space-y-6 lg:block">
          <SkeletonBlock className="h-10 w-full" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <SkeletonBlock className="h-4 w-24" />
              {Array.from({ length: 4 }).map((__, j) => (
                <SkeletonBlock key={j} className="h-3.5 w-full" />
              ))}
            </div>
          ))}
        </aside>

        <div className="flex-1">
          <div className="mb-4 hidden justify-end lg:flex">
            <SkeletonBlock className="h-9 w-40" />
          </div>
          <ProductGridSkeleton count={12} />
        </div>
      </div>
    </div>
  );
}
