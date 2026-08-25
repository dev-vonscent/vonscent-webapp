"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Heart, User, Boxes } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWishlist } from "@/features/wishlist/store";

const LEFT = [
  { href: "/", label: "Нүүр", icon: Home },
  { href: "/catalog", label: "Каталог", icon: Search },
  { href: "/collections", label: "Багц", icon: Boxes },
] as const;

const RIGHT = [
  { href: "/wishlist", label: "Хүсэл", icon: Heart },
  { href: "/account", label: "Профайл", icon: User },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const wishCount = useWishlist((s) => s.ids.length);

  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
  const badgeFor = (href: string) =>
    mounted && href === "/wishlist" ? wishCount : 0;

  return (
    <div className="pb-safe pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center md:hidden">
      <nav
        aria-label="Үндсэн цэс"
        className="bg-secondary/85 shadow-lift pointer-events-auto mb-3 flex items-center gap-1 rounded-full px-2.5 py-2 backdrop-blur"
      >
        {LEFT.map((item) => (
          <Tab
            key={item.href}
            {...item}
            active={isActive(item.href)}
            badge={badgeFor(item.href)}
          />
        ))}

        {RIGHT.map((item) => (
          <Tab
            key={item.href}
            {...item}
            active={isActive(item.href)}
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
  active,
  badge,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  badge: number;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
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
