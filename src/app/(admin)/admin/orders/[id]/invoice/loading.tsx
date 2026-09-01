import { SkeletonBlock } from "@/components/shared/skeletons";

/** A printable invoice sheet, not the orders table it sits under. */
export default function Loading() {
  return (
    <div
      className="mx-auto max-w-2xl space-y-6 p-2"
      role="status"
      aria-label="Нэхэмжлэх ачаалж байна"
    >
      <div className="flex items-start justify-between">
        <SkeletonBlock className="h-8 w-40" />
        <SkeletonBlock className="h-8 w-28" />
      </div>
      <SkeletonBlock className="h-24 w-full" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-6 w-full" />
        ))}
      </div>
      <SkeletonBlock className="ml-auto h-8 w-40" />
    </div>
  );
}
