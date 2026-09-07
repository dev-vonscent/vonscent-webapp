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
        <div className="space-y-6">
          {[2, 4, 2].map((fields, card) => (
            <div key={card} className="bg-card space-y-4 rounded-xl p-6">
              <SkeletonBlock className="h-5 w-40" />
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
        <SkeletonBlock className="h-96 w-full rounded-xl" />
      </div>
    </div>
  );
}
