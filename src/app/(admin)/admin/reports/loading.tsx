import {
  HeadingSkeleton,
  SkeletonBlock,
  StatRowSkeleton,
  TableSkeleton,
} from "@/components/shared/skeletons";

/** Тайлан — export buttons, five stat tiles, then the monthly breakdowns. */
export default function Loading() {
  return (
    <div className="space-y-8" role="status" aria-label="Тайлан ачаалж байна">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <HeadingSkeleton />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-9 w-28 rounded-md" />
          ))}
        </div>
      </div>
      <StatRowSkeleton
        tiles={5}
        className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5"
      />
      <TableSkeleton rows={6} />
      <TableSkeleton rows={6} />
    </div>
  );
}
