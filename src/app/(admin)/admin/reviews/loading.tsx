import { HeadingSkeleton, SkeletonBlock } from "@/components/shared/skeletons";

/** Сэтгэгдэл — толгой, таб, жагсаалт. */
export default function Loading() {
  return (
    <div className="space-y-6" role="status" aria-label="Ачаалж байна">
      <HeadingSkeleton />
      <SkeletonBlock className="h-9 w-full max-w-xl rounded-md" />
      <SkeletonBlock className="h-80 w-full rounded-xl" />
    </div>
  );
}
