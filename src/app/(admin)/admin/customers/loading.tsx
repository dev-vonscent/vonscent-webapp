import { HeadingSkeleton, TableSkeleton, ToolbarSkeleton } from "@/components/shared/skeletons";

/** Хэрэглэгч — a searchable list with per-row order totals. */
export default function Loading() {
  return (
    <div className="space-y-6" role="status" aria-label="Хэрэглэгч ачаалж байна">
      <HeadingSkeleton />
      <ToolbarSkeleton items={2} />
      <TableSkeleton rows={10} />
    </div>
  );
}
