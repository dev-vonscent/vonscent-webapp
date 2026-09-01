import { SkeletonBlock } from "@/components/shared/skeletons";

/** A single article — one reading column, not the archive's grid. */
export default function Loading() {
  return (
    <div
      className="mx-auto max-w-3xl px-4 py-12 md:px-8"
      role="status"
      aria-label="Нийтлэл ачаалж байна"
    >
      <SkeletonBlock className="mb-6 h-4 w-40" />
      <SkeletonBlock className="h-10 w-full" />
      <SkeletonBlock className="mt-3 h-4 w-40" />
      <SkeletonBlock className="mt-8 aspect-16/10 w-full rounded-xl" />
      <div className="mt-8 space-y-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <SkeletonBlock
            key={i}
            className={i % 4 === 3 ? "h-4 w-2/3" : "h-4 w-full"}
          />
        ))}
      </div>
    </div>
  );
}
