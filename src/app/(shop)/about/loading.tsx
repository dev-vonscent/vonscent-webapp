import { SkeletonBlock } from "@/components/shared/skeletons";

/**
 * Бидний тухай — centred intro, then a two-up value grid and a wide panel.
 * Matches the page's `max-w-4xl py-16` column so the copy lands in place.
 */
export default function Loading() {
  return (
    <div
      className="mx-auto max-w-4xl px-4 py-16 md:px-8"
      role="status"
      aria-label="Ачаалж байна"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <SkeletonBlock className="h-3.5 w-32" />
        <SkeletonBlock className="h-10 w-4/5 max-w-xl" />
        <SkeletonBlock className="mt-2 h-4 w-full max-w-2xl" />
        <SkeletonBlock className="h-4 w-3/4 max-w-2xl" />
      </div>

      <div className="mt-14 grid gap-6 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-28 w-full rounded-lg" />
        ))}
      </div>

      <SkeletonBlock className="mt-14 h-56 w-full rounded-xl" />
    </div>
  );
}
