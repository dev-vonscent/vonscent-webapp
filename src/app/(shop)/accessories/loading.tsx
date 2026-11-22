import {
  HeadingSkeleton,
  ProductGridSkeleton,
  SkeletonBlock,
} from "@/components/shared/skeletons";

/** «Дагалдах хэрэгсэл» — гарчиг, ангиллын chip мөр, хэсэг. */
export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Дагалдах хэрэгсэл ачаалж байна"
      className="mx-auto max-w-420 px-4 py-8 md:px-8"
    >
      <HeadingSkeleton className="mb-4" />
      <div className="flex gap-2 py-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-10 w-28 rounded-full" />
        ))}
      </div>
      <SkeletonBlock className="my-4 h-6 w-40" />
      <ProductGridSkeleton count={4} />
    </div>
  );
}
