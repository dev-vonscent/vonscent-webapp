import { SkeletonBlock } from "@/components/shared/skeletons";

/**
 * Үнэртэн санал болгох — гарчиг, дор нь формын карт. Өөрийн skeleton-гүй
 * үед shop бүлгийн `HomeSkeleton` (нүүрийн hero) гарч байсан.
 */
export default function Loading() {
  return (
    <div
      className="mx-auto max-w-2xl px-4 py-12 md:px-8 md:py-16"
      role="status"
      aria-label="Ачаалж байна"
    >
      <SkeletonBlock className="h-9 w-80 max-w-full md:h-10" />
      <SkeletonBlock className="mt-4 h-4 w-full max-w-md" />

      <div className="bg-card mt-8 space-y-4 rounded-xl p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <SkeletonBlock className="h-3.5 w-24" />
              <SkeletonBlock className="h-10 w-full rounded-md" />
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          <SkeletonBlock className="h-3.5 w-16" />
          <SkeletonBlock className="h-10 w-full rounded-md" />
        </div>
        <div className="space-y-1.5">
          <SkeletonBlock className="h-3.5 w-28" />
          <SkeletonBlock className="h-20 w-full rounded-md" />
        </div>
        <SkeletonBlock className="h-10 w-full rounded-md" />
      </div>
    </div>
  );
}
