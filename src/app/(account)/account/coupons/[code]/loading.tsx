import { SkeletonBlock } from "@/components/shared/skeletons";

/** Ticket, conditions, action — the shape the real page settles into. */
export default function Loading() {
  return (
    <div
      className="mx-auto max-w-md px-4 pt-6 pb-28"
      role="status"
      aria-label="Купон ачаалж байна"
    >
      <SkeletonBlock className="h-3.5 w-24" />
      <SkeletonBlock className="mt-4 h-56 w-full rounded-xl" />
      <div className="mt-6 space-y-px">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
