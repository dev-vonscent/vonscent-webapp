import { SkeletonBlock } from "@/components/shared/skeletons";

/** Түгээмэл асуулт — centred title, a search field, then accordion rows. */
export default function Loading() {
  return (
    <div
      className="mx-auto max-w-3xl px-4 py-16 md:px-8"
      role="status"
      aria-label="Ачаалж байна"
    >
      <SkeletonBlock className="mx-auto h-10 w-72" />
      <SkeletonBlock className="mt-8 h-11 w-full rounded-md" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
