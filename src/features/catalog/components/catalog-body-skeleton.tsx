import {
  ProductGridSkeleton,
  SkeletonBlock,
} from "@/components/shared/skeletons";

/**
 * Каталогийн гарчиг, табын доорх хэсэг — утасны удирдлагын мөр, sidebar,
 * grid. `loading.tsx` ба таб солих үеийн шууд skeleton (`CatalogTabShell`)
 * хоёулаа үүнийг харуулна — хоёр skeleton зөрөхгүй.
 */
export function CatalogBodySkeleton() {
  return (
    <div role="status" aria-label="Каталог ачаалж байна">
      {/* Mobile control strip */}
      <div className="flex items-center gap-2 py-3 lg:hidden">
        <SkeletonBlock className="h-10 w-24" />
        <SkeletonBlock className="size-10" />
        <SkeletonBlock className="h-10 flex-1" />
      </div>

      <div className="mt-6 flex gap-10">
        <aside className="hidden w-72 shrink-0 space-y-6 lg:block">
          <SkeletonBlock className="h-10 w-full" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <SkeletonBlock className="h-4 w-24" />
              {Array.from({ length: 4 }).map((__, j) => (
                <SkeletonBlock key={j} className="h-3.5 w-full" />
              ))}
            </div>
          ))}
        </aside>

        <div className="flex-1">
          <ProductGridSkeleton count={12} />
        </div>
      </div>
    </div>
  );
}
