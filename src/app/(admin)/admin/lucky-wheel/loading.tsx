import { SkeletonBlock } from "@/components/shared/skeletons";

/** Азын хүрд — the header and tabs stay (layout); the table/report loads. */
export default function Loading() {
  return (
    <div className="space-y-4" role="status" aria-label="Ачаалж байна">
      <SkeletonBlock className="h-9 w-full rounded-md" />
      <SkeletonBlock className="h-120 w-full rounded-xl" />
    </div>
  );
}
