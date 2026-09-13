import {
  HeadingSkeleton,
  StatRowSkeleton,
  TableSkeleton,
} from "@/components/shared/skeletons";

/** Түгжигдсэн мл — толгой, дөрвөн тоолуур, дараа нь бараа тус бүрийн хүснэгт. */
export default function Loading() {
  return (
    <div
      className="space-y-6"
      role="status"
      aria-label="Түгжигдсэн мл ачаалж байна"
    >
      <HeadingSkeleton />
      <StatRowSkeleton
        tiles={4}
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      />
      <TableSkeleton rows={4} />
      <TableSkeleton rows={4} />
    </div>
  );
}
