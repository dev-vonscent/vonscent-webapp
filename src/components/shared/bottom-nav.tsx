"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Heart, User, Boxes } from "lucide-react";
import { cn } from "@/lib/utils";
import { selectWishCount, useWishlist } from "@/features/wishlist/store";
import { useBottomNavHidden } from "@/components/shared/bottom-nav-store";

const LEFT = [
  { href: "/", label: "Нүүр", icon: Home },
  { href: "/catalog", label: "Каталог", icon: Search },
  { href: "/collections", label: "Багц", icon: Boxes },
] as const;

const RIGHT = [
  { href: "/wishlist", label: "Хүсэл", icon: Heart },
  // No prefetch: for a guest, middleware answers /account with a redirect to
  // /login, and the router caches that redirect. After signing in, a tap here
  // (or the post-login navigation) replayed it and showed the login form
  // again — vercel/next.js#88937. The page is behind auth either way, so
  // there is nothing useful to warm.
  { href: "/account", label: "Профайл", icon: User, prefetch: false },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const wishCount = useWishlist(selectWishCount);
  // Хуудасны үйлдлийн зурвас доод ирмэгийг эзэлсэн үед цэс замаа тавьж өгнө
  // (`useClaimBottomBar`). Унтраахын оронд гулсаж буух нь хаашаа явсныг
  // харуулж, буцаж гарахдаа ч гэнэт үсэрдэггүй.
  const hidden = useBottomNavHidden();

  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
  const badgeFor = (href: string) =>
    mounted && href === "/wishlist" ? wishCount : 0;

  return (
    <div
      className={cn(
        "pb-safe pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center transition-transform duration-300 ease-out motion-reduce:transition-none md:hidden",
        // Буцаж гарахдаа «Захиалах» зурвас гулсаж гарахыг хүлээнэ.
        hidden ? "translate-y-[140%]" : "delay-150",
      )}
    >
      <nav
        aria-label="Үндсэн цэс"
        // Дэлгэцээс гарсан цэс гарын товчлуураар ч бариулахгүй байх ёстой.
        inert={hidden}
        className="bg-secondary/85 shadow-lift pointer-events-auto mb-3 flex items-center gap-1 rounded-full px-2.5 py-2 backdrop-blur"
      >
        {LEFT.map((item) => (
          <Tab
            key={item.href}
            {...item}
            active={isActive(item.href)}
            current={pathname === item.href}
            badge={badgeFor(item.href)}
          />
        ))}

        {RIGHT.map((item) => (
          <Tab
            key={item.href}
            {...item}
            active={isActive(item.href)}
            current={pathname === item.href}
            badge={badgeFor(item.href)}
          />
        ))}
      </nav>
    </div>
  );
}

function Tab({
  href,
  label,
  icon: Icon,
  prefetch,
  active,
  current,
  badge,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  /** `false` for auth-gated pages — see `RIGHT`. */
  prefetch?: false;
  active: boolean;
  /** Яг энэ хуудсан дээр байгаа эсэх (дэд хуудас биш). */
  current: boolean;
  badge: number;
}) {
  // Аль хэдийн нээлттэй байгаа таб дээр дахин дарахад дахин ачаалахын оронд
  // дээш гүйлгэнэ (iOS-ийн таб цэсний зуршил). Query (каталогийн шүүлтүүр)
  // хадгалагдана — Link рүү явбал `/catalog` болж шүүлтүүр арилах байсан.
  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!current || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <Link
      href={href}
      prefetch={prefetch}
      onClick={onClick}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex size-11 items-center justify-center rounded-full transition-colors",
        active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon
        className="size-5.5 transition-transform"
        strokeWidth={active ? 2.3 : 1.8}
      />
      {badge > 0 && (
        <span className="bg-foreground text-background absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-semibold">
          {badge}
        </span>
      )}
      {active && (
        <span className="bg-foreground absolute bottom-1 size-1 rounded-full" />
      )}
    </Link>
  );
}
