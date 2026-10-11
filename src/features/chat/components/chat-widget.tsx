"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  Facebook,
  Instagram,
  Loader2,
  MessageCircle,
  MessageCircleMore,
  Phone,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isChatReady, setChatTheme } from "@/features/chat/crisp";
import {
  setChatFallbackLinks,
  useChatLauncher,
  type ContactLink,
} from "@/features/chat/use-chat-launcher";

export type { ContactLink };

const CHANNELS: Record<
  ContactLink["icon"],
  { icon: LucideIcon; className: string }
> = {
  messenger: { icon: Facebook, className: "bg-facebook text-white" },
  instagram: { icon: Instagram, className: "bg-instagram text-white" },
  phone: { icon: Phone, className: "bg-phone text-white" },
};

/**
 * Эдгээр хуудсанд цэс нээгдэхгүй, товч шууд чат руу оруулна: төлбөрийн
 * урсгалд сайтаас гадагш хөтлөх нь алдагдалтай (гэхдээ асуудал гарах
 * магадлал хамгийн өндөр газар), контакт хуудас өөрөө бүх сувгийг харуулдаг.
 */
const CHAT_ONLY_ON = ["/checkout", "/pay", "/contact"];

const spring = { type: "spring", stiffness: 420, damping: 30 } as const;

const CHAT_SIZE = 52;
const LINK_SIZE = 44;

/**
 * Товчнуудыг гол товчны эргэн тойронд зүүнээс (180°) дээш (90°) нумаар
 * тараана. Олон болох тусам радиусыг томсгож хоорондоо давхцуулахгүй.
 */
function arc(count: number) {
  const radius = count <= 3 ? 84 : count === 4 ? 100 : 128;
  return Array.from({ length: count }, (_, i) => {
    const deg = count === 1 ? 135 : 180 - (i * 90) / (count - 1);
    const rad = (deg * Math.PI) / 180;
    return { x: Math.cos(rad) * radius, y: -Math.sin(rad) * radius };
  });
}

type Item = { kind: "chat" } | { kind: "link"; link: ContactLink };

/**
 * Баруун доод булангийн «Холбогдох» товч. Дарахад сувгууд нумаар дэлгэгдэнэ;
 * голд нь сайтын чат (Crisp) — сайтаас гадагш гаргадаггүй цорын ганц суваг
 * тул томоор, брэндийн өнгөөр. Crisp нь «Чатлах» дарагдсан мөчид л ачаалагдана.
 *
 * Админ бичсэн (уншаагүй мессеж) үед цэсгүйгээр шууд яриа руу оруулна.
 * Crisp нээлттэй үед өөрийн ✕-ийг яг энэ байрлалд гаргадаг тул бүхэлдээ
 * нуугдана. Crisp ачаалагдахгүй бол (adblocker) toast-оор Messenger / утас.
 *
 * Зөвхөн desktop: утсан дээр хөвөгч товч бараа, сагслах товч, доод
 * навигацыг дардаг тул чат толгой хэсэгт (`HeaderChatButton`), сошиал
 * сувгууд цэс дотор (`MenuSocialLinks`).
 */
