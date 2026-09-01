import { HeadingSkeleton, TableSkeleton, ToolbarSkeleton } from "@/components/shared/skeletons";

/** Үлдэгдэл — every product with its ml, reservations and low-stock state. */
export default function Loading() {
  return (
    <div className="space-y-6" role="status" aria-label="Үлдэгдэл ачаалж байна">
      <HeadingSkeleton />
      <ToolbarSkeleton items={2} />
      <TableSkeleton rows={10} thumb />
    </div>
  );
}
