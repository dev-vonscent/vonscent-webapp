"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Boxes,
  Layers,
  Tags,
  Tag,
  Warehouse,
  ShoppingCart,
  Settings,
  Store,
  Users,
  TicketPercent,
  Award,
  Gift,
  FileText,
  BarChart3,
  LayoutList,
  ChevronDown,
  Menu,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/shared/logo";
import type { SidebarBadges } from "@/features/admin/api";

interface NavLink {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: keyof SidebarBadges;
}

const GROUPS: { title: string | null; links: NavLink[] }[] = [
  {
    title: null,
    links: [{ href: "/admin", label: "Хяналтын самбар", icon: LayoutDashboard }],
  },
  {
    title: "Борлуулалт",
    links: [
      {
        href: "/admin/orders",
        label: "Захиалга",
        icon: ShoppingCart,
        badge: "newOrders",
      },
      { href: "/admin/customers", label: "Хэрэглэгч", icon: Users },
      { href: "/admin/reports", label: "Тайлан", icon: BarChart3 },
    ],
  },
  {
    title: "Каталог",
    links: [
      { href: "/admin/products", label: "Бараа", icon: Boxes },
      { href: "/admin/collections", label: "Багц", icon: Layers },
      {
        href: "/admin/inventory",
        label: "Үлдэгдэл",
        icon: Warehouse,
        badge: "outOfStock",
      },
      { href: "/admin/scent-families", label: "Үнэрийн төрөл", icon: Tags },
      { href: "/admin/tags", label: "Нэмэлт таг", icon: Tag },
    ],
  },
  {
    title: "Маркетинг",
    links: [
      { href: "/admin/promotions", label: "Урамшуулал", icon: TicketPercent },
      { href: "/admin/loyalty", label: "V point", icon: Award },
      { href: "/admin/gifts", label: "Сарын бэлэг", icon: Gift },
    ],
  },
  {
    title: "Сайт",
    links: [
      { href: "/admin/content", label: "Контент", icon: FileText },
      { href: "/admin/home-sections", label: "Нүүрийн хэсэг", icon: LayoutList },
    ],
  },
  {
    title: null,
    links: [{ href: "/admin/settings", label: "Тохиргоо", icon: Settings }],
  },
];

/** Quick-access tiles at the top of the mobile sheet (5a). */
const QUICK: NavLink[] = [
  {
    href: "/admin/orders",
    label: "Захиалга",
    icon: ShoppingCart,
    badge: "newOrders",
  },
  { href: "/admin/products", label: "Бараа", icon: Boxes },
  {
    href: "/admin/inventory",
    label: "Үлдэгдэл",
    icon: Warehouse,
    badge: "outOfStock",
  },
];

const OPEN_KEY = "admin-nav-open";
// Default keeps Захиалга / Бараа / Үлдэгдэл visible on first paint.
const DEFAULT_OPEN = ["Борлуулалт", "Каталог"];

function isActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

