"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Gift,
  HelpCircle,
  Info,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Package,
  Ticket,
} from "lucide-react";
import { Logo } from "./logo";
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
import { SignOutForm } from "@/features/account/components/sign-out-form";
import { cn } from "@/lib/utils";

/**
 * Гол зорилгууд — том, бичвэрээр. Доод цэс (`BottomNav`) Нүүр/Каталог/Багц/
 * Хүсэл/Профайлыг аль хэдийн үүрдэг тул энэ жагсаалт нь давхардлыг биш,
 * дэлгүүрийн бүрэн зургийг өгөх ёстой.
 */
const PRIMARY = [
  { href: "/catalog", label: "Каталог" },
  { href: "/collections", label: "Багц" },
  { href: "/catalog?tags=sale", label: "Хямдрал" },
  { href: "/lucky-wheel", label: "Азын хүрд" },
] as const;

/** Уншиж танилцах хуудсууд — капсулаар, жижгээр. */
const SECONDARY = [
  { href: "/blog", label: "Блог", icon: BookOpen },
  { href: "/about", label: "Бидний тухай", icon: Info },
  { href: "/contact", label: "Холбоо барих", icon: Mail },
  { href: "/faq", label: "Түгээмэл асуулт", icon: HelpCircle },
] as const;

/** Нэвтэрсэн хэрэглэгчийн богино замууд — таних хэсгийн доор. */
const ACCOUNT_SHORTCUTS = [
  { href: "/account/orders", label: "Захиалга", icon: Package },
  { href: "/account/loyalty", label: "V point", icon: Gift },
  { href: "/account/coupons", label: "Купон", icon: Ticket },
] as const;

export function MobileMenu({ className }: { className?: string }) {
  const pathname = usePathname();
  const signOutForm = React.useRef<HTMLFormElement>(null);
  const isStaff = useIsStaff();
  const { profile, loading, configured } = useProfileSummary();

  // Асуулт бүхий зам (`?tags=sale`) нь замаараа ялгагдахгүй тул идэвхтэй гэж
  // тэмдэглэхгүй — /catalog дээр байхад «Хямдрал» гэрэлтвэл худал мэдээлэл.
  const isActive = (href: string) =>
    !href.includes("?") && pathname.startsWith(href);

  return (
    <>
      <SignOutForm ref={signOutForm} />
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={className}
            aria-label="Цэс"
          >
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>

        <SheetContent
          side="left"
          className="bg-popover/95 shadow-lift flex w-[86vw] max-w-sm flex-col gap-0 p-0 backdrop-blur-xl"
        >
          {/* Толгой: брэнд өөрөө гарчиг. «Цэс» гэдэг үг дэлгэц эзлэхгүй, зөвхөн
            дэлгэц уншигчид үлдэнэ. Хаах товч нь Sheet-ийн өөрийн, баруун дээд. */}
          <SheetTitle className="sr-only">Цэс</SheetTitle>
          <div className="flex h-14 shrink-0 items-center px-5 pt-2">
            <SheetClose asChild>
              <Logo className="text-xl" />
            </SheetClose>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-4">
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
                          className="bg-muted hover:bg-accent flex h-16 flex-col items-center justify-center gap-1.5 rounded-[0.875rem] transition-colors"
                        >
                          <item.icon className="text-muted-foreground size-4.5" />
                          <span className="text-[11px] font-medium">
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

            {/* 2. Гол зорилгууд — бичвэрийн хэмжээ нь шатлалыг үүрнэ */}
            <nav className="mt-6 flex flex-col">
              {PRIMARY.map((item, i) => {
                const active = isActive(item.href);
                return (
                  <SheetClose asChild key={item.label}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      style={{ animationDelay: `${60 + i * 45}ms` }}
                      className={cn(
                        "animate-fade-up animation-duration-[380ms] motion-reduce:animate-none",
                        "flex items-center gap-3 py-2.5 text-xl font-semibold tracking-tight transition-colors",
                        active
                          ? "text-foreground"
                          : "text-foreground/70 hover:text-foreground",
                      )}
                    >
                      {item.label}
                      {active && (
                        <span className="bg-foreground size-1.5 shrink-0 rounded-full" />
                      )}
                    </Link>
                  </SheetClose>
                );
              })}
            </nav>

            {/* 3. Танилцах хуудсууд — капсул тор */}
            <div
              style={{ animationDelay: "240ms" }}
              className="animate-fade-up animation-duration-[380ms] mt-6 flex flex-wrap gap-2 motion-reduce:animate-none"
            >
              {SECONDARY.map((item) => (
                <SheetClose asChild key={item.href}>
                  <Link
                    href={item.href}
                    className="bg-secondary hover:bg-accent flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors"
                  >
                    <item.icon className="text-muted-foreground size-4 shrink-0" />
                    {item.label}
                  </Link>
                </SheetClose>
              ))}
            </div>
          </div>

          {/* 4. Тавцан: загвар сонгох — гар утаснаас хүрэх цорын ганц зам */}
          <div className="pb-safe bg-secondary/40 shrink-0 px-5 pt-4">
            <div className="flex h-11 items-center justify-between">
              <span className="text-muted-foreground text-[11px] font-medium tracking-[0.18em] uppercase">
                Загвар
              </span>
              <ThemeSwitcher />
            </div>

            <div
              className={cn(
                "flex items-center gap-2 pb-4",
                (isStaff || (configured && profile)) && "mt-2",
              )}
            >
              {isStaff && (
                <SheetClose asChild>
                  <Link
                    href="/admin"
                    className="bg-secondary hover:bg-accent flex h-11 flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-colors"
                  >
                    <LayoutDashboard className="size-4 shrink-0" /> Админ хэсэг
                  </Link>
                </SheetClose>
              )}
              {configured && profile && (
                // Форм нь Sheet-ийн ГАДНА (дээр) — самбар хаагдахад энэ товч
                // устдаг тул илгээхийг нь шууд өдөөнө.
                <button
                  type="button"
                  onClick={() => signOutForm.current?.requestSubmit()}
                  className="bg-destructive/10 text-destructive hover:bg-destructive/20 ml-auto flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors"
                >
                  <LogOut className="size-4 shrink-0" /> Гарах
                </button>
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
  const initial = profile.name.charAt(0).toUpperCase();
  return (
    <span className="bg-muted relative size-11 shrink-0 overflow-hidden rounded-full">
      {profile.avatar ? (
        <Image
          src={profile.avatar}
          alt=""
          fill
          sizes="44px"
          className="object-cover"
        />
      ) : (
        <span className="flex h-full items-center justify-center text-base font-semibold">
          {initial}
        </span>
      )}
    </span>
  );
}
