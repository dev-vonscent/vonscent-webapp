import { HeadingSkeleton, SkeletonBlock } from "@/components/shared/skeletons";

/** Багц — cards in a responsive grid, with the "new bundle" action above. */
export default function Loading() {
  return (
    <div className="space-y-6" role="status" aria-label="Багц ачаалж байна">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <HeadingSkeleton />
        <SkeletonBlock className="h-10 w-36 rounded-md" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-56 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
