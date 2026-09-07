import {
  HeadingSkeleton,
  SkeletonBlock,
  StatRowSkeleton,
} from "@/components/shared/skeletons";

/** Азын хүрд — 30-day stats, then one editable card per segment. */
export default function Loading() {
  return (
    <div className="space-y-8" role="status" aria-label="Ачаалж байна">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <HeadingSkeleton />
        <SkeletonBlock className="h-10 w-32 rounded-md" />
      </div>
      <StatRowSkeleton />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-52 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
