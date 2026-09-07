import { SkeletonBlock } from "@/components/shared/skeletons";

/** Захиалгын баталгаа — a narrow, centred confirmation column. */
export default function Loading() {
  return (
    <div
      className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-16 md:px-8"
      role="status"
      aria-label="Ачаалж байна"
    >
      <SkeletonBlock className="size-16 rounded-full" />
      <SkeletonBlock className="h-8 w-64" />
      <SkeletonBlock className="h-4 w-80 max-w-full" />
      <SkeletonBlock className="mt-6 h-52 w-full rounded-xl" />
      <SkeletonBlock className="h-11 w-40 rounded-md" />
    </div>
  );
}
