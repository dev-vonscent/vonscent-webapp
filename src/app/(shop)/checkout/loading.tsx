import { SkeletonBlock } from "@/components/shared/skeletons";

/** Захиалга — the contact/address form beside the order summary. */
export default function Loading() {
  return (
    <div
      className="mx-auto max-w-352 px-4 py-8 md:px-8"
      role="status"
      aria-label="Ачаалж байна"
    >
      <SkeletonBlock className="mb-8 h-9 w-56" />
      <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-10">
        {/* Хэлбэр нь ирэх хуудсынхаа хэлбэр байх ёстой: дугаарласан хоёр
            хэсэг (хаяг, хүлээн авагч) + бэлгийн карт, бүгд `rounded-2xl`
            `p-5 sm:p-6` — `Section` ба `GiftSamplePicker`-тэй яг ижил. Өмнө нь
            гурван адилхан `rounded-xl` карт зурдаг байсан тул бодит контент
            ирэхэд булан, дотоод зай хоёулаа үсэрдэг байв. */}
        <div className="space-y-6">
          {[1, 3].map((fields, card) => (
            <div
              key={card}
              className="bg-card space-y-4 rounded-2xl p-5 sm:p-6"
            >
              <div className="mb-5 flex items-center gap-3">
                <SkeletonBlock className="size-9 shrink-0 rounded-full" />
                <SkeletonBlock className="h-5 w-40" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {Array.from({ length: fields }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <SkeletonBlock className="h-3.5 w-24" />
                    <SkeletonBlock className="h-10 w-full rounded-md" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <SkeletonBlock className="h-96 w-full rounded-2xl" />
      </div>
    </div>
  );
}
