import { SkeletonBlock } from "@/components/shared/skeletons";

/**
 * Багц угсрах — a filter sidebar beside a picker grid, nothing like the card
 * grid on `/collections`. Without this it inherited that parent skeleton and
 * drew collection cards over a page that has none.
 *
 * Three things this has to get right, because each of them moved the page
 * under the visitor when it was wrong. All three are measured against the real
 * builder rather than guessed:
 *
 *  - The **selection tray**: a sticky card at the top of the product column —
 *    size pills, running count and price, the picked scents, the create button.
 *    264px on a phone, 224px once its actions sit on one row. Leaving it out
 *    meant the grid started at the top and then dropped by that much.
 *  - The **grid's breakpoints**: the builder goes 2 / 3 (sm) / 4 (xl) with a
 *    uniform `gap-4`. The shared `ProductGridSkeleton` goes 2 / 3 (md) / 4 (lg)
 *    with `gap-y-8`, so two whole ranges of screen width drew the wrong number
 *    of columns, at the wrong vertical rhythm.
 *  - The **card's caption**: three lines at `mt-2 gap-0.5`, not the catalogue
 *    card's roomier block.
 */
export default function Loading() {
  return (
    <div
      className="mx-auto max-w-352 px-4 py-6 md:px-8"
      role="status"
      aria-label="Багц угсрагч ачаалж байна"
    >
      <SkeletonBlock className="mb-4 h-8 w-44 sm:h-9" />

      {/* `border-y` reproduces the real strip's 2px of box height; the colour
          is transparent app-wide, the space is not. */}
      <div className="flex items-center gap-2 border-y py-3 lg:hidden">
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
          <SkeletonBlock className="mb-4 h-66 w-full rounded-2xl sm:h-56" />

          <div className="mb-4 hidden justify-end lg:flex">
            <SkeletonBlock className="h-9 w-40" />
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="flex flex-col">
                <SkeletonBlock className="aspect-4/5 w-full rounded-2xl" />
                <div className="mt-2 flex flex-col gap-0.5">
                  <SkeletonBlock className="h-3.5 w-14" />
                  <SkeletonBlock className="h-5 w-3/4" />
                  <SkeletonBlock className="h-4 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
