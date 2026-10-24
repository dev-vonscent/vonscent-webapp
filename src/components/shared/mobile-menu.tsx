"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  Gift,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MessageSquarePlus,
  Package,
  PackageSearch,
  Ticket,
} from "lucide-react";
import {
  STORE_NAV_PRIMARY,
  STORE_NAV_SECONDARY,
  isNavActive,
} from "./store-nav";
import { ThemeSwitcher } from "./theme-switcher";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { useIsStaff } from "@/features/account/use-staff";
import { useProfileSummary } from "@/features/account/use-profile-summary";
import { useSignOutConfirm } from "@/features/account/components/use-sign-out-confirm";
import { cn } from "@/lib/utils";
import { useNewBadge } from "@/features/account/use-new-badge";
import { COUPONS_NEW_BADGE_UNTIL } from "@/lib/constants";
import { useFeatureFlag } from "@/components/feature-flags";
import { MenuAvatar } from "@/features/account/components/profile-menu";

/**
 * Гол зорилгууд — том, бичвэрээр. Зөвхөн доод цэс (`BottomNav`: Нүүр/
 * Каталог/Багц/Хүсэл/Профайл)-д БАЙХГҮЙ зүйл — давхардсан мөр цэсийг
 * урт болгож, чухлыг нь доош түлхдэг байв. «Үнэрээ олох» (quiz) нь нүүрний
 * IntentCards-д бий.
 */
const MENU_HIDDEN = new Set(["/catalog", "/collections", "/quiz"]);
const PRIMARY: { href: string; label: string; hint: string }[] = [
  ...STORE_NAV_PRIMARY,
  ...STORE_NAV_SECONDARY,
].filter((item) => !MENU_HIDDEN.has(item.href));

/** `PRIMARY`-ийн сүүлд — feature flag `lucky_wheel` нээлттэй үед л. */
const WHEEL_LINK = {
  href: "/lucky-wheel",
  label: "Азын хүрд",
  hint: "Эргүүлээд бэлгээ аваарай",
};

/**
 * Уншиж танилцах хуудсууд — капсулаар, жижгээр.
 *
 * «Захиалга хайх» нь зочны цорын ганц ил зам: нэвтрээгүй хүн захиалгаа
 * дугаар + утсаараа эндээс олно (доорх `ACCOUNT_SHORTCUTS`-ын «Захиалга» нь
 * нэвтэрсэн хүнд л гардаг).
 */
const SECONDARY = [
  { href: "/contact", label: "Холбоо барих", icon: Mail },
  { href: "/faq", label: "Түгээмэл асуулт", icon: HelpCircle },
  { href: "/order/find", label: "Захиалга хайх", icon: PackageSearch },
] as const;

/** `SECONDARY`-ийн сүүлд — feature flag `perfume_requests` (0137). */
const REQUEST_LINK = {
  href: "/request",
  label: "Үнэртэн санал болгох",
  icon: MessageSquarePlus,
} as const;

/** Нэвтэрсэн хэрэглэгчийн богино замууд — таних хэсгийн доор. */
const ACCOUNT_SHORTCUTS = [
  { href: "/account/orders", label: "Захиалга", icon: Package },
  { href: "/account/loyalty", label: "V point", icon: Gift },
  { href: "/account/coupons", label: "Купон", icon: Ticket, badge: "coupons" },
] as const;

