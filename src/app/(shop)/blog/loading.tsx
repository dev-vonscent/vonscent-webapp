import { SkeletonBlock } from "@/components/shared/skeletons";


/** Блог — a lead post followed by the archive grid. */
export default function Loading() {
  return (
    <div
      className="mx-auto max-w-352 px-4 py-12 md:px-8"
      role="status"
      aria-label="Блог ачаалж байна"
    >
      <SkeletonBlock className="h-10 w-40" />
      <SkeletonBlock className="mt-3 h-4 w-80 max-w-full" />

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <SkeletonBlock className="aspect-16/10 w-full rounded-xl" />
        <div className="space-y-3 self-center">
          <SkeletonBlock className="h-3.5 w-28" />
          <SkeletonBlock className="h-8 w-full" />
          <SkeletonBlock className="h-4 w-full" />
          <SkeletonBlock className="h-4 w-2/3" />
        </div>
      </div>

      <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <SkeletonBlock className="aspect-16/10 w-full rounded-xl" />
            <SkeletonBlock className="h-5 w-3/4" />
            <SkeletonBlock className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
