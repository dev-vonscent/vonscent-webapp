import {
  HeadingSkeleton,
  TableSkeleton,
  ToolbarSkeleton,
} from "@/components/shared/skeletons";

/**
 * The catalogue is the screen an operator opens most, and it now carries stock
 * as well as price — so it fetches more than any other list. The shared admin
 * spinner (`admin/loading.tsx`) gave a blank centre for that whole wait; this
 * holds the page's real shape instead, so the toolbar and rows do not jump
 * into place.
 */
export default function Loading() {
  return (
    <div className="space-y-6" role="status" aria-label="Бараа ачаалж байна">
      <HeadingSkeleton />
      <ToolbarSkeleton items={3} />
      <TableSkeleton rows={8} thumb />
    </div>
  );
}
