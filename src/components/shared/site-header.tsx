"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Heart,
  Home,
  LayoutDashboard,
  Menu,
  Search,
  User,
} from "lucide-react";
import { Logo } from "./logo";
import { CartSheet } from "@/features/cart/components/cart-sheet";
import { ProfileMenu } from "@/features/account/components/profile-menu";
import { useIsStaff } from "@/features/account/use-staff";
import { GlobalSearch } from "./global-search";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/catalog", label: "Каталог" },
  { href: "/catalog?tags=sale", label: "Хямдрал" },
  { href: "/about", label: "Бидний тухай" },
  { href: "/blog", label: "Блог" },
  { href: "/contact", label: "Холбоо барих" },
] as const;

/** Desktop pill nav — left side links; the cart sits last (see render). */
const PILL_NAV = [
  { href: "/", label: "Нүүр", icon: Home },
  { href: "/catalog", label: "Каталог", icon: Search },
  { href: "/wishlist", label: "Хүсэл", icon: Heart },
] as const;

/** Page titles for the mobile compact header (exact path or longest prefix). */
const TITLES: Record<string, string> = {
  "/catalog": "Каталог",
  "/about": "Бидний тухай",
  "/blog": "Блог",
  "/contact": "Холбоо барих",
  "/cart": "Сагс",
  "/checkout": "Захиалга",
  "/faq": "Тусламж",
  "/wishlist": "Хүслийн жагсаалт",
  "/account": "Миний бүртгэл",
  "/account/orders": "Миний захиалга",
  "/account/loyalty": "Урамшуулал",
  "/account/addresses": "Хаягууд",
  "/products": "", // full-bleed image hero — no title, just back + cart
  "/order/success": "Захиалга",
};

function getTitle(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname];
  const match = Object.keys(TITLES)
    .filter((k) => pathname.startsWith(`${k}/`))
    .sort((a, b) => b.length - a.length)[0];
  return match ? TITLES[match] : "vonscent";
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const isStaff = useIsStaff();
  const isHome = pathname === "/";

  // Hide on scroll down, reveal on scroll up.
  const [hidden, setHidden] = React.useState(false);
  React.useEffect(() => {
    let lastY = window.scrollY;
    function onScroll() {
      const y = window.scrollY;
      const diff = y - lastY;
      if (y < 80) {
        setHidden(false); // always visible near the top
      } else if (diff > 6) {
        setHidden(true); // scrolling down
      } else if (diff < -6) {
        setHidden(false); // scrolling up
      }
      lastY = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Expose the hidden state so sticky page content (e.g. product gallery) can
  // shrink its top offset while the header is away and clear it when it returns.
  React.useEffect(() => {
    document.documentElement.dataset.headerHidden = hidden ? "true" : "false";
    return () => {
      delete document.documentElement.dataset.headerHidden;
    };
  }, [hidden]);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-transform duration-300 ease-out",
        hidden && "-translate-y-full",
      )}
    >
      {/* Mobile compact header — inner pages only, no background */}
      {!isHome && (
        <div className="flex h-16 items-center justify-between gap-3 px-4 md:hidden">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Буцах"
            className="bg-secondary/85 text-foreground hover:bg-secondary flex size-10 shrink-0 items-center justify-center rounded-full backdrop-blur transition-colors"
          >
            <ArrowLeft className="size-5" />
          </button>
          {getTitle(pathname) && (
            <span className="truncate font-serif text-base font-medium">
              {getTitle(pathname)}
            </span>
          )}
          <CartSheet
            triggerVariant="secondary"
            triggerClassName="shrink-0 rounded-full bg-secondary/85 backdrop-blur hover:bg-secondary"
          />
        </div>
      )}

      {/* Full header — floating glass pill. Home (all sizes) + inner (desktop). */}
      <div className={cn("px-4 pt-4", isHome ? "block" : "hidden md:block")}>
        <div className="bg-secondary/85 shadow-lift relative mx-auto flex h-14 max-w-[88rem] items-center gap-2 rounded-full px-3 backdrop-blur">
          {/* Left: mobile menu + logo */}
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Цэс"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80">
              <SheetTitle className="font-serif text-xl">Цэс</SheetTitle>
              <div className="gold-rule my-4" />
              <nav className="flex flex-col gap-1">
                {NAV.map((item) => (
                  <SheetClose asChild key={item.href}>
                    <Link
                      href={item.href}
                      className="hover:bg-accent rounded-lg px-3 py-3 text-base font-medium transition-colors"
                    >
                      {item.label}
                    </Link>
                  </SheetClose>
                ))}
              </nav>
              <div className="gold-rule my-4" />
              <SheetClose asChild>
                <Link
                  href="/account"
                  className="hover:bg-accent flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium transition-colors"
                >
                  <User className="size-5" /> Профайл
                </Link>
              </SheetClose>
              {/* Staff-only shortcut; the avatar dropdown it mirrors is
                  desktop-only, so mobile needs its own entry point. */}
              {isStaff && (
                <SheetClose asChild>
                  <Link
                    href="/admin"
                    className="hover:bg-accent flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium transition-colors"
                  >
                    <LayoutDashboard className="size-5" /> Админ хэсэг
                  </Link>
                </SheetClose>
              )}
            </SheetContent>
          </Sheet>

          <Logo className="px-1 text-lg md:text-xl" />

          {/* Center: nav with text + cart (mirrors the bottom nav) */}
          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex">
            {PILL_NAV.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
            <CartSheet
              label="Сагс"
              triggerClassName="h-auto rounded-full px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            />
          </nav>

          {/* Right: search + cart (mobile only) + profile menu (desktop only) */}
          <div className="ml-auto flex items-center gap-1">
            <GlobalSearch />
            <CartSheet triggerClassName="md:hidden" />
            <div className="hidden md:block">
              <ProfileMenu />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
