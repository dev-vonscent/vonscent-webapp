import Link from "next/link";
import {
  Droplet,
  FlaskConical,
  Gift,
  type LucideIcon,
  Package,
  ShoppingBag,
  Syringe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExtraCategory } from "../../types";

const ICON: Record<string, LucideIcon> = {
  "gift-box": Gift,
  vial: FlaskConical,
  leftover: Droplet,
  "empty-bottle": Package,
  syringe: Syringe,
  "brand-pouch": ShoppingBag,
};

const HINT: Record<ExtraCategory["mode"], string> = {
  local_quantity: "Хувилбар бүрт үнэ, тоо",
  shared_vial: "Савны нөөцөөс — зөвхөн үнэ",
  leftover_liquid: "Эх шил — ганц ширхэг",
};

/** Шинэ барааны эхний алхам — 6 ангилал (plan §7.2). */
export function ExtraCategoryTiles({
  categories,
  vialsOn,
}: {
  categories: ExtraCategory[];
  vialsOn: boolean;
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {categories.map((c) => {
        const Icon = ICON[c.slug] ?? Package;
        const disabled = c.mode === "shared_vial" && !vialsOn;
        const body = (
          <>
            <Icon className="text-muted-foreground size-6" aria-hidden />
            <span className="font-medium">{c.name}</span>
            <span className="text-muted-foreground text-xs">
              {disabled ? "Савны тоон нөөц нээгдсэний дараа" : HINT[c.mode]}
            </span>
          </>
        );
        const cls =
          "bg-card border-border flex min-h-32 flex-col items-start justify-between gap-2 rounded-2xl border p-4 text-left transition-colors";
        return (
          <li key={c.id}>
            {disabled ? (
              <div className={cn(cls, "opacity-60")} aria-disabled>
                {body}
              </div>
            ) : (
              <Link
                href={`/admin/extras/new?cat=${c.slug}`}
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
