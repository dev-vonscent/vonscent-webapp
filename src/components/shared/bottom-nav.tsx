"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  LayoutGrid,
  Heart,
  User,
  Boxes,
  Loader2,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { selectWishCount, useWishlist } from "@/features/wishlist/store";
import { useBottomNavHidden } from "@/components/shared/bottom-nav-store";
import { useChatLauncher } from "@/features/chat/use-chat-launcher";

/**
 * Шил гадаргуу — цэс ба чатын товч хоёуланд. Тунгалаг дэвсгэр + хүчтэй
 * blur/saturate нь ард гүйж буй зургийн өнгийг шингээнэ; нимгэн хүрээ ба
 * дээд ирмэгийн гэрэл (inset) нь шилний ирмэгийг заана. Gradient-гүй.
 */
const GLASS =
  "bg-secondary/55 border-foreground/10 inset-shadow-foreground/10 shadow-lift border inset-shadow-2xs backdrop-blur-xl backdrop-saturate-150";

const LEFT = [
  { href: "/", label: "Нүүр", icon: Home },
  { href: "/catalog", label: "Каталог", icon: LayoutGrid },
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
      {/* Цэс + баруун талд нь тусдаа чатын товч (Crisp-ийн апп шиг). Нэг
          wrapper дотор тул «Захиалах» зурвас гарахад хамт нуугдана. */}
      {/* Дээд pill шиг дэлгэцийн өргөнийг (хоёр талд 16px) дүүргэнэ — табууд
          жигд тарна. Чатын дугуй цэстэй ижил өндөр: таб 48 + padding 12 + хүрээ 2 = 62px.
          `aspect-square` + stretch нь өргөнийг хожуу тогтоож төвлөрөлтийг
          эвддэг (360px дээр дэлгэцээс гардаг байсан) тул тогтмол хэмжээ. */}
      <div className="mb-3 flex w-full items-center gap-2 px-4">
        <nav
          aria-label="Үндсэн цэс"
          // Дэлгэцээс гарсан цэс гарын товчлуураар ч бариулахгүй байх ёстой.
          inert={hidden}
          className={cn(
            GLASS,
            "pointer-events-auto flex flex-1 items-center justify-between rounded-full p-1.5",
          )}
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
        <ChatTab hidden={hidden} />
      </div>
    </div>
  );
}

/**
 * Утасны чатын орох хаалга. Хөвөгч товч бараа, сагслах товчийг дардаг
 * байсан тул цэсний хажууд, цэстэй ижил өндөр дугуй товч болгосон.
 */
function ChatTab({ hidden }: { hidden: boolean }) {
  const { connecting, unread, launch } = useChatLauncher();
  return (
    <button
      type="button"
      onClick={() => void launch()}
      inert={hidden}
      data-chat-entry
      aria-busy={connecting}
      aria-label={
        unread > 0 ? `Админаас ${unread} шинэ мессеж` : "Бидэнтэй чатлах"
      }
      className={cn(
        GLASS,
        "text-foreground pointer-events-auto relative flex size-15.5 shrink-0 flex-col items-center justify-center gap-1 rounded-full",
      )}
    >
      {connecting ? (
        <Loader2 className="size-5 animate-spin" />
      ) : (
        <MessageCircle className="size-5" strokeWidth={1.8} />
      )}
      <span aria-hidden className="text-[10px] leading-none font-medium">
        Чат
      </span>
      {unread > 0 && (
        <span className="bg-destructive text-destructive-foreground absolute top-1.5 right-2 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-semibold tabular-nums">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>
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
  icon: LucideIcon;
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
      aria-current={active ? "page" : undefined}
      // Icon дангаараа «Каталог» (сүлжээ) ба «Багц» (хайрцаг)-ийг ялгахад
      // хэцүү — шошго нь таамаглалыг арилгана. Идэвхтэйг тод жингээр заана.
      className={cn(
        "relative flex h-12 min-w-11 flex-1 flex-col items-center justify-center gap-1 rounded-full transition-colors",
        active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-5" strokeWidth={active ? 2.3 : 1.8} />
      <span
        className={cn(
          "text-[10px] leading-none",
          active ? "font-semibold" : "font-medium",
        )}
      >
        {label}
      </span>
      {badge > 0 && (
        <span className="bg-foreground text-background absolute top-0 right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-semibold">
          {badge}
        </span>
      )}
    </Link>
  );
}
