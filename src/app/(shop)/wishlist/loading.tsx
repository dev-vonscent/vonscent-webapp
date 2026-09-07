import {
  ProductGridSkeleton,
  SkeletonBlock,
} from "@/components/shared/skeletons";

/**
 * Хүслийн жагсаалт — the same grid the page itself falls back to while the
 * saved ids hydrate, so the route boundary and the page agree on the shape.
 * The title is desktop-only here too: on mobile the header already shows it.
 */
export default function Loading() {
  return (
    <div
      className="mx-auto max-w-352 px-4 py-10 md:px-8"
      role="status"
      aria-label="Ачаалж байна"
    >
      <SkeletonBlock className="mb-6 hidden h-9 w-64 md:block" />
      <ProductGridSkeleton count={4} />
    </div>
  );
}
