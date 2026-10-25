"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  BellRing,
  BarChart3,
  Boxes,
  ChevronDown,
  Crown,
  Disc3,
  FileText,
  Flag,
  FlaskConical,
  Gift,
  Globe,
  Layers,
  LayoutDashboard,
  LayoutList,
  Megaphone,
  MessageSquarePlus,
  MessageSquareText,
  Menu,
  PartyPopper,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Receipt,
  ShoppingCart,
  SlidersHorizontal,
  Store,
  Tag,
  Tags,
  TicketPercent,
  Users,
  Warehouse,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/shared/logo";
import { ThemeSwitcher } from "@/components/shared/theme-switcher";
import { useQuery } from "@tanstack/react-query";
import { adminFetch } from "@/features/admin/lib/mutate";
import type { SidebarBadges } from "@/features/admin/api";
import { useFeatureFlagSet } from "@/components/feature-flags";
import type { FeatureFlag } from "@/lib/constants";

interface NavLink {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: keyof SidebarBadges;
  /** Feature flag хаалттай үед холбоос харагдахгүй (хуудас өөрөө 404). */
  flag?: FeatureFlag;
}

/**
 * Тоолуурын badge нь дэлгэц уншигчид ганц тоо болж уншигддаг («3») тул
 * утга нь `sr-only` мөрөөр хэлэгдэнэ.
 */
const BADGE_LABEL: Record<keyof SidebarBadges, string> = {
  newOrders: "шинэ захиалга",
  outOfStock: "дууссан бараа",
};

interface NavGroup {
  title: string | null;
  /** Хураасан баганад бүлгийг төлөөлөх icon (гарчигтай бүлэгт). */
  icon?: React.ComponentType<{ className?: string }>;
  links: NavLink[];
}

