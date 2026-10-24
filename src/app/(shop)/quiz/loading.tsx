import { SkeletonBlock } from "@/components/shared/skeletons";

/** The quiz intro card, so /quiz doesn't inherit the home skeleton. */
export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Ачаалж байна"
      className="mx-auto max-w-5xl px-4 pt-4 pb-10 md:px-8 md:pt-10"
    >
      <SkeletonBlock className="h-80 w-full rounded-2xl" />
    </div>
  );
}
