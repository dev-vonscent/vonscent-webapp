import { SkeletonBlock } from "@/components/shared/skeletons";

/** Сагс — line items beside the sticky summary panel. */
export default function Loading() {
  return (
    <div
      className="mx-auto max-w-352 px-4 py-8 md:px-8"
      role="status"
      aria-label="Сагс ачаалж байна"
    >
      <SkeletonBlock className="mb-8 h-9 w-48" />
      <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
        <SkeletonBlock className="h-72 w-full rounded-xl" />
      </div>
    </div>
  );
}
