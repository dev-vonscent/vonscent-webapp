"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Boxes, Heart, Home, LayoutGrid } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Logo } from "./logo";
import { MobileMenu } from "./mobile-menu";
import { CartSheet } from "@/features/cart/components/cart-sheet";
import { HeaderChatButton } from "@/features/chat/components/header-chat-button";
import { ProfileMenu } from "@/features/account/components/profile-menu";
import {
  NotificationBell,
  NotificationBellPopover,
} from "@/features/notifications/components/notification-bell";
import { NotificationCenter } from "@/features/notifications/components/notification-center";
import { GlobalSearch } from "./global-search";
import { cn } from "@/lib/utils";

/** Desktop pill nav — left side links; the cart sits last (see render). */
const PILL_NAV = [
  { href: "/", label: "Нүүр", icon: Home },
  { href: "/catalog", label: "Каталог", icon: LayoutGrid },
  { href: "/collections", label: "Багц", icon: Boxes },
  { href: "/wishlist", label: "Хүсэл", icon: Heart },
] as const;

/** Page titles for the mobile compact header (exact path or longest prefix). */
const TITLES: Record<string, string> = {
  "/catalog": "Каталог",
  "/collections": "Багц",
  "/collections/build": "Багц үүсгэх",
  "/account/collections": "Миний багцууд",
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
  "/account/coupons": "Миний купон",
  "/account/notifications": "Мэдэгдэл",
  "/account/tier": "Түвшин",
  "/request": "Санал болгох",
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

export function SiteHeader({
  menuSocial,
}: {
  /** Гар утасны цэсэн дэх сошиал холбоосууд. */
  menuSocial?: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isHome = pathname === "/";
  const hideCart = pathname === "/cart" || pathname === "/checkout";
  // Утсан дээр чат доод цэсний хажууд (`BottomNav`). Төлбөрийн хуудсанд
  // «Төлөх» зурвас доод цэсийг (чатын хамт) нуудаг ч асуудал гарах магадлал
  // хамгийн өндөр газар тул тэнд чат толгойд гарна.
  const headerChat =
    pathname.startsWith("/checkout") || pathname.startsWith("/pay");

  // Хуудас удаан ачаалагдахад chip pathname-ийг хүлээвэл дарсны дараа юу ч
  // болохгүй мэт санагдана. Тиймээс дармагц шинэ цэс рүү гулсаж, «очиж
  // байна»-г заана. `from` нь pathname солигдмогц (эсвэл өөр хуудаснаас)
  // хүчингүй болох тул тусад нь цэвэрлэх шаардлагагүй.
  const [pendingNav, setPendingNav] = React.useState<{
    href: string;
    from: string;
  } | null>(null);
  const navPath =
    pendingNav && pendingNav.from === pathname ? pendingNav.href : pathname;
  // Header нь (shop)/template-ийн MotionConfig-оос гадна — өөрөө шалгана.
  const reduceMotion = useReducedMotion();

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
    <>
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

            Only when there is a title to protect: the product page has none
            (full-bleed photo hero), and there the scrim only laid a
            background-coloured haze over the top of the image.
          */}
            {getTitle(pathname) && (
              <span
                aria-hidden
                className="from-background pointer-events-none absolute inset-x-0 top-0 -z-10 h-24 bg-linear-to-b to-transparent"
              />
            )}
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
            {/* Сагс, төлбөрийн хуудсанд сагсны товч хэрэггүй: сагсан дээр
              өөрийгөө давхардуулна, төлбөр дээр хэрэглэгчийг төлбөрөөс гаргах
              зам болно. */}
            <div className="flex shrink-0 items-center gap-2">
              {/* Төлбөрийн урсгалд хонх саад болно — сагстай ижил дүрэм. */}
              {!hideCart && (
                <NotificationBell
                  triggerVariant="secondary"
                  triggerClassName="shrink-0 rounded-full bg-secondary/85 backdrop-blur hover:bg-secondary"
                />
              )}
              {headerChat && (
                <HeaderChatButton
                  variant="secondary"
                  className="bg-secondary/85 hover:bg-secondary rounded-full backdrop-blur"
                />
              )}
              {!hideCart && (
                <CartSheet
                  triggerVariant="secondary"
                  triggerClassName="shrink-0 rounded-full bg-secondary/85 backdrop-blur hover:bg-secondary"
                />
              )}
            </div>
          </div>
        )}

        {/* Full header — floating glass pill. Home (all sizes) + inner (desktop). */}
        <div className={cn("px-4 pt-4", isHome ? "block" : "hidden md:block")}>
          <div className="bg-secondary/85 shadow-lift relative mx-auto flex h-14 max-w-352 items-center gap-2 rounded-full px-3 backdrop-blur">
            {/* Left: mobile menu + logo */}
            <MobileMenu className="md:hidden" social={menuSocial} />

            <Logo className="px-1 text-lg md:text-xl" />

            {/* Center: nav with text + cart (mirrors the bottom nav) */}
            <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex">
              {PILL_NAV.map((item) => {
                const matches = (path: string) =>
                  item.href === "/" ? path === "/" : path.startsWith(item.href);
                const active = matches(navPath);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={matches(pathname) ? "page" : undefined}
                    onClick={(e) => {
                      // Шинэ таб/цонх (⌘/Ctrl/Shift/дунд товч) — энэ хуудас хэвээр.
                      if (
                        e.metaKey ||
                        e.ctrlKey ||
                        e.shiftKey ||
                        e.altKey ||
                        e.button !== 0
                      )
                        return;
                      setPendingNav({ href: item.href, from: pathname });
                    }}
                    className={cn(
                      "relative isolate flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                      active
                        ? "text-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {/* Капсул өөрөө bg-secondary тул идэвхтэйг нэг давхарга
                      дээш (bg-background + сүүдэр) гаргаж бүх загварт
                      ялгаруулна; layoutId-гаар цэс хооронд гулсана. */}
                    {active && (
                      <motion.span
                        layoutId="header-nav-active"
                        aria-hidden
                        className="bg-background absolute inset-0 -z-10 rounded-full shadow-xs"
                        transition={
                          reduceMotion
                            ? { duration: 0 }
                            : { type: "spring", stiffness: 500, damping: 40 }
                        }
                      />
                    )}
                    <item.icon className="size-4" />
                    {item.label}
                  </Link>
                );
              })}
              <CartSheet
                label="Сагс"
                triggerClassName="h-auto rounded-full px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-transparent hover:text-foreground"
              />
            </nav>

            {/* Right: search + bell + cart (mobile only) + profile menu (desktop only).
              Хонх нь утсан дээр сагсны зүүн талд, desktop-д хайлт ба профайлын
              хооронд. */}
            <div className="ml-auto flex items-center gap-1">
              <GlobalSearch />
              {/* Утсан дээр sheet (сагсны зүүн талд), desktop-д hover panel —
                  хайлттай ижил size-9 дугуй товч, профайлаас зайтай. */}
              <NotificationBell triggerClassName="size-9 text-muted-foreground hover:bg-secondary hover:text-foreground md:hidden" />
              <NotificationBellPopover className="mr-1.5 hidden md:flex" />
              <CartSheet triggerClassName="md:hidden" />
              <div className="hidden md:block">
                <ProfileMenu />
              </div>
            </div>
          </div>
        </div>
      </header>
      {/* Header-ээс ГАДНА: header нь `-translate-y-full` transform авдаг тул
        дотор нь байвал toast-ын `fixed` байрлал header-тэй хамт гулсана. */}
      <NotificationCenter />
    </>
  );
}