const GROUPS: NavGroup[] = [
  {
    title: null,
    links: [
      { href: "/admin", label: "Хяналтын самбар", icon: LayoutDashboard },
    ],
  },
  {
    title: "Борлуулалт",
    icon: Receipt,
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
    icon: Package,
    links: [
      // Үлдэгдэл нь тусдаа хуудас байхаа больсон (0047 / products-table) —
      // мл-ийн үйлдэл барааны мөр дээр хийгддэг тул «дууссан» тоо ч энд гарна.
      {
        href: "/admin/products",
        label: "Бараа",
        icon: Boxes,
        badge: "outOfStock",
      },
      // Түгжигдсэн мл нь барааны мөрөн дээрх «+N ml захиалагдсан» гэсэн
      // тоог задалдаг тул Бараа-гийн яг дор (0075 / backlog §2.4).
      { href: "/admin/reservations", label: "Түгжигдсэн мл", icon: Warehouse },
      // Хоосон савны нөөц (0095) — «Түгжигдсэн мл»-ээс ТУСДАА ойлголт:
      // тэр нь захиалгын барьсан шингэн, энэ нь өнгө/хэмжээний хоосон сав.
      { href: "/admin/bottles", label: "Савны нөөц", icon: FlaskConical },
      { href: "/admin/collections", label: "Багц", icon: Layers },
      { href: "/admin/brands", label: "Брэнд", icon: Crown },
      // Хэрэглэгчийн санал болгосон, манайд байхгүй үнэртэн (0137).
      {
        href: "/admin/requests",
        label: "Үнэртний санал",
        icon: MessageSquarePlus,
        flag: "perfume_requests",
      },
      { href: "/admin/scent-families", label: "Үнэрийн төрөл", icon: Tags },
      { href: "/admin/tags", label: "Нэмэлт таг", icon: Tag },
    ],
  },
  {
    title: "Маркетинг",
    icon: Megaphone,
    links: [
      { href: "/admin/promotions", label: "Урамшуулал", icon: TicketPercent },
      { href: "/admin/loyalty", label: "V point", icon: Award },
      // Сэтгэгдлийн хяналт (0162).
      {
        href: "/admin/reviews",
        label: "Сэтгэгдэл",
        icon: MessageSquareText,
        flag: "review_moderation",
      },
      { href: "/admin/gifts", label: "Бэлгийн үнэрүүд", icon: Gift },
      { href: "/admin/lucky-wheel", label: "Азын хүрд", icon: Disc3 },
      {
        href: "/admin/campaigns",
        label: "Кампанит ажил",
        icon: PartyPopper,
        flag: "campaigns",
      },
      {
        href: "/admin/broadcasts",
        label: "Мэдэгдэл илгээх",
        icon: BellRing,
        flag: "notifications",
      },
    ],
  },
  {
    title: "Сайт",
    icon: Globe,
    links: [
      { href: "/admin/content", label: "Контент", icon: FileText },
      {
        href: "/admin/home-sections",
        label: "Нүүрийн хэсэг",
        icon: LayoutList,
      },
    ],
  },
  // Гарчиггүй байхад «Сайт» хаагдсан үед эдгээр нь түүний доор үлдэж,
  // «Сайт = Тохиргоо + Feature flag» гэж ойлгогдож байсан — Контент ба
  // Нүүрийн хэсэг харагдахаа больдог байв. Тиймээс өөрийн гарчигтай.
  {
    title: "Систем",
    icon: SlidersHorizontal,
    links: [
      { href: "/admin/settings", label: "Тохиргоо", icon: Settings },
      { href: "/admin/feature-flags", label: "Feature flag", icon: Flag },
    ],
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
  {
    href: "/admin/products",
    label: "Бараа",
    icon: Boxes,
    badge: "outOfStock",
  },
  {
    href: "/admin/products?stock=low&sort=stock",
    label: "Үлдэгдэл бага",
    icon: Warehouse,
  },
];

/** Ширээний багана icon-only болж хураагдсан эсэх (хэрэглэгч бүрийн тохиргоо). */
const COLLAPSED_KEY = "admin-nav-collapsed";
// Идэвхтэй хуудас ямар ч бүлэгт хамаарахгүй үед (самбар) нээгдэх бүлэг.
const DEFAULT_OPEN = "Борлуулалт";

/**
 * The counts, fetched by the sidebar itself rather than handed down by the
 * layout.
 *
 * `(admin)/layout.tsx` re-renders on every admin navigation, so awaiting these
 * two Supabase counts there put ~200-350ms in front of every sidebar click —
 * the route could not even show its `loading.tsx` until they came back. They
 * are decoration: the nav is fully usable while they are missing, so they
 * belong on their own request. A minute of staleness on a "new orders" badge
 * is fine; a minute of lag on the whole panel is not.
 */
function useSidebarBadges(): SidebarBadges {
  const { data } = useQuery<SidebarBadges>({
    queryKey: ["admin-sidebar-badges"],
    queryFn: async () => {
      // `adminFetch`, not a bare fetch: eslint bans the raw call anywhere
      // under features/admin so an unchecked response can never ship.
      const res = await adminFetch<SidebarBadges>("/api/admin/badges", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  return data ?? NO_BADGES;
}

/**
 * Загвар сонгогч — дэлгүүрийн цэстэй ижил `ThemeSwitcher`. next-themes нэг
 * түлхүүрт хадгалдаг тул админд сонгосон загвар дэлгүүрт ч хэрэгжинэ.
 */
function ThemeRow() {
  return (
    <div className="flex h-11 items-center justify-between gap-2 pr-1 pl-3">
      <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.15em] uppercase">
        Загвар
      </span>
      <ThemeSwitcher />
    </div>
  );
}

/** Хулгана гарсны дараа flyout хаагдах хүртэлх хугацаа — icon-оос цонх руу
 *  шилжих зуур хаагдчихгүйн тулд. */
const RAIL_CLOSE_DELAY = 150;

function RailGroup({
  title,
  icon: Icon,
  links,
  pathname,
  badges,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  links: NavLink[];
  pathname: string;
  badges: SidebarBadges;
}) {
  const [open, setOpen] = React.useState(false);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), RAIL_CLOSE_DELAY);
  };
  React.useEffect(() => cancelClose, []);

  const active = links.some((l) => isActive(pathname, l.href));
  const badgeTotal = links.reduce(
    (sum, l) => sum + (l.badge ? badges[l.badge] : 0),
    0,
  );
  // Хулганаар л hover-оор нээнэ; мэдрэгч дэлгэц, гар — дарахад.
  const isMouse = (e: React.PointerEvent) => e.pointerType === "mouse";

  return (
    // `modal={false}` — hover-оор нээгдсэн цонх хуудасны бусад хэсгийг
    // түгжихгүй, хулгана гармагц хаагдана.
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger
        aria-label={title}
        title={title}
        onPointerEnter={(e) => {
          if (!isMouse(e)) return;
          cancelClose();
          setOpen(true);
        }}
        onPointerLeave={(e) => isMouse(e) && scheduleClose()}
        onPointerDown={(e) => {
          // Hover-оор аль хэдийн нээгдсэн бол дарах нь хаах ёсгүй (Radix
          // trigger toggle хийдэг) — `preventDefault` түүний handler-ийг алгасна.
          if (isMouse(e) && open) e.preventDefault();
        }}
        className={cn(
          "relative flex min-h-10 items-center justify-center rounded-md transition-colors outline-none",
          "focus-visible:ring-ring focus-visible:ring-2",
          active || open
            ? "bg-secondary text-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        <Icon className="size-4" />
        {badgeTotal > 0 && (
          <span className="bg-foreground text-background absolute top-0.5 right-1 min-w-4 rounded-full px-1 text-center text-[10px]/4 font-semibold">
            {badgeTotal}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="right"
        align="start"
        sideOffset={8}
        className="min-w-52"
        onPointerEnter={cancelClose}
        onPointerLeave={(e) => isMouse(e) && scheduleClose()}
        // Hover-оор нээхэд фокус цонх руу үсрэхгүй (хуудсан дээрх фокус
        // хэвээр); гарнаас нээхэд Radix өөрөө эхний мөрт фокуслана.
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <p className="text-muted-foreground px-3 pt-1.5 pb-1 text-[11px] font-semibold tracking-[0.15em] uppercase">
          {title}
        </p>
        {links.map((l) => {
          const linkActive = isActive(pathname, l.href);
          const count = l.badge ? badges[l.badge] : 0;
          return (
            <DropdownMenuItem key={l.href} asChild>
              <Link
                href={l.href}
                aria-current={linkActive ? "page" : undefined}
                className={cn(linkActive && "bg-secondary font-medium")}
              >
                <l.icon className="size-4" />
                {l.label}
                {count > 0 && l.badge && (
                  <span className="bg-foreground text-background ml-auto rounded-full px-1.5 text-[11px]/4 font-semibold">
                    {count}
                    <span className="sr-only"> {BADGE_LABEL[l.badge]}</span>
                  </span>
                )}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function isActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

const NO_BADGES: SidebarBadges = { newOrders: 0, outOfStock: 0 };

export function AdminSidebar() {
  const pathname = usePathname();
  const badges = useSidebarBadges();
  const flags = useFeatureFlagSet();
  const groups = React.useMemo(
    () =>
      GROUPS.map((g) => ({
        ...g,
        links: g.links.filter((l) => !l.flag || flags.has(l.flag)),
      })),
    [flags],
  );

  // Нэг удаад ганц бүлэг нээлттэй (accordion): нэгийг нээхэд бусад нь
  // хаагдана. Нээлттэй бүлэг нь одоогийн хуудасных — тиймээс хадгалах
  // шаардлагагүй, сервер ба клиент ижил утгаар эхэлнэ.
  const [open, setOpen] = React.useState<string | null>(
    () =>
      groups.find(
        (g) => g.title && g.links.some((l) => isActive(pathname, l.href)),
      )?.title ?? DEFAULT_OPEN,
  );

  // Ширээний багана хураах — хүснэгт ихтэй хуудсанд 240px буцааж өгнө.
  // Accordion-ий адил mount-ын дараа уншина (SSR зөрөхгүй).
  const [collapsed, setCollapsed] = React.useState(false);
  React.useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1");
    } catch {
      // ignore — expanded by default
    }
  }, []);
  function toggleCollapsed() {
    setCollapsed((prev) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, prev ? "0" : "1");
      } catch {
        // storage unavailable — state still works for the session
      }
      return !prev;
    });
  }

  function toggle(title: string) {
    setOpen((prev) => (prev === title ? null : title));
  }

  const renderLink = (l: NavLink, close = false, iconOnly = false) => {
    const active = isActive(pathname, l.href);
    const badgeCount = l.badge ? badges[l.badge] : 0;
    const link = (
      <Link
        key={l.href}
        href={l.href}
        // Идэвхтэй хуудсыг зөвхөн ӨНГӨӨР хэлж байсан — дэлгэц уншигчид
        // огт мэдэгддэггүй байв (WCAG 1.4.1).
        aria-current={active ? "page" : undefined}
        // Хураасан үед шошго харагдахгүй — hover-т гарах tooltip.
        title={iconOnly ? l.label : undefined}
        className={cn(
          "flex min-h-11 shrink-0 items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors lg:min-h-0",
          iconOnly && "relative justify-center px-0",
          active
            ? "bg-secondary text-foreground font-medium"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        <l.icon className="size-4" />
        {iconOnly ? <span className="sr-only">{l.label}</span> : l.label}
        {iconOnly && badgeCount > 0 && l.badge ? (
          <span className="bg-foreground text-background absolute top-0.5 right-1 min-w-4 rounded-full px-1 text-center text-[10px]/4 font-semibold">
            {badgeCount}
            <span className="sr-only"> {BADGE_LABEL[l.badge]}</span>
          </span>
        ) : (
          badgeCount > 0 &&
          l.badge && (
            <span className="bg-foreground text-background ml-auto rounded-full px-1.5 text-[11px]/4 font-semibold">
              {badgeCount}
              <span className="sr-only"> {BADGE_LABEL[l.badge]}</span>
            </span>
          )
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
    groups.map((g, i) =>
      g.title === null ? (
        <div key={i} className="flex flex-col gap-1">
          {g.links.map((l) => renderLink(l, close))}
        </div>
      ) : (
        <div key={g.title} className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => toggle(g.title!)}
            aria-expanded={open === g.title}
            className="text-muted-foreground hover:text-foreground flex w-full items-center justify-between px-3 pt-4 pb-1 text-[11px] font-semibold tracking-[0.15em] uppercase transition-colors"
          >
            {g.title}
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform",
                open === g.title && "rotate-180",
              )}
            />
          </button>
          {/* Өндрийг 0fr ↔ 1fr grid мөрөөр анимэйшн хийнэ (`height: auto`
              руу transition ажилладаггүй). Хаалттай үед `inert` — нуусан
              холбоосууд Tab-д болон дэлгэц уншигчид хүрэхгүй. */}
          <div
            inert={open !== g.title}
            className={cn(
              "grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none",
              open === g.title
                ? "grid-rows-[1fr] opacity-100"
                : "grid-rows-[0fr] opacity-0",
            )}
          >
            <div className="flex min-h-0 flex-col gap-1 overflow-hidden">
              {g.links.map((l) => renderLink(l, close))}
            </div>
          </div>
        </div>
      ),
    );

  // Хураасан багана: 21 icon намхан дэлгэцэнд багтахгүй гүйлгэх зурвас үүсгэж
  // байсан тул бүлэг бүр ганц icon — дээр нь очих/дарахад холбоосууд нь
  // хажууд гарна (Linear, VS Code-ийн адил). Гарчиггүй бүлэг (самбар) шууд.
  const renderRail = () =>
    groups.map((g, i) =>
      g.title === null || !g.icon ? (
        <div key={g.title ?? i} className="flex flex-col gap-1">
          {g.links.map((l) => renderLink(l, false, true))}
        </div>
      ) : (
        <RailGroup
          key={g.title}
          title={g.title}
          icon={g.icon}
          links={g.links}
          pathname={pathname}
          badges={badges}
        />
      ),
    );

  const currentLabel =
    groups.flatMap((g) => g.links).find((l) => isActive(pathname, l.href))
      ?.label ?? "Админ";

  // Ширээний компьютерт багана нь дэлгэцэнд наалдана (`sticky`, бүтэн өндөр):
  // 25 холбоос бүхий цэс хуудас гүйлгэсний дараа алга болдог байв. Цэсний
  // жагсаалт өөрөө тусдаа гүйнэ — лого ба доод холбоос хөдөлгөөнгүй үлдэнэ.
  return (
    // Утсан дээр aside нь зөвхөн 56px-ийн дээд мөр — `sticky top-0` тул доош
    // гүйлгэсэн ч цэсний товч гарт байна (өмнө нь дээш буцаж байж нээгддэг
    // байв). `z-40` — хуудасны агуулгаас дээр, Sheet (z-50)-ээс доор.
    <aside
      className={cn(
        "bg-card sticky top-0 z-40 lg:flex lg:h-svh lg:shrink-0 lg:flex-col print:hidden",
        collapsed ? "lg:w-16" : "lg:w-60",
      )}
    >
      {/* ── Mobile: top bar + slide-in sheet (5a) ── */}
      <div className="flex h-14 items-center gap-2 px-3 lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <button
              type="button"
              className="hover:bg-accent flex size-11 items-center justify-center rounded-md"
              aria-label="Цэс нээх"
            >
              <Menu className="size-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="gap-0 p-4">
            <SheetHeader className="mb-3">
              <SheetTitle className="flex items-center gap-2">
                <Logo />
                <span className="text-muted-foreground text-xs font-medium">
                  admin
                </span>
              </SheetTitle>
            </SheetHeader>

            {/* Зөвхөн энэ хэсэг гүйнэ — «Загвар» ба «Дэлгүүр рүү буцах» нь
                ширээний баганын адил доор үргэлж харагдана. */}
            <div className="-mx-4 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">
              {/* Quick tiles — the three screens an admin opens all day */}
              <div className="mb-2 grid grid-cols-3 gap-2">
                {QUICK.map((q) => {
                  const badgeCount = q.badge ? badges[q.badge] : 0;
                  return (
                    <SheetClose asChild key={q.href}>
                      <Link
                        href={q.href}
                        aria-current={
                          isActive(pathname, q.href) ? "page" : undefined
                        }
                        className={cn(
                          "relative flex flex-col items-center justify-center gap-1.5 rounded-lg px-1 py-3 text-center text-xs/tight font-medium transition-colors",
                          isActive(pathname, q.href)
                            ? "bg-secondary"
                            : "bg-secondary/50 hover:bg-accent",
                        )}
                      >
                        <q.icon className="size-5" />
                        {q.label}
                        {badgeCount > 0 && (
                          <span className="bg-foreground text-background absolute top-1.5 right-1.5 rounded-full px-1.5 text-[11px]/4 font-semibold">
                            {badgeCount}
                            {q.badge && (
                              <span className="sr-only">
                                {" "}
                                {BADGE_LABEL[q.badge]}
                              </span>
                            )}
                          </span>
                        )}
                      </Link>
                    </SheetClose>
                  );
                })}
              </div>

              <nav aria-label="Админ цэс" className="flex flex-col gap-1">
                {renderGroups(true)}
              </nav>
            </div>

            <div className="border-border mt-2 shrink-0 border-t pt-2">
              <ThemeRow />

              <SheetClose asChild>
                <Link
                  href="/"
                  className="text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-3 rounded-md px-3 py-2.5 text-sm"
                >
                  <Store className="size-4" />
                  Дэлгүүр рүү буцах
                </Link>
              </SheetClose>
            </div>
          </SheetContent>
        </Sheet>
        {/* No "admin" tag here: on a phone the whole chrome is the admin panel
            and the label only competed with the page name. It stays on the
            desktop column, where it sits under the logo as a wordmark. */}
        <span className="text-sm font-medium">{currentLabel}</span>
      </div>

      {/* ── Desktop: grouped accordion column (5b) ── */}
      <div
        className={cn(
          "hidden h-16 items-center lg:flex",
          collapsed ? "justify-center" : "pr-3 pl-6",
        )}
      >
        {!collapsed && (
          <>
            <Logo />
            <span className="text-muted-foreground ml-2 text-xs font-medium">
              admin
            </span>
          </>
        )}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Цэсийг дэлгэх" : "Цэсийг хураах"}
          title={collapsed ? "Цэсийг дэлгэх" : "Цэсийг хураах"}
          className={cn(
            "text-muted-foreground hover:bg-accent hover:text-foreground flex size-9 items-center justify-center rounded-md transition-colors",
            !collapsed && "ml-auto",
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <PanelLeftClose className="size-4" />
          )}
        </button>
      </div>
      {/* Хоёр nav landmark (мобайл sheet + ширээний багана) нэг хуудсанд
          зэрэг байж болох тул тус бүр нэртэй. */}
      <nav
        aria-label="Админ цэс"
        // `min-h-0` байхгүй бол flex хүүхэд агуулгаараа сунаж, `overflow-y`
        // хэзээ ч идэвхжихгүй (flex item-ийн өгөгдмөл `min-height: auto`).
        // `overscroll-contain` — цэсний төгсгөлд хүрэхэд гүйлт хуудас руу
        // үсэрч шилжихгүй.
        className={cn(
          "hidden flex-col gap-1 overflow-y-auto overscroll-contain lg:flex lg:min-h-0 lg:flex-1",
          // Бүлгийн icon-оор ердөө 6 мөр тул бараг гүйхгүй; гүйсэн ч 64px-ийн
          // баганаас зурвас өргөн авч icon-уудыг төвөөс нь зөрүүлэхгүй.
          collapsed ? "no-scrollbar px-2" : "px-3",
        )}
      >
        {collapsed ? renderRail() : renderGroups()}
      </nav>
      <div
        className={cn(
          "border-border mt-auto hidden shrink-0 space-y-1 border-t lg:block",
          collapsed ? "p-2" : "p-3",
        )}
      >
        {/* 4 өнгийн товч 64px-д багтахгүй — хураасан үед нуугдана. */}
        {!collapsed && <ThemeRow />}
        <Link
          href="/"
          title={collapsed ? "Дэлгүүр рүү буцах" : undefined}
          className={cn(
            "text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-3 rounded-md py-2.5 text-sm",
            collapsed ? "justify-center" : "px-3",
          )}
        >
          <Store className="size-4" />
          {collapsed ? (
            <span className="sr-only">Дэлгүүр рүү буцах</span>
          ) : (
            "Дэлгүүр рүү буцах"
          )}
        </Link>
      </div>
    </aside>
  );
}
