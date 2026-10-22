"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CatalogBodySkeleton } from "@/features/catalog/components/catalog-body-skeleton";
import { cn } from "@/lib/utils";

type Tab = "perfume" | "extras";

/**
 * Таб солих нь нэг `/catalog` маршрутын searchParams солих тул `loading.tsx`
 * гарахгүй — шинэ хуудас иртэл хуучин нь хөдөлгөөнгүй үлдэж «гацсан» мэт
 * санагддаг байв. Shell нь шилжилтийг transition дотор хийж, хүлээх зуур
 * таб шууд идэвхждэг ба доод хэсэг skeleton болно.
 */
const Ctx = React.createContext<{
  pending: Tab | null;
  go: (tab: Tab, href: string) => void;
} | null>(null);

export function CatalogTabShell({
  tabs,
  children,
}: {
  tabs: React.ReactNode;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [target, setTarget] = React.useState<Tab | null>(null);
  const go = React.useCallback(
    (tab: Tab, href: string) => {
      setTarget(tab);
      startTransition(() => router.push(href));
    },
    [router],
  );
  const pending = isPending ? target : null;
  const value = React.useMemo(() => ({ pending, go }), [pending, go]);

  return (
    <Ctx.Provider value={value}>
      {tabs}
      {pending ? <CatalogBodySkeleton /> : children}
    </Ctx.Provider>
  );
}

/**
 * Каталогийн «Үнэртэн · Нэмэлт бараа» таб + эрэмбэ (plan §9) — нэг мөр.
 * Таб нь доогуураа зураастай навигаци: шүүлтүүрийн chip-тэй ижил дэвсгэртэй
 * pill байхад «Төрөл»-тэй давхар шүүлтүүр мэт харагдаж, ганцаараа мөр
 * эзэлж баруун тал нь хоосон үлддэг байв. Зураас нь `after:` дэвсгэр —
 * border бүгд тунгалаг (globals.css «No borders anywhere»).
 *
 * `active` null (туг хаалттай) — зөвхөн эрэмбэ, desktop дээр. Утсан дээр
 * таб бүтэн өргөн, гүйлгэхэд толгойн доор наалдана (`--header-offset`);
 * эрэмбэ нь утасны удирдлагын мөрөнд байдаг тул энд desktop-д л.
 * Хайлтын `q`-г табын хооронд дамжуулна — хоёр таб нэг параметртэй.
 */
export function CatalogTabs({
  active,
  q,
  children,
}: {
  active: Tab | null;
  q?: string;
  /** Баруун талын эрэмбэ (desktop). */
  children?: React.ReactNode;
}) {
  const shell = React.useContext(Ctx);
  const current = shell?.pending ?? active;
  const query = q ? `q=${encodeURIComponent(q)}` : "";
  const tabs = [
    {
      key: "perfume",
      label: "Үнэртэн",
      href: `/catalog${query && `?${query}`}`,
    },
    {
      key: "extras",
      label: "Нэмэлт бараа",
      href: `/catalog?tab=extras${query && `&${query}`}`,
    },
  ] as const;

  return (
    <div
      className={cn(
        "flex items-center gap-6",
        active
          ? "bg-background/90 sticky top-(--header-offset) z-30 -mx-4 px-4 backdrop-blur transition-[top] duration-300 md:static md:mx-0 md:bg-transparent md:px-0 md:backdrop-blur-none"
          : "hidden lg:flex",
      )}
    >
      {active && (
        <nav
          aria-label="Каталогийн төрөл"
          className="flex flex-1 gap-6 md:flex-none"
        >
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={t.href}
              aria-current={current === t.key ? "page" : undefined}
              onClick={(e) => {
                // Шинэ таб / цонхонд нээх нь хөтчийн өөрийнх хэвээр.
                if (
                  !shell ||
                  e.button !== 0 ||
                  e.metaKey ||
                  e.ctrlKey ||
                  e.shiftKey ||
                  e.altKey
                )
                  return;
                e.preventDefault();
                if (t.key !== current) shell.go(t.key, t.href);
              }}
              className={cn(
                "relative flex min-h-12 flex-1 items-center justify-center text-sm font-medium transition-colors after:absolute after:inset-x-0 after:bottom-1.5 after:h-0.5 after:rounded-full after:transition-colors md:flex-none",
                current === t.key
                  ? "text-foreground after:bg-foreground"
                  : "text-muted-foreground hover:text-foreground after:bg-transparent",
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      )}
      {children && (
        <div className="ml-auto hidden py-2 lg:block">{children}</div>
      )}
    </div>
  );
}
