import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ExtraCategory, ExtraMode } from "../../types";
import { categoryIcon } from "../category-icon";

const HINT: Record<ExtraMode, string> = {
  local_quantity: "Хувилбар бүрт үнэ, тоо",
  shared_vial: "Савны нөөцөөс — зөвхөн үнэ",
  leftover_liquid: "Эх шил — ганц ширхэг",
};

/** Олон горимтой ангилалд («Шилтэй ус») горим бүр өөрийн tile-тай. */
export const MODE_TITLE: Record<ExtraMode, string> = {
  local_quantity: "Бүтэн, лацтай шил",
  shared_vial: "Грамын сав",
  leftover_liquid: "Үлдэгдэлтэй шил",
};

/** Шинэ барааны эхний алхам — ангилал (+горим) сонгох (plan §7.2, §18.4). */
export function ExtraCategoryTiles({
  categories,
  vialsOn,
}: {
  categories: ExtraCategory[];
  vialsOn: boolean;
}) {
  const tiles = categories.flatMap((c) =>
    c.modes.map((m) => ({
      category: c,
      mode: m.mode,
      multi: c.modes.length > 1,
    })),
  );
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {tiles.map(({ category: c, mode, multi }) => {
        const Icon = categoryIcon(c.slug);
        const disabled = mode === "shared_vial" && !vialsOn;
        const body = (
          <>
            <Icon className="text-muted-foreground size-6" aria-hidden />
            <span className="font-medium">
              {c.name}
              {multi && (
                <span className="text-muted-foreground block text-sm font-normal">
                  {MODE_TITLE[mode]}
                </span>
              )}
            </span>
            <span className="text-muted-foreground text-xs">
              {disabled ? "Савны тоон нөөц нээгдсэний дараа" : HINT[mode]}
            </span>
          </>
        );
        const cls =
          "bg-card border-border flex h-full min-h-32 flex-col items-start justify-between gap-2 rounded-2xl border p-4 text-left transition-colors";
        return (
          <li key={`${c.id}:${mode}`}>
            {disabled ? (
              <div className={cn(cls, "opacity-60")} aria-disabled>
                {body}
              </div>
            ) : (
              <Link
                href={`/admin/extras/new?cat=${c.slug}${multi ? `&mode=${mode}` : ""}`}
                className={cn(cls, "hover:border-foreground/40")}
              >
                {body}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
