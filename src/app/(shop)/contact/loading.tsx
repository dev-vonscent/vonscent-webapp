import { SkeletonBlock } from "@/components/shared/skeletons";

/** Холбоо барих — details panel beside the message form. */
export default function Loading() {
  return (
    <div
      className="mx-auto max-w-5xl px-4 py-16 md:px-8"
      role="status"
      aria-label="Ачаалж байна"
    >
      <SkeletonBlock className="h-10 w-64" />
      <SkeletonBlock className="mt-4 h-4 w-80 max-w-full" />

      <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:gap-12">
        <div className="space-y-6">
          <SkeletonBlock className="h-72 w-full rounded-xl" />
          <SkeletonBlock className="h-24 w-full rounded-xl" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <SkeletonBlock className="h-3.5 w-24" />
              <SkeletonBlock className="h-10 w-full rounded-md" />
            </div>
          ))}
          <SkeletonBlock className="h-32 w-full rounded-md" />
          <SkeletonBlock className="h-11 w-36 rounded-md" />
        </div>
      </div>
    </div>
  );
}
