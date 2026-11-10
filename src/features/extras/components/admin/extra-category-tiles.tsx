import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExtraCategory, ExtraMode } from "../../types";
import { BOTTLE_KIND, bottleKind } from "../../lib/bottle-kind";
import { BottleGlyph } from "../bottle-glyph";
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

interface Tile {
  category: ExtraCategory;
  mode: ExtraMode;
  multi: boolean;
}

/**
 * Шинэ барааны эхний алхам — ангилал (+горим) сонгох (plan §7.2, §18.4).
 * Үнэртний гурван шил (хоосон, бүтэн лацтай, үлдэгдэлтэй) нь ангиллын
 * нэрээр биш, тусдаа бүлэгт дүүргэлттэй дүрстэй — нүдээр ялгагдана.
 */
export function ExtraCategoryTiles({
  categories,
  vialsOn,
}: {
  categories: ExtraCategory[];
  vialsOn: boolean;
}) {
  const tiles: Tile[] = categories.flatMap((c) =>
    c.modes.map((m) => ({
      category: c,
      mode: m.mode,
      multi: c.modes.length > 1,
    })),
  );
  const order = ["empty", "sealed", "leftover"] as const;
  const bottles = tiles
    .filter((t) => bottleKind(t.category.slug, t.mode))
    .sort(
      (a, b) =>
        order.indexOf(bottleKind(a.category.slug, a.mode)!) -
        order.indexOf(bottleKind(b.category.slug, b.mode)!),
    );
  const others = tiles.filter((t) => !bottleKind(t.category.slug, t.mode));

  return (
    <div className="space-y-8">
      {bottles.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-muted-foreground text-xs font-medium tracking-[0.15em] uppercase">
            Үнэртний шил
          </h2>
          <ul className="grid gap-3 md:grid-cols-3">
            {bottles.map((t) => (
              <li key={`${t.category.id}:${t.mode}`}>
                <BottleTile tile={t} />
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="space-y-3">
        <h2 className="text-muted-foreground text-xs font-medium tracking-[0.15em] uppercase">
          Бусад
        </h2>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {others.map((t) => (
            <li key={`${t.category.id}:${t.mode}`}>
              <OtherTile
                tile={t}
                icon={categoryIcon(t.category.slug)}
                vialsOn={vialsOn}
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

const TILE =
  "bg-card border-border flex h-full rounded-2xl border p-4 text-left transition-colors";

function href({ category, mode, multi }: Tile) {
  return `/admin/extras/new?cat=${category.slug}${multi ? `&mode=${mode}` : ""}`;
}

function BottleTile({ tile }: { tile: Tile }) {
  const k = BOTTLE_KIND[bottleKind(tile.category.slug, tile.mode)!];
  return (
    <Link
      href={href(tile)}
      className={cn(TILE, "hover:border-foreground/40 items-start gap-4")}
    >
      <BottleGlyph
        fill={k.fill}
        className="text-muted-foreground h-12 w-9 shrink-0"
      />
      <span className="min-w-0 space-y-1">
        <span className="block font-medium">{k.title}</span>
        <span className="text-muted-foreground block text-sm">{k.summary}</span>
      </span>
    </Link>
  );
}

function OtherTile({
  tile,
  icon: Icon,
  vialsOn,
}: {
  tile: Tile;
  icon: LucideIcon;
  vialsOn: boolean;
}) {
  const { category: c, mode, multi } = tile;
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
  const cls = cn(TILE, "min-h-32 flex-col items-start justify-between gap-2");
  return disabled ? (
    <div className={cn(cls, "opacity-60")} aria-disabled>
      {body}
    </div>
  ) : (
    <Link href={href(tile)} className={cn(cls, "hover:border-foreground/40")}>
      {body}
    </Link>
  );
}
