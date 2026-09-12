"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Boxes, Heart, Home, Search } from "lucide-react";
import { Logo } from "./logo";
import { MobileMenu } from "./mobile-menu";
import { CartSheet } from "@/features/cart/components/cart-sheet";
import { ProfileMenu } from "@/features/account/components/profile-menu";
import { GlobalSearch } from "./global-search";
import { cn } from "@/lib/utils";

/** Desktop pill nav — left side links; the cart sits last (see render). */
const PILL_NAV = [
  { href: "/", label: "Нүүр", icon: Home },
  { href: "/catalog", label: "Каталог", icon: Search },
  { href: "/collections", label: "Багц", icon: Boxes },
  { href: "/wishlist", label: "Хүсэл", icon: Heart },
] as const;

/** Page titles for the mobile compact header (exact path or longest prefix). */
const TITLES: Record<string, string> = {
  "/catalog": "Каталог",
  "/collections": "Багц",
  "/collections/build": "Багц угсрах",
  "/account/collections": "Миний багцууд",
  "/about": "Бидний тухай",
  "/blog": "Блог",
  "/contact": "Холбоо барих",
  "/cart": "Сагс",
  "/checkout": "Захиалга",
  "/faq": "Тусламж",
  "/lucky-wheel": "Азын хүрд",
  "/wishlist": "Хүслийн жагсаалт",
  "/account": "Миний бүртгэл",
  "/account/orders": "Миний захиалга",
  "/account/loyalty": "Урамшуулал",
  "/account/addresses": "Хаягууд",
  "/account/coupons": "Купон",
  "/products": "", // full-bleed image hero — no title, just back + cart
  "/order/success": "Захиалга",
  // /pay/<token> — the prefix match covers the token segment.
  "/pay": "Төлбөр",
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
  const isHome = pathname === "/";

  // Hide on scroll down, reveal on scroll up.
  const [hidden, setHidden] = React.useState(false);
  React.useEffect(() => {
    let lastY = window.scrollY;
    function onScroll() {
      const y = window.scrollY;
      const diff = y - lastY;
      lastY = y;
      if (y < 80) {
        setHidden(false); // always visible near the top
        return;
      }
      // A jump further than the viewport in a single event is not a gesture.
      // It is the browser restoring the scroll position after a reload (or an
      // anchor jump), and reading it as "scrolling down" meant a page reloaded
      // halfway down came back with its header already hidden and no way to
      // get it except by scrolling up. Re-sync and leave the header alone; a
      // real flick arrives as many small deltas and still hides it.
      if (Math.abs(diff) > window.innerHeight) return;
      if (diff > 6) {
        setHidden(true); // scrolling down
      } else if (diff < -6) {
        setHidden(false); // scrolling up
      }
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
      {/* Mobile compact header — inner pages only */}
      {!isHome && (
        <div className="relative flex h-16 items-center justify-between gap-3 px-4 md:hidden">
          {/*
            A scrim, because this bar has no background of its own: the back
            button and the cart carry their own pills, but the title sat
            directly on whatever scrolled beneath it — product photography,
            the bundle tray — and went unreadable against the light parts.

            It fades from `--background`, not from black: that is the page's own
            colour, so the same rule reads correctly on the black, white and
            pink themes instead of laying a dark wash over a light one. It also
            keeps the bar feeling like it floats, which a solid fill would not.

            `-z-10` is contained by the header's own stacking context (it is
            `sticky z-40`), so this paints under the bar's controls and over the
            page — never behind the page itself.
          */}
          <span
            aria-hidden
            className="from-background pointer-events-none absolute inset-x-0 top-0 -z-10 h-24 bg-linear-to-b to-transparent"
          />
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
        <div className="bg-secondary/85 shadow-lift relative mx-auto flex h-14 max-w-352 items-center gap-2 rounded-full px-3 backdrop-blur">
          {/* Left: mobile menu + logo */}
          <MobileMenu className="md:hidden" />

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
                  aria-current={active ? "page" : undefined}
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
