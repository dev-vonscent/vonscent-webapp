import { HeadingSkeleton, SkeletonBlock } from "@/components/shared/skeletons";

/** Хямдрал — толгой, тохиргоо, барааны жагсаалт. */
export default function Loading() {
  return (
    <div className="space-y-6" role="status" aria-label="Ачаалж байна">
      <HeadingSkeleton />
      <SkeletonBlock className="h-40 w-full rounded-xl" />
      <SkeletonBlock className="h-80 w-full rounded-xl" />
    </div>
  );
}
