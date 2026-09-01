import { HeadingSkeleton, TableSkeleton, ToolbarSkeleton } from "@/components/shared/skeletons";

/**
 * Захиалга — the screen an operator lives on, and the heaviest admin query
 * (orders joined to items, customer and payment state). The shared admin
 * spinner left the whole area blank for that wait.
 */
export default function Loading() {
  return (
    <div className="space-y-6" role="status" aria-label="Захиалга ачаалж байна">
      <HeadingSkeleton />
      <ToolbarSkeleton items={3} />
      <TableSkeleton rows={10} />
    </div>
  );
}
