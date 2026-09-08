import { SkeletonBlock } from "@/components/shared/skeletons";

/**
 * The payment page's own boundary, in the shape of the page it precedes:
 * cardless single column on a phone, summary rail beside a payment card from
 * md+, so the hand-over shifts nothing.
 *
 * Worth having rather than inheriting the group spinner — an order with no
 * invoice yet has to round-trip to merchant.qpay.mn before anything can
 * render, so this is on screen long enough to matter.
 */
export default function Loading() {
  return (
    <div
      className="mx-auto max-w-lg px-4 py-10 md:grid md:max-w-4xl md:grid-cols-[minmax(0,1fr)_420px] md:items-start md:gap-14 md:py-16"
      role="status"
      aria-label="Төлбөрийн хуудас ачаалж байна"
    >
      <div>
        <div className="flex justify-center md:justify-start">
          <SkeletonBlock className="h-7 w-44 rounded-full" />
        </div>
        <div className="mt-5 flex justify-center md:justify-start">
          <SkeletonBlock className="h-12 w-56 sm:h-14" />
        </div>
        <SkeletonBlock className="mt-8 hidden h-8 w-36 md:block" />
      </div>

      <div className="md:border-border md:bg-card mt-6 md:mt-0 md:rounded-2xl md:border md:p-5">
        {/* The QR leads on a desktop, the app grid on a phone — the skeleton
            reserves both in the order each layout renders them. */}
        <SkeletonBlock className="mx-auto hidden size-64 rounded-xl md:block" />
        {[5, 5].map((count, group) => (
          <div key={group} className={group === 0 ? "md:mt-6" : "mt-6"}>
            <SkeletonBlock className="h-3 w-24" />
            <div className="mt-3 grid grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-5">
              {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <SkeletonBlock className="size-14 rounded-2xl sm:size-16" />
                  <SkeletonBlock className="h-2.5 w-12" />
                </div>
              ))}
            </div>
          </div>
        ))}
        <SkeletonBlock className="mx-auto mt-6 size-52 rounded-xl md:hidden" />
        <SkeletonBlock className="mt-6 h-10 w-full rounded-md" />
      </div>
    </div>
  );
}
