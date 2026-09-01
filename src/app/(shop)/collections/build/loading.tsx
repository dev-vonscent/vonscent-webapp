import {
  ProductGridSkeleton,
  SkeletonBlock,
} from "@/components/shared/skeletons";

/**
 * Багц угсрах — a filter sidebar beside a picker grid, nothing like the card
 * grid on `/collections`. Without this it inherited that parent skeleton and
 * drew collection cards over a page that has none.
 */
export default function Loading() {
  return (
    <div
      className="mx-auto max-w-352 px-4 py-6 md:px-8"
      role="status"
      aria-label="Багц угсрагч ачаалж байна"
    >
      <SkeletonBlock className="mb-4 h-8 w-44" />

      <div className="flex items-center gap-2 py-3 lg:hidden">
        <SkeletonBlock className="h-10 w-24" />
        <SkeletonBlock className="size-10" />
        <SkeletonBlock className="h-10 flex-1" />
      </div>

      <div className="mt-6 flex gap-10 lg:mt-8">
        {/* The builder's sidebar is wider than the catalogue's (w-96). */}
        <aside className="hidden w-96 shrink-0 space-y-6 lg:block">
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
          <ProductGridSkeleton count={9} />
        </div>
      </div>
    </div>
  );
}
