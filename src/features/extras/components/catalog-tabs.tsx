import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Каталогийн «Үнэртэн · Нэмэлт бараа» таб (plan §9). Утсан дээр бүтэн
 * өргөн, гүйлгэхэд толгойн доор наалдана (`--header-offset`).
 */
export function CatalogTabs({ active }: { active: "perfume" | "extras" }) {
  const tabs = [
    { key: "perfume", label: "Үнэртэн", href: "/catalog" },
    { key: "extras", label: "Нэмэлт бараа", href: "/catalog?tab=extras" },
  ] as const;
  return (
    <nav
      aria-label="Каталогийн төрөл"
      className="bg-background/90 sticky top-(--header-offset) z-30 -mx-4 mb-6 px-4 py-2 backdrop-blur transition-[top] duration-300 md:static md:mx-0 md:bg-transparent md:p-0 md:backdrop-blur-none"
    >
      <div className="bg-secondary grid grid-cols-2 gap-1 rounded-full p-1 md:inline-grid md:w-auto">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            aria-current={active === t.key ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-medium transition-colors",
              active === t.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
