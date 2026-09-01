import {
  HeadingSkeleton,
  SkeletonBlock,
} from "@/components/shared/skeletons";


/**
 * Account section. It had no loading boundary at all, so every hop between
 * Захиалга / Хаяг / V point left the previous screen frozen with no sign the
 * tap had registered — these pages are all user-scoped, so none of them can be
 * served from the static cache and every one of them waits on the database.
 *
 * Matches the section's `max-w-3xl` column so the swap lands in place.
 */
export default function Loading() {
  return (
    <div
      className="space-y-8"
      role="status"
      aria-label="Ачаалж байна"
    >
      <HeadingSkeleton />
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
