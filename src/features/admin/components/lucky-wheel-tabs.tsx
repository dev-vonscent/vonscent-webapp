"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/lucky-wheel", label: "Шагналууд" },
  { href: "/admin/lucky-wheel/report", label: "Тайлан" },
  { href: "/admin/lucky-wheel/physical", label: "Бодит шагнал" },
] as const;

/** Азын хүрдний гурван хуудас — «Урамшуулал»-ын табтай ижил хэлбэр. */
export function LuckyWheelTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Азын хүрд"
      className="bg-muted grid w-full grid-cols-3 gap-1 rounded-lg p-1 sm:flex sm:w-fit"
    >
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-2 text-center text-sm font-medium whitespace-nowrap transition-colors",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
