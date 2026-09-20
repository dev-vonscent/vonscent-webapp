import { SkeletonBlock } from "@/components/shared/skeletons";

/**
 * Багц listing — толгой, шүүлтүүрийн мөр, дараа нь картын grid.
 *
 * Хэлбэр нь `page.tsx`-ийн бодит бүтцийг дагана: өмнө нь энд байхгүй гарчиг
 * зурж, шүүлтүүрийн мөрийг огт тооцдоггүй байсан тул ачаалал дуусмагц агуулга
 * үсэрдэг байв. Багц цөөхөн үед шүүлтүүр нь бүх өргөнд дээд мөр хэлбэртэй
 * байдаг учир энэ ганц хэлбэр утас, десктоп хоёуланд таарна.
 */
export default function Loading() {
  return (
    <div
      className="mx-auto max-w-352 px-4 py-6 md:px-8"
      role="status"
      aria-label="Багц ачаалж байна"
    >
      <div className="mb-6 space-y-2">
        <SkeletonBlock className="h-8 w-28 sm:h-9 sm:w-32" />
        <SkeletonBlock className="h-5 w-full max-w-md" />
        <SkeletonBlock className="h-5 w-64 max-w-full" />
      </div>

      {/* Шүүлтүүрийн мөр */}
      <div className="border-border flex flex-col gap-3 border-y py-3">
        <div className="flex items-center gap-2">
          <SkeletonBlock className="h-10 flex-1 rounded-md lg:max-w-xs" />
          <SkeletonBlock className="h-10 w-40 shrink-0 rounded-md lg:ms-auto" />
        </div>
        <div className="grid w-full grid-cols-2 gap-2 lg:flex lg:w-auto">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBlock
              key={i}
              className="h-9 rounded-sm lg:w-24"
            />
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:mt-8 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col">
            <SkeletonBlock className="aspect-3/2 w-full rounded-2xl" />
            <div className="mt-3 flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <SkeletonBlock className="h-3 w-16" />
                <SkeletonBlock className="h-5 w-32" />
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <SkeletonBlock className="h-4 w-24" />
                <SkeletonBlock className="h-3 w-14" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
