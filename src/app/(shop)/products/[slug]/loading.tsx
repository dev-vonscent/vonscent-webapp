import { SkeletonBlock } from "@/components/shared/skeletons";


/**
 * Product detail. The gallery is the heaviest thing the storefront loads, so
 * this reserves its square and the buying column beside it — without that the
 * price and size buttons would be pushed down the page as the image arrives,
 * which is the one moment a visitor is about to tap.
 */
export default function Loading() {
  return (
    <div
      className="mx-auto max-w-352 p-4 sm:py-8 md:px-8"
      role="status"
      aria-label="Бараа ачаалж байна"
    >
      <SkeletonBlock className="mb-6 hidden h-4 w-64 opacity-60 sm:block" />

      <div className="grid gap-0 sm:gap-10 lg:grid-cols-2 lg:items-start">
        <SkeletonBlock className="aspect-square w-full rounded-2xl" />

        <div className="space-y-10 pt-8 sm:pt-0">
          <div className="space-y-6">
            <div className="space-y-3">
              <SkeletonBlock className="h-3.5 w-24" />
              <SkeletonBlock className="h-9 w-3/4" />
              <SkeletonBlock className="h-4 w-full max-w-prose" />
            </div>
            {/* Size buttons + price */}
            <div className="flex gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonBlock key={i} className="h-16 flex-1 rounded-lg" />
              ))}
            </div>
            <SkeletonBlock className="h-12 w-full rounded-lg" />
          </div>

          {/* Notes panel */}
          <div className="bg-secondary grid grid-cols-1 gap-4 rounded-lg p-5 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <SkeletonBlock className="h-3 w-16" />
                <SkeletonBlock className="h-4 w-full" />
              </div>
            ))}
          </div>

          {/* Description accordions */}
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