export function AdminSidebar({
  badges = { newOrders: 0, outOfStock: 0 },
}: {
  badges?: SidebarBadges;
}) {
  const pathname = usePathname();

  // Which titled groups are expanded (5b). localStorage is read after mount so
  // the SSR markup always matches the first client render.
  const [open, setOpen] = React.useState<string[]>(DEFAULT_OPEN);
  React.useEffect(() => {
    let stored: string[] = DEFAULT_OPEN;
    try {
      const raw = localStorage.getItem(OPEN_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) stored = parsed.filter((v): v is string => typeof v === "string");
      }
    } catch {
      // ignore — fall back to the defaults
    }
    // The group of the current page always starts expanded.
    const activeGroup = GROUPS.find(
      (g) => g.title && g.links.some((l) => isActive(pathname, l.href)),
    )?.title;
    setOpen(
      activeGroup && !stored.includes(activeGroup)
        ? [...stored, activeGroup]
        : stored,
    );
    // Only on mount — later navigation shouldn't fight the user's toggles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(title: string) {
    setOpen((prev) => {
      const next = prev.includes(title)
        ? prev.filter((t) => t !== title)
        : [...prev, title];
      try {
        localStorage.setItem(OPEN_KEY, JSON.stringify(next));
      } catch {
        // storage unavailable — state still works for the session
      }
      return next;
    });
  }

  const renderLink = (l: NavLink, close = false) => {
    const active = isActive(pathname, l.href);
    const badgeCount = l.badge ? badges[l.badge] : 0;
    const link = (
      <Link
        key={l.href}
        href={l.href}
        className={cn(
          "flex shrink-0 items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
          active
            ? "bg-secondary text-foreground font-medium"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        <l.icon className="size-4" />
        {l.label}
        {badgeCount > 0 && (
          <span className="bg-foreground text-background ml-auto rounded-full px-1.5 text-[10px] leading-4 font-semibold">
            {badgeCount}
          </span>
        )}
      </Link>
    );
    return close ? (
      <SheetClose asChild key={l.href}>
        {link}
      </SheetClose>
    ) : (
      link
    );
  };

  const renderGroups = (close = false) =>
    GROUPS.map((g, i) =>
      g.title === null ? (
        <div key={i} className="flex flex-col gap-1">
          {g.links.map((l) => renderLink(l, close))}
        </div>
      ) : (
        <div key={g.title} className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => toggle(g.title!)}
            aria-expanded={open.includes(g.title)}
            className="text-muted-foreground hover:text-foreground flex w-full items-center justify-between px-3 pt-4 pb-1 text-[10px] font-semibold tracking-[0.14em] uppercase transition-colors"
          >
            {g.title}
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform",
                open.includes(g.title) && "rotate-180",
              )}
            />
          </button>
          {open.includes(g.title) && g.links.map((l) => renderLink(l, close))}
        </div>
      ),
    );

  const currentLabel =
    GROUPS.flatMap((g) => g.links).find((l) => isActive(pathname, l.href))
      ?.label ?? "Админ";

  return (
    <aside className="bg-card lg:w-60 lg:shrink-0 print:hidden">
      {/* ── Mobile: top bar + slide-in sheet (5a) ── */}
      <div className="flex h-14 items-center gap-2 px-3 lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <button
              type="button"
              className="hover:bg-accent flex size-10 items-center justify-center rounded-md"
              aria-label="Цэс нээх"
            >
              <Menu className="size-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="gap-0 overflow-y-auto p-4">
            <SheetHeader className="mb-3">
              <SheetTitle className="flex items-center gap-2">
                <Logo />
                <span className="text-muted-foreground text-xs font-medium">
                  admin
                </span>
              </SheetTitle>
            </SheetHeader>

            {/* Quick tiles — the three screens an admin opens all day */}
            <div className="mb-2 grid grid-cols-3 gap-2">
              {QUICK.map((q) => {
                const badgeCount = q.badge ? badges[q.badge] : 0;
                return (
                  <SheetClose asChild key={q.href}>
                    <Link
                      href={q.href}
                      className={cn(
                        "relative flex flex-col items-center gap-1.5 rounded-lg py-3 text-xs font-medium transition-colors",
                        isActive(pathname, q.href)
                          ? "bg-secondary"
                          : "bg-secondary/50 hover:bg-accent",
                      )}
                    >
                      <q.icon className="size-5" />
                      {q.label}
                      {badgeCount > 0 && (
                        <span className="bg-foreground text-background absolute top-1.5 right-1.5 rounded-full px-1.5 text-[10px] leading-4 font-semibold">
                          {badgeCount}
                        </span>
                      )}
                    </Link>
                  </SheetClose>
                );
              })}
            </div>

            <nav className="flex flex-col gap-1">{renderGroups(true)}</nav>

            <SheetClose asChild>
              <Link
                href="/"
                className="text-muted-foreground hover:bg-accent hover:text-foreground mt-4 flex items-center gap-3 rounded-md px-3 py-2.5 text-sm"
              >
                <Store className="size-4" />
                Дэлгүүр рүү буцах
              </Link>
            </SheetClose>
          </SheetContent>
        </Sheet>
        <span className="text-sm font-medium">{currentLabel}</span>
        <span className="text-muted-foreground ml-auto text-xs font-medium">
          admin
        </span>
      </div>

      {/* ── Desktop: grouped accordion column (5b) ── */}
      <div className="hidden h-16 items-center px-6 lg:flex">
        <Logo />
        <span className="text-muted-foreground ml-2 text-xs font-medium">
          admin
        </span>
      </div>
      <nav className="hidden flex-col gap-1 px-3 lg:flex">{renderGroups()}</nav>
      <div className="mt-auto hidden p-3 lg:block">
        <Link
          href="/"
          className="text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-3 rounded-md px-3 py-2.5 text-sm"
        >
          <Store className="size-4" />
          Дэлгүүр рүү буцах
        </Link>
      </div>
    </aside>
  );
}
