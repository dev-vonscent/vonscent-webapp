import { SkeletonBlock } from "@/components/shared/skeletons";

/**
 * Нэмэлт барааны хуудас. Өөрийн skeleton-гүй үед `(shop)/loading.tsx`-ийн
 * нүүр хуудасны skeleton гарч, баруун тал нь огт өөр хэлбэртэй байв.
 * `page.tsx`-ийн бүтэцтэй мөр мөрөөр: галерей, ангилал, нэр, үнэ,
 * сонголтын 3 багана, анхааруулга, «Захиалах» + «Сагсанд нэмэх».
 */
export default function Loading() {
  return (
    <div
      className="mx-auto max-w-352 p-4 sm:py-8 md:px-8"
      role="status"
      aria-label="Бараа ачаалж байна"
    >
      <SkeletonBlock className="mb-6 hidden h-4 w-64 opacity-60 sm:block" />

      <div className="grid grid-cols-1 gap-0 sm:gap-10 lg:grid-cols-2 lg:items-start">
        <SkeletonBlock className="aspect-square w-full rounded-2xl" />

        <div className="space-y-6 pt-8 sm:pt-0">
          <div className="space-y-3">
            <SkeletonBlock className="h-3.5 w-24" />
            <SkeletonBlock className="h-9 w-3/4" />
          </div>
          {/* Үнэ */}
          <SkeletonBlock className="h-9 w-32" />
          {/* Сонголт */}
          <div className="space-y-3">
            <SkeletonBlock className="h-4 w-16" />
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonBlock key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          </div>
          {/* Анхааруулга */}
          <SkeletonBlock className="h-16 w-full rounded-lg" />
          {/* Тоо + «Захиалах», «Сагсанд нэмэх» */}
          <div className="space-y-3">
            <div className="flex gap-4">
              <SkeletonBlock className="h-12 w-30 rounded-md" />
              <SkeletonBlock className="h-12 flex-1 rounded-md" />
            </div>
            <SkeletonBlock className="h-12 w-full rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
