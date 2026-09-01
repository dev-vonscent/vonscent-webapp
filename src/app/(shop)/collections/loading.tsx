import {
  HeadingSkeleton,
  SkeletonBlock,
} from "@/components/shared/skeletons";


/** Багц listing — cards in a responsive grid. */
export default function Loading() {
  return (
    <div
      className="mx-auto max-w-352 px-4 py-6 md:px-8"
      role="status"
      aria-label="Багц ачаалж байна"
    >
      <HeadingSkeleton className="mb-8" />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <SkeletonBlock className="aspect-16/10 w-full rounded-xl" />
            <SkeletonBlock className="h-5 w-2/3" />
            <SkeletonBlock className="h-4 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