export function ChatWidget({ links }: { links: ContactLink[] }) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const menuId = React.useId();
  const { connecting, unread, chatOpen: adminOpen, launch } = useChatLauncher();
  // Утасны толгойн товч ч эдгээр гарцыг ашиглана (энэ компонент утсан дээр
  // CSS-ээр нуугдсан ч mount хэвээр).
  React.useEffect(() => setChatFallbackLinks(links), [links]);
  // Crisp-ийн өнгө сайтын theme-ийг дагана (утсан дээр ч — энэ компонент
  // CSS-ээр нуугдсан ч mount хэвээр).
  const { resolvedTheme } = useTheme();
  React.useEffect(() => setChatTheme(resolvedTheme), [resolvedTheme]);

  const chatOnly =
    links.length === 0 || CHAT_ONLY_ON.some((p) => pathname.startsWith(p));

  // Хуудас солигдоход цэс нээлттэй үлдэхгүй.
  React.useEffect(() => setOpen(false), [pathname]);

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Crisp хаагдах мөчид хулгана яг энэ товч дээр байдаг (Crisp-ийн ✕ ижил
  // байрлалд). Тэр үед hover шошго дэлгэгдэж анивчихгүйн тулд хулгана
  // товчноос гартал hover-ийг унтраана.
  const [prevAdminOpen, setPrevAdminOpen] = React.useState(adminOpen);
  const [hoverMuted, setHoverMuted] = React.useState(false);
  if (prevAdminOpen !== adminOpen) {
    setPrevAdminOpen(adminOpen);
    if (adminOpen) setOpen(false);
    else setHoverMuted(true);
  }

  async function openChat() {
    if (await launch()) setOpen(false);
  }

  function toggle() {
    if (chatOnly || (unread > 0 && isChatReady())) {
      void openChat();
      return;
    }
    setOpen((v) => !v);
  }

  // Чат нумын голд.
  const items: Item[] = links.map((link) => ({ kind: "link", link }));
  items.splice(Math.ceil(items.length / 2), 0, { kind: "chat" });
  const positions = arc(items.length);

  return (
    <MotionConfig reducedMotion="user">
      <div
        ref={rootRef}
        data-chat-entry
        // Crisp нээлттэй үед unmount биш нууна — дахин mount болбол орж ирэх
        // анимейшн дахин тоглож анивчина.
        hidden={adminOpen}
        className="fixed right-6 bottom-6 z-40 hidden md:block"
      >
        <AnimatePresence>
          {open && (
            <motion.ul
              id={menuId}
              aria-label="Холбогдох суваг"
              className="absolute inset-0"
              initial="closed"
              animate="open"
              exit="closed"
              variants={{
                open: { transition: { staggerChildren: 0.04 } },
                closed: {
                  transition: { staggerChildren: 0.03, staggerDirection: -1 },
                },
              }}
            >
              {items.map((item, i) => {
                const size = item.kind === "chat" ? CHAT_SIZE : LINK_SIZE;
                const { x, y } = positions[i];
                return (
                  <motion.li
                    key={item.kind === "chat" ? "chat" : item.link.label}
                    className="absolute top-1/2 left-1/2"
                    style={{
                      width: size,
                      height: size,
                      marginLeft: -size / 2,
                      marginTop: -size / 2,
                    }}
                    variants={{
                      open: { opacity: 1, x, y, scale: 1 },
                      closed: { opacity: 0, x: 0, y: 0, scale: 0.4 },
                    }}
                    transition={spring}
                  >
                    {item.kind === "chat" ? (
                      <button
                        type="button"
                        onClick={openChat}
                        aria-busy={connecting}
                        aria-label="Сайтаар чатлах"
                        className="bg-primary text-primary-foreground ring-background group relative flex size-full items-center justify-center rounded-full shadow-lg ring-2 transition-transform hover:scale-105"
                      >
                        {connecting ? (
                          <Loader2 className="size-5 animate-spin" />
                        ) : (
                          <MessageCircleMore className="size-5" />
                        )}
                        <Tip>Чатлах</Tip>
                      </button>
                    ) : (
                      <ChannelLink
                        link={item.link}
                        onSelect={() => setOpen(false)}
                      />
                    )}
                  </motion.li>
                );
              })}
            </motion.ul>
          )}
        </AnimatePresence>

        <motion.button
          ref={buttonRef}
          type="button"
          onClick={toggle}
          onPointerLeave={() => setHoverMuted(false)}
          aria-busy={connecting}
          {...(!chatOnly && {
            "aria-expanded": open,
            "aria-controls": menuId,
          })}
          aria-label={
            open
              ? "Хаах"
              : unread > 0
                ? `Админаас ${unread} шинэ мессеж`
                : "Бидэнтэй холбогдох"
          }
          initial={{ opacity: 0, scale: 0.6, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ ...spring, delay: 0.8 }}
          whileHover={hoverMuted ? undefined : { scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          className={cn(
            "group relative flex h-14 items-center rounded-full shadow-xl transition-colors",
            open
              ? "bg-background text-foreground border-border border"
              : "bg-primary text-primary-foreground",
            "focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          )}
        >
          {/* Hover-т «Асуух зүйл байна уу?» гэсэн шошго зүүн тийш гулсаж нээгдэнэ. */}
          <span
            className={cn(
              "grid transition-[grid-template-columns] duration-300 ease-out",
              open || hoverMuted
                ? "grid-cols-[0fr]"
                : "grid-cols-[0fr] group-hover:grid-cols-[1fr] group-focus-visible:grid-cols-[1fr]",
            )}
          >
            <span className="overflow-hidden">
              <span className="block pl-5 text-sm font-medium whitespace-nowrap">
                Асуух зүйл байна уу?
              </span>
            </span>
          </span>
          <span className="relative flex size-14 items-center justify-center">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={open ? "close" : connecting ? "loading" : "chat"}
                initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.2 }}
                className="flex"
              >
                {open ? (
                  <X className="size-6" />
                ) : connecting ? (
                  <Loader2 className="size-6 animate-spin" />
                ) : (
                  <MessageCircle className="size-6" />
                )}
              </motion.span>
            </AnimatePresence>
          </span>
          {unread > 0 && !open && (
            <span
              aria-hidden
              className="bg-destructive text-destructive-foreground absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums"
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </motion.button>
      </div>
    </MotionConfig>
  );
}

function ChannelLink({
  link: { href, label, icon },
  onSelect,
}: {
  link: ContactLink;
  onSelect: () => void;
}) {
  const { icon: Icon, className } = CHANNELS[icon];
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      aria-label={label}
      {...(external && { target: "_blank", rel: "noopener noreferrer" })}
      onClick={onSelect}
      className={cn(
        "group relative flex size-full items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105",
        className,
      )}
    >
      <Icon className="size-4.5" />
      <Tip>{label}</Tip>
    </a>
  );
}

/** Hover/focus-д товчны зүүн талд гарах шошго. */
function Tip({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden
      className="bg-popover text-popover-foreground pointer-events-none absolute top-1/2 right-full mr-2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
    >
      {children}
    </span>
  );
}
