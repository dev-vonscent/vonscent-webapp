import { SkeletonBlock } from "@/components/shared/skeletons";

/**
 * Багцын дэлгэрэнгүй — зүүн талд дөрвөлжин зураг, баруун талд үнэ, хэмжээ,
 * гишүүд, товчнууд.
 *
 * Өмнөх хувилбар нь 4 багана гишүүн + 20rem хажуугийн самбар зурдаг байсан
 * бөгөөд бодит хуудас үүнтэй огт таардаггүй тул үнэ гарч ирэх яг тэр агшинд
 * зохиомж үсэрдэг байв.
 */
export default function Loading() {
  return (
    <div
      className="mx-auto max-w-352 p-4 sm:py-8 md:px-8"
      role="status"
      aria-label="Багц ачаалж байна"
    >
      <SkeletonBlock className="mb-6 hidden h-4 w-56 sm:block" />

      <div className="grid gap-6 sm:gap-10 lg:grid-cols-2 lg:items-start">
        <SkeletonBlock className="aspect-square w-full rounded-2xl" />

        <div className="space-y-6">
          <div className="space-y-2">
            <SkeletonBlock className="h-4 w-28" />
            <SkeletonBlock className="h-9 w-56 max-w-full" />
          </div>

          <div className="space-y-1">
            <SkeletonBlock className="h-9 w-64 max-w-full" />
            <SkeletonBlock className="h-5 w-72 max-w-full" />
          </div>

          <SkeletonBlock className="h-5 w-full max-w-prose" />

          <div className="space-y-3">
            <SkeletonBlock className="h-5 w-56" />
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonBlock key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <SkeletonBlock className="h-5 w-48" />
            <div className="grid gap-2 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonBlock key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <SkeletonBlock className="h-12 w-full rounded-md" />
            <SkeletonBlock className="h-12 w-full rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
