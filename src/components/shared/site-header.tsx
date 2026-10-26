"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, Heart } from "lucide-react";
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
import { selectWishCount, useWishlist } from "@/features/wishlist/store";
import { GlobalSearch } from "./global-search";
import { cn } from "@/lib/utils";
import { DARK_STAGE_ROUTES } from "@/lib/constants";
import {
  STORE_NAV_PRIMARY,
  STORE_NAV_SECONDARY,
  isNavActive,
  type StoreMenuKey,
  type StoreNavItem,
} from "./store-nav";

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
  "/lucky-wheel": "", // the dark stage runs up behind the bar — no title
  "/quiz": "Үнэрээ олох",
  "/wishlist": "Хүслийн жагсаалт",
  "/account": "Миний бүртгэл",
  "/account/orders": "Миний захиалга",
  "/account/loyalty": "Урамшуулал",
  "/account/addresses": "Хаягууд",
  "/account/coupons": "Миний купон",
  "/account/info": "Миний мэдээлэл",
  "/account/notifications": "Мэдэгдэл",
  "/account/tier": "Түвшин",
  "/request": "Санал болгох",
  "/products": "", // full-bleed image hero — no title, just back + cart
  "/order/success": "Захиалга",
  // /pay/<token> — the prefix match covers the token segment.
  "/pay": "Төлбөр",
};

function getTitle(pathname: string): string {
  // `in`, not truthiness: an exact "" means "no title" (the wheel's stage),
  // not "unknown page — fall back to the brand name".
  if (pathname in TITLES) return TITLES[pathname];
  const match = Object.keys(TITLES)
    .filter((k) => pathname.startsWith(`${k}/`))
    .sort((a, b) => b.length - a.length)[0];
  return match ? TITLES[match] : "vonscent";
}

/**
 * iOS-ийн «large title» загвар: хуудас өөрийн том гарчгийг
 * (`<h1 data-page-title>`) харуулж байх үед толгойн жижиг гарчиг давхардаж
 * харагдахгүй нуугдана, том гарчиг толгойн доогуур scroll хийгдэж ормогц
 * гарч ирнэ. Ийм тэмдэглэгээгүй хуудсанд толгойн гарчиг үргэлж харагдана.
 */
function usePageTitleVisible(pathname: string): boolean {
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => {
    let current: Element | null = null;
    // Толгойн өндөр (h-16) — түүний ард орсон гарчгийг «харагдахгүй» гэж тооцно.
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "-64px 0px 0px 0px" },
    );
    function attach() {
      const el = document.querySelector("[data-page-title]");
      if (el === current) return;
      if (current) io.unobserve(current);
      current = el;
      if (el) io.observe(el);
      else setVisible(false);
    }
    attach();
    // Гарчиг loading skeleton-ы дараа, эсвэл Suspense-ээс хожуу mount болно.
    const mo = new MutationObserver(attach);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      io.disconnect();
    };
  }, [pathname]);
  return visible;
}