export function MobileMenu({
  className,
  social,
}: {
  className?: string;
  /** Сошиал холбоосууд — server slot (social-links.tsx), өөрийн гарчигтай хэсэг. */
  social?: React.ReactNode;
}) {
  const pathname = usePathname();
  const [askSignOut, signOutDialog] = useSignOutConfirm();
  const isStaff = useIsStaff();
  const { profile, loading, configured } = useProfileSummary();
  const couponsNew = useNewBadge("coupons", COUPONS_NEW_BADGE_UNTIL);
  const primary = useFeatureFlag("lucky_wheel")
    ? [...PRIMARY, WHEEL_LINK]
    : PRIMARY;
  const secondary = [
    ...SECONDARY,
    ...(useFeatureFlag("perfume_requests") ? [REQUEST_LINK] : []),
    // Нэвтэрсэн хүнд дээрх «Захиалга» товчлол бий — давхардуулахгүй.
  ].filter((item) => !(profile && item.href === "/order/find"));

  const isActive = (href: string) => isNavActive(href, pathname);

  return (
    <>
      {signOutDialog}
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            // `Button` svg-г 16px болгодог — хайлт, хонх, сагстай ижил 20px.
            className={cn("[&_svg]:size-5", className)}
            aria-label="Цэс"
          >
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>

        <SheetContent
          side="left"
          className="bg-popover/95 shadow-lift flex w-[86vw] max-w-sm flex-col gap-0 p-0 backdrop-blur-xl"
        >
          {/* Толгой: лого БАЙХГҮЙ (дэлгүүрийн header-т аль хэдийн бий) —
            зөвхөн Sheet-ийн өөрийн хаах товч баруун дээд буланд. «Цэс» гэдэг
            үг дэлгэц уншигчид л үлдэнэ. */}
          <SheetTitle className="sr-only">Цэс</SheetTitle>

          {/* Нэг гүйлгэх багана; доод хэсэг (`mt-auto`) урсгал дотроо —
            тогтмол (fixed) тавцан биш. Цэс богино тул ихэнх утсанд гүйлгэх
            шаардлагагүй. */}
          <div className="pb-safe flex flex-1 flex-col overflow-y-auto overscroll-contain px-5 pt-14">
            {/* 1. Таних хэсэг */}
            <div className="animate-fade-up animation-duration-[380ms] motion-reduce:animate-none">
              {loading ? (
                <div className="bg-secondary h-19 animate-pulse rounded-2xl" />
              ) : profile ? (
                <div className="bg-secondary rounded-2xl p-1.5">
                  <SheetClose asChild>
                    <Link
                      href="/account"
                      className="hover:bg-accent flex items-center gap-3 rounded-[0.875rem] p-2.5 transition-colors"
                    >
                      <Avatar profile={profile} />
                      <span className="min-w-0">
                        <span className="block truncate text-base font-semibold tracking-tight">
                          {profile.name}
                        </span>
                        {profile.handle && (
                          <span className="text-muted-foreground block truncate text-xs">
                            {profile.handle}
                          </span>
                        )}
                      </span>
                    </Link>
                  </SheetClose>
                  <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                    {ACCOUNT_SHORTCUTS.map((item) => (
                      <SheetClose asChild key={item.href}>
                        <Link
                          href={item.href}
                          className="bg-background hover:bg-accent relative flex h-16 flex-col items-center justify-center gap-1.5 rounded-[0.875rem] transition-colors"
                        >
                          {"badge" in item && couponsNew && (
                            <span className="bg-success/10 text-success absolute top-1.5 right-1.5 rounded-full px-1.5 text-[10px]/4 font-medium">
                              Шинэ
                            </span>
                          )}
                          <item.icon className="text-muted-foreground size-5" />
                          <span className="text-sm font-medium">
                            {item.label}
                          </span>
                        </Link>
                      </SheetClose>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-secondary rounded-2xl p-4">
                  <p className="text-base font-semibold tracking-tight">
                    Тавтай морил
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Нэвтэрвэл захиалга бүрээс V point цуглуулна.
                  </p>
                  {configured && (
                    <div className="mt-4 flex gap-2">
                      <SheetClose asChild>
                        <Button asChild size="sm" className="flex-1">
                          <Link href="/login">Нэвтрэх</Link>
                        </Button>
                      </SheetClose>
                      <SheetClose asChild>
                        <Button
                          asChild
                          size="sm"
                          variant="ghost"
                          className="hover:bg-accent flex-1"
                        >
                          <Link href="/register">Бүртгүүлэх</Link>
                        </Button>
                      </SheetClose>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. Гол зорилгууд — мөр бүр гарчиг + тайлбар + сум; хуваагч
              зураасаар жагсаалт гэдэг нь танигдана */}
            <nav className="divide-border mt-5 flex flex-col divide-y">
              {primary.map((item, i) => {
                const active = isActive(item.href);
                return (
                  <SheetClose asChild key={item.label}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      style={{ animationDelay: `${60 + i * 45}ms` }}
                      className={cn(
                        "animate-fade-up animation-duration-[380ms] motion-reduce:animate-none",
                        "group flex items-center gap-3 py-3.5",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-xl font-semibold tracking-tight">
                          {item.label}
                          {active && (
                            <span className="bg-foreground size-1.5 shrink-0 rounded-full" />
                          )}
                        </span>
                        <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                          {item.hint}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-full",
                          active
                            ? "bg-foreground text-background"
                            : "bg-secondary text-foreground group-hover:bg-foreground group-hover:text-background",
                        )}
                      >
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </Link>
                  </SheetClose>
                );
              })}
            </nav>

            {/* 3. Танилцах хуудсууд — жижиг мөрүүд */}
            <nav
              aria-label="Тусламж"
              style={{ animationDelay: "240ms" }}
              className="animate-fade-up animation-duration-[380ms] mt-4 flex flex-col motion-reduce:animate-none"
            >
              {secondary.map((item) => (
                <SheetClose asChild key={item.href}>
                  <Link
                    href={item.href}
                    className="text-muted-foreground hover:text-foreground flex h-11 items-center gap-3 text-sm font-medium transition-colors"
                  >
                    <item.icon className="size-4 shrink-0" />
                    {item.label}
                  </Link>
                </SheetClose>
              ))}
            </nav>

            {/* 4. Доод хэсэг: сошиал + загвар нэг мөрөнд, дараа нь админ/гарах */}
            <div className="border-border mt-auto border-t pt-3 pb-4">
              <div className="flex h-11 items-center justify-between gap-3">
                {social}
                <ThemeSwitcher className="ml-auto" />
              </div>

              {(isStaff || (configured && profile)) && (
                <div className="mt-3 flex items-center gap-2">
                  {isStaff && (
                    <SheetClose asChild>
                      <Link
                        href="/admin"
                        className="bg-secondary hover:bg-accent flex h-11 flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-colors"
                      >
                        <LayoutDashboard className="size-4 shrink-0" /> Админ
                        хэсэг
                      </Link>
                    </SheetClose>
                  )}
                  {configured && profile && (
                    // Форм ба баталгаажуулах цонх нь Sheet-ийн ГАДНА (дээр) —
                    // самбар хаагдахад энэ товч устдаг.
                    <button
                      type="button"
                      onClick={askSignOut}
                      className="bg-destructive/10 text-destructive hover:bg-destructive/20 ml-auto flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors"
                    >
                      <LogOut className="size-4 shrink-0" /> Гарах
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function Avatar({
  profile,
}: {
  profile: { name: string; avatar: string | null };
}) {
  // Түвшний хүрээтэй (feature flag `user_tiers`) — цэс нээгдэх үед л.
  return <MenuAvatar src={profile.avatar} name={profile.name} size={44} />;
}
