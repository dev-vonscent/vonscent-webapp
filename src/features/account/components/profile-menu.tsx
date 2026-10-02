"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Package,
  PackageSearch,
  Disc3,
  HelpCircle,
  LogIn,
  LogOut,
  UserPlus,
  Mail,
  LayoutDashboard,
  Palette,
  Ticket,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ThemeSwitcher } from "@/components/shared/theme-switcher";
import { useProfileSummary } from "@/features/account/use-profile-summary";
import { useIsStaff } from "@/features/account/use-staff";
import { useSignOutConfirm } from "@/features/account/components/use-sign-out-confirm";
import { Badge } from "@/components/ui/badge";
import { useNewBadge } from "@/features/account/use-new-badge";
import { COUPONS_NEW_BADGE_UNTIL, LUCKY_WHEEL_HIDDEN } from "@/lib/constants";

export function ProfileMenu() {
  const [askSignOut, signOutDialog] = useSignOutConfirm();
  const couponsNew = useNewBadge("coupons", COUPONS_NEW_BADGE_UNTIL);
  // Таб даяар кэштэй — админаас дэлгүүр рүү буцахад header дахин mount
  // болсон ч зураг, нэр шууд зурагдана (use-profile-summary.ts).
  const { profile, loading, configured } = useProfileSummary();
  const isStaff = useIsStaff();

  const name = profile?.name ?? "Зочин";
  const initial = (profile?.name || profile?.handle || "?")
    .charAt(0)
    .toUpperCase();

  return (
    <>
      {signOutDialog}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Профайл цэс"
            className="bg-secondary text-foreground relative size-9 shrink-0 overflow-hidden rounded-full transition-transform hover:scale-105"
          >
            {profile?.avatar ? (
              <Image
                src={profile.avatar}
                alt={name}
                fill
                sizes="36px"
                className="object-cover"
              />
            ) : (
              // Анх ачаалж байхад хоосон дугуй — «?» гараад нэр рүү үсрэхгүй.
              <span className="flex h-full items-center justify-center text-sm font-semibold">
                {loading ? null : initial}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          {/* Нэвтрээгүй зочинд эхлээд нэвтрэх/бүртгүүлэх замыг тод харуулна. */}
          {configured && !loading && !profile && (
            <>
              <DropdownMenuItem asChild>
                <Link href="/login" className="font-semibold">
                  <LogIn /> Нэвтрэх
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/register">
                  <UserPlus /> Бүртгүүлэх
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          {/* Header card — avatar + username, links to the profile page. */}
          {profile && (
            <DropdownMenuItem asChild className="gap-3 px-2.5 py-2">
              <Link href="/account">
                <span className="bg-secondary relative size-10 shrink-0 overflow-hidden rounded-full">
                  {profile?.avatar ? (
                    <Image
                      src={profile.avatar}
                      alt=""
                      fill
                      sizes="40px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="flex h-full items-center justify-center text-sm font-semibold">
                      {initial}
                    </span>
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {name}
                  </span>
                  {profile?.handle && (
                    <span className="text-muted-foreground block truncate text-xs">
                      {profile.handle}
                    </span>
                  )}
                </span>
              </Link>
            </DropdownMenuItem>
          )}

          {profile && <DropdownMenuSeparator />}

          {profile && (
            <DropdownMenuItem asChild>
              <Link href="/account/orders">
                <Package /> Миний захиалга
              </Link>
            </DropdownMenuItem>
          )}
          {profile && (
            <DropdownMenuItem asChild>
              <Link href="/account/coupons">
                <Ticket /> Миний купон
                {couponsNew && (
                  <Badge
                    variant="new"
                    className="ml-auto px-1.5 py-0 text-[10px]"
                  >
                    Шинэ
                  </Badge>
                )}
              </Link>
            </DropdownMenuItem>
          )}
          {profile && !LUCKY_WHEEL_HIDDEN && (
            <DropdownMenuItem asChild>
              <Link href="/lucky-wheel">
                <Disc3 /> Азын хүрд
              </Link>
            </DropdownMenuItem>
          )}
          {/* Зочинд захиалгаа олох цорын ганц ил зам — дугаар + утсаар хайна.
              Нэвтэрсэн хүн дээрх «Миний захиалга»-аас шууд ордог тул давхар
              мөр гаргахгүй. */}
          {!profile && (
            <DropdownMenuItem asChild>
              <Link href="/order/find">
                <PackageSearch /> Захиалга хайх
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link href="/faq">
              <HelpCircle /> Түгээмэл асуулт
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Загвар — DropdownMenuItem биш: swatch дарахад цэс хаагдвал сонголтоо
            эргэж харах боломжгүй болно. Тул энэ мөр нь сонгогдох item биш. */}
          <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
            <Palette className="text-muted-foreground size-4 shrink-0" />
            <span>Загвар</span>
            <ThemeSwitcher className="ml-auto" />
          </div>

          <DropdownMenuSeparator />

          <DropdownMenuItem asChild>
            <Link href="/contact">
              <Mail /> Холбоо барих
            </Link>
          </DropdownMenuItem>

          {isStaff && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/admin">
                  <LayoutDashboard /> Админ хэсэг
                </Link>
              </DropdownMenuItem>
            </>
          )}

          {configured && profile && (
            <>
              <DropdownMenuSeparator />
              {/* Форм ба баталгаажуулах цонх нь цэсний ГАДНА (дээр)
                  зурагдсан — цэс хаагдахад энэ товч устдаг.
                  Цэс хаагдаж байх зуур диалог нээгдэж чаддаггүй тул
                  анхдагч сонголтыг зогсоож, цэсийг цонхны ард үлдээнэ. */}
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  askSignOut();
                }}
                className="text-red-400 focus:bg-red-500/10 focus:text-red-400 [&_svg]:text-red-400"
              >
                <LogOut /> Гарах
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
