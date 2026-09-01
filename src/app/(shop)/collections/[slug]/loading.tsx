import { SkeletonBlock } from "@/components/shared/skeletons";

/** Багцын дэлгэрэнгүй — its four members beside the price panel. */
export default function Loading() {
  return (
    <div
      className="mx-auto max-w-352 p-4 sm:py-8 md:px-8"
      role="status"
      aria-label="Багц ачаалж байна"
    >
      <SkeletonBlock className="mb-6 hidden h-4 w-56 sm:block" />
      <SkeletonBlock className="h-9 w-72 max-w-full" />
      <SkeletonBlock className="mt-3 h-4 w-full max-w-prose" />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <SkeletonBlock className="aspect-4/5 w-full rounded-2xl" />
              <SkeletonBlock className="h-3.5 w-3/4" />
            </div>
          ))}
        </div>
        <SkeletonBlock className="h-64 w-full rounded-2xl" />
      </div>
    </div>
  );
}
