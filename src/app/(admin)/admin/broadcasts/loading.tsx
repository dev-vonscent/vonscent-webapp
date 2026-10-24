import { HeadingSkeleton, SkeletonBlock } from "@/components/shared/skeletons";

/** Мэдэгдэл илгээх — толгой, дараа нь мэдэгдэл бүрийн карт. */
export default function Loading() {
  return (
    <div className="space-y-6" role="status" aria-label="Ачаалж байна">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <HeadingSkeleton />
        <SkeletonBlock className="h-9 w-36 rounded-md" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
