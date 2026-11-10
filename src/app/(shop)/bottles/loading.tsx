import { HeadingSkeleton, SkeletonBlock } from "@/components/shared/skeletons";
import { CatalogBodySkeleton } from "@/features/catalog/components/catalog-body-skeleton";

/** «Үнэртний шил» — гарчиг, tab мөр, дараа нь каталогийн бие. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-420 px-4 py-8 md:px-8">
      <HeadingSkeleton className="mb-6" />
      <SkeletonBlock className="mb-2 h-12 w-full rounded-full lg:w-120" />
      <CatalogBodySkeleton />
    </div>
  );
}