export function SiteHeader({
  menuSocial,
  menus = {},
}: {
  /** Гар утасны цэсэн дэх сошиал холбоосууд. */
  menuSocial?: React.ReactNode;
  /**
   * Desktop dropdown-уудын агуулга (server-ээс), `StoreNavItem.menu`-ийн
   * түлхүүрээр. Агуулгагүй түлхүүр нь энгийн холбоос хэвээр гарна.
   */
  menus?: Partial<Record<StoreMenuKey, React.ReactNode>>;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isHome = pathname === "/";
  const pageTitleVisible = usePageTitleVisible(pathname);
  const hideCart = pathname === "/cart" || pathname === "/checkout";
  // Утсан дээр чат доод цэсний хажууд (`BottomNav`). Төлбөрийн хуудсанд
  // «Төлөх» зурвас доод цэсийг (чатын хамт) нуудаг ч асуудал гарах магадлал
  // хамгийн өндөр газар тул тэнд чат толгойд гарна.
  const headerChat =
    pathname.startsWith("/checkout") || pathname.startsWith("/pay");

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
      {/* will-change-transform: header-ийг байнгын өөрийн давхаргатай болгоно.
        Үгүй бол `(shop)/template.tsx`-ийн хуудас оруулах transform animation-ы
        үеэр Chrome header-ийг түр давхаргад гаргаж, дуусахад буцааж буулгаад
        дахин зурдаг — идэвхтэй цэсний зураас тэр мөчид анивчдаг байв.
        Header доторх `fixed` элементүүд (dialog, sheet) бүгд portal-оор гардаг. */}
      <header
        className={cn(
          "sticky top-0 z-40 transition-transform duration-300 ease-out will-change-transform motion-reduce:transition-none",
          hidden && "-translate-y-full",
        )}
      >
        {/* Mobile compact header — inner pages only (back + title + cart). */}
        {!isHome && (
          <div
            className={cn(
              "relative flex h-16 items-center justify-between gap-3 px-4 md:hidden",
              // Floats over a black stage there — its buttons go black too.
              DARK_STAGE_ROUTES.includes(pathname) && "force-black",
            )}
          >
            {/*
            A scrim, because this bar has no background of its own: the back
            button and the cart carry their own pills, but the title sat
            directly on whatever scrolled beneath it — product photography,
            the bundle tray — and went unreadable against the light parts.
            It fades from `--background`, so it reads on every theme. Only
            when there is a title to protect (the product page has none).
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
              <span
                aria-hidden={pageTitleVisible}
                className={cn(
                  "truncate text-base font-medium transition-opacity duration-200 motion-reduce:transition-none",
                  pageTitleVisible && "opacity-0",
                )}
              >
                {getTitle(pathname)}
              </span>
            )}
            {/* Сагс, төлбөрийн хуудсанд сагсны товч хэрэггүй: сагсан дээр
              өөрийгөө давхардуулна, төлбөр дээр хэрэглэгчийг төлбөрөөс гаргах
              зам болно. */}
            <div className="flex shrink-0 items-center gap-2">
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

        {/* Storefront header — solid. Home on every width, inner pages md+.
            One grid, two layouts: on phones a single 64px row
            `menu+search · logo · bell+cart` (search is an icon, two buttons
            per side keep the logo centred); from md `logo · search · actions`
            with the full search bar. One GlobalSearch instance (`adaptive`)
            serves both, so ⌘K is registered once — its wrapper is
            `md:contents`, so on md+ the bar takes its own grid area. */}
        <div
          className={cn(
            "bg-background shadow-soft",
            isHome ? "block" : "hidden md:block",
          )}
        >
          <div
            className={cn(
              "mx-auto grid max-w-420 items-center gap-x-2 px-4",
              "h-16 grid-cols-[1fr_auto_1fr] [grid-template-areas:'menu_logo_actions']",
              "md:h-18 md:grid-cols-[auto_minmax(0,1fr)_auto] md:grid-rows-1 md:gap-x-8 md:px-8 md:[grid-template-areas:'logo_search_actions']",
            )}
          >
            <div className="flex items-center justify-self-start [grid-area:menu] md:contents">
              <MobileMenu
                className="-ml-2 size-11 md:hidden"
                social={menuSocial}
              />
              <div className="md:w-full md:max-w-xl md:justify-self-center md:[grid-area:search]">
                <GlobalSearch trigger="adaptive" />
              </div>
            </div>

            <Logo
              mark
              className="h-11 justify-self-center [grid-area:logo] md:h-13 md:justify-self-start"
            />

            {/* Хүсэл · хонх · сагс — гурвуулаа ИЖИЛ 40px дугуй icon товч, тоо нь
                бүгдэд баруун дээд буланд. Нэр нь aria-label-д; бичигтэй/бичиггүй
                холилдвол мөр тэгш бус харагдаж, badge бичиг дээр давхцдаг байсан. */}
            <div className="flex items-center gap-1 justify-self-end [grid-area:actions]">
              <WishlistLink />
              {/* Утсан дээр sheet, desktop-д hover panel. Зочинд гарахгүй. */}
              <NotificationBell triggerClassName="size-11 text-foreground md:hidden" />
              <NotificationBellPopover className="text-foreground hidden size-10 md:flex" />
              <CartSheet triggerClassName="size-11 rounded-full max-md:-mr-2 md:size-10" />
              <div className="hidden items-center md:flex md:pl-3">
                <ProfileMenu />
              </div>
            </div>
          </div>

          <DesktopNav pathname={pathname} menus={menus} headerHidden={hidden} />
        </div>
      </header>
      {/* Header-ээс ГАДНА: header нь `-translate-y-full` transform авдаг тул
        дотор нь байвал toast-ын `fixed` байрлал header-тэй хамт гулсана. */}
      <NotificationCenter />
    </>
  );
}

/**
 * Desktop navigation row. A full-bleed rule separates it from the
 * logo/search row above (`chrome-rule-t`, the system's one border).
 *
 * An item with a `menu` opens a panel that spans the whole header width.
 * Click/Enter toggles it — tablets at `md` have no hover — and a mouse also
 * opens it on hover with a short intent delay, so sweeping the pointer across
 * the row on the way to the search field does not flash it open.
 */
function DesktopNav({
  pathname,
  menus,
  headerHidden,
}: {
  pathname: string;
  menus: Partial<Record<StoreMenuKey, React.ReactNode>>;
  headerHidden: boolean;
}) {
  const [open, setOpen] = React.useState<StoreMenuKey | null>(null);
  // Panel-ийн холбоос дарахад panel шууд хаагдана, харин шинэ хуудас
  // (тэгснээр `active`) хожуу ирнэ. Энэ хооронд trigger-ийн зураас/bold
  // унтарч байгаад буцаж асдаг байсан тул шилжилт дуустал тодруулсан хэвээр.
  const [landing, setLanding] = React.useState<StoreMenuKey | null>(null);
  const navRef = React.useRef<HTMLElement>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  // Hover-оор нээгдсэн panel дээр хэрэглэгч trigger-ийг "нээх" гэж дардаг.
  // Энэ click-ийг toggle гэж үзвэл panel хаагдаж анивчина — тиймээс эхний
  // click нь panel-ийг зүгээр л тогтооно, дараагийн click л хаана.
  const openedByHover = React.useRef(false);
  const panelId = React.useId();

  const schedule = React.useCallback(
    (next: StoreMenuKey | null, delay: number) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        openedByHover.current = next !== null;
        setOpen(next);
      }, delay);
    },
    [],
  );
  const close = React.useCallback(() => {
    clearTimeout(timer.current);
    openedByHover.current = false;
    setOpen(null);
  }, []);
  React.useEffect(() => () => clearTimeout(timer.current), []);

  // Navigating, or the header sliding away on scroll, closes the panel.
  React.useEffect(close, [pathname, close]);
  React.useEffect(() => setLanding(null), [pathname]);
  React.useEffect(() => {
    if (headerHidden) close();
  }, [headerHidden, close]);

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      close();
      navRef.current
        ?.querySelector<HTMLButtonElement>("[aria-expanded='true']")
        ?.focus();
    }
    function onPointerDown(e: PointerEvent) {
      if (!navRef.current?.contains(e.target as Node)) close();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, close]);

  const hoverProps = (key: StoreMenuKey | null) => ({
    onPointerEnter: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse") schedule(key, key ? 120 : 0);
    },
    onPointerLeave: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse") schedule(null, 180);
    },
  });

  const renderItems = (items: readonly StoreNavItem[], muted = false) => (
    <ul className="flex items-center gap-1">
      {items.map((item) => {
        const panel = item.menu ? menus[item.menu] : undefined;
        const active = isNavActive(item.href, pathname);
        const expanded = Boolean(item.menu && open === item.menu);
        const highlighted =
          active || expanded || Boolean(item.menu && landing === item.menu);
        const itemClass = cn(
          "relative flex h-11 items-center gap-1 px-3 text-sm transition-colors",
          "after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:transition-colors",
          highlighted
            ? "text-foreground after:bg-primary font-semibold"
            : cn(
                "hover:text-foreground after:bg-transparent",
                muted
                  ? "text-muted-foreground font-medium"
                  : "text-foreground/85 font-medium",
              ),
        );
        return (
          <li key={item.href}>
            {item.menu && panel ? (
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => {
                  clearTimeout(timer.current);
                  const keep = expanded && openedByHover.current;
                  openedByHover.current = false;
                  setOpen(expanded && !keep ? null : (item.menu ?? null));
                }}
                {...hoverProps(item.menu)}
                className={itemClass}
              >
                {item.label}
                <ChevronDown
                  aria-hidden
                  className={cn(
                    "size-4 transition-transform duration-200 motion-reduce:transition-none",
                    expanded && "rotate-180",
                  )}
                />
              </button>
            ) : (
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                {...hoverProps(null)}
                className={itemClass}
              >
                {item.label}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );

  const panel = open ? menus[open] : null;

  return (
    <nav
      ref={navRef}
      aria-label="Дэлгүүрийн цэс"
      className="chrome-rule-t relative hidden md:block"
    >
      <div className="mx-auto flex h-11 max-w-420 items-center justify-between gap-6 px-5">
        {renderItems(STORE_NAV_PRIMARY)}
        {renderItems(STORE_NAV_SECONDARY, true)}
      </div>
      <div
        id={panelId}
        hidden={!panel}
        {...hoverProps(open)}
        // Холбоос дарвал хаана: `?gender=` гэх мэт query л солигдвол
        // pathname өөрчлөгдөхгүй тул дээрх effect хаадаггүй.
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest("a")) return;
          setLanding(open);
          close();
        }}
        className="bg-background chrome-rule-t shadow-lift motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 absolute inset-x-0 top-full duration-200"
      >
        <div className="mx-auto max-w-420 px-8 pt-7 pb-9">{panel}</div>
      </div>
    </nav>
  );
}

/** Desktop wishlist shortcut — on phones it lives in the bottom nav. */
function WishlistLink() {
  const count = useWishlist(selectWishCount);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const shown = mounted ? count : 0;
  return (
    <Link
      href="/wishlist"
      aria-label={shown > 0 ? `Хүсэл, ${shown} бараа` : "Хүсэл"}
      className="text-foreground hover:bg-secondary relative hidden size-10 items-center justify-center rounded-full transition-colors md:flex"
    >
      <Heart className="size-5" />
      {shown > 0 && (
        <span className="bg-foreground text-background absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold">
          {shown}
        </span>
      )}
    </Link>
  );
}
