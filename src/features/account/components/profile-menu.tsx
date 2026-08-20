"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Package,
  HelpCircle,
  LogIn,
  LogOut,
  UserPlus,
  BookOpen,
  Info,
  Mail,
  LayoutDashboard,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/browser";
import { useIsStaff } from "@/features/account/use-staff";

interface Profile {
  name: string;
  email: string;
  avatar: string | null;
}

export function ProfileMenu() {
  const router = useRouter();
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [configured, setConfigured] = React.useState(true);
  const isStaff = useIsStaff();

  React.useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setConfigured(false);
      return;
    }
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: row } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", data.user.id)
        .maybeSingle();
      const p = row as {
        full_name?: string;
        avatar_url?: string | null;
      } | null;
      const email = data.user.email ?? "";
      // Утас-passcode бүртгэлийн дотоод имэйлээс зөвхөн дугаарыг нь харуулна.
      const displayId = email.endsWith("@phone.vonscent.mn")
        ? email.split("@")[0]
        : email;
      setProfile({
        name: p?.full_name || displayId || "vonscent гишүүн",
        email: displayId,
        avatar: p?.avatar_url ?? null,
      });
    });
  }, []);

  async function signOut() {
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
    setProfile(null);
    router.push("/");
    router.refresh();
  }

  const name = profile?.name ?? "Зочин";
  const initial = (profile?.name || profile?.email || "?")
    .charAt(0)
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Профайл цэс"
          className="bg-secondary text-foreground focus-visible:ring-ring relative size-9 shrink-0 overflow-hidden rounded-full transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2"
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
            <span className="flex h-full items-center justify-center text-sm font-semibold">
              {initial}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        {/* Нэвтрээгүй зочинд эхлээд нэвтрэх/бүртгүүлэх замыг тод харуулна. */}
        {configured && !profile && (
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
                {profile?.email && (
                  <span className="text-muted-foreground block truncate text-xs">
                    {profile.email}
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
        <DropdownMenuItem asChild>
          <Link href="/faq">
            <HelpCircle /> Түгээмэл асуулт
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/blog">
            <BookOpen /> Блог
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/about">
            <Info /> Танилцуулга
          </Link>
        </DropdownMenuItem>
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
            <DropdownMenuItem
              onSelect={signOut}
              className="text-red-400 focus:bg-red-500/10 focus:text-red-400 [&_svg]:text-red-400"
            >
              <LogOut /> Гарах
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
