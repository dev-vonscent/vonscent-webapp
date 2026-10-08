"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  ArrowLeft,
  ChevronRight,
  Facebook,
  Instagram,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isTawkConfigured } from "@/lib/env";
import { trackChat } from "@/lib/analytics";
import { toast } from "@/lib/toast";
import { FaqAnswer } from "@/features/faq/components/faq-search";
import type { FaqItem } from "@/features/faq/seed";
import {
  getUnread,
  isTawkReady,
  openAdminChat,
  subscribeUnread,
} from "@/features/chat/tawk";

export interface ContactLink {
  href: string;
  label: string;
  icon: "messenger" | "instagram" | "phone" | "email";
}

const ICONS: Record<ContactLink["icon"], LucideIcon> = {
  messenger: Facebook,
  instagram: Instagram,
  phone: Phone,
  email: Mail,
};

/** Холбоо барих хуудас өөрөө бүх сувгийг харуулдаг тул давхардуулахгүй. */
const HIDDEN_ON = ["/contact"];

/**
 * Төлбөрийн урсгалд бэлэн асуултын жагсаалт анхаарал сарниулна, гэхдээ
 * асуудал гарах магадлал хамгийн өндөр газар — тиймээс зөвхөн «Админтай
 * чатлах» үлдэнэ.
 */
const CONTACT_ONLY_ON = ["/checkout", "/pay"];

const spring = { type: "spring", stiffness: 420, damping: 30 } as const;

/**
 * Баруун доод булангийн чатын товч ба цонх.
 *
 * Эхний шат нь манай цонх: админы сонгосон бэлэн асуултууд (`getChatFaqs`),
 * дарахад хариулт нь цонхондоо гарна — tawk.to огт ачаалагдахгүй. Хариулт
 * олдохгүй бол «Админтай чатлах» нь tawk.to-г тэр мөчид ачаалж нээнэ
 * (`openAdminChat`). tawk тохируулаагүй эсвэл adblocker хаасан бол Messenger.
 *
 * Гар утсанд доод навигац (эсвэл түүнийг орлосон «Захиалах» зурвас)-ын дээр
 * суух тул тэдгээрийн өндрөөр дээш өргөгдөнө.
 */
export function ChatWidget({
  faqs,
  links,
}: {
  faqs: FaqItem[];
  links: ContactLink[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<FaqItem | null>(null);
  const [connecting, setConnecting] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const panelId = React.useId();
  const titleId = React.useId();
  const unread = React.useSyncExternalStore(
    subscribeUnread,
    getUnread,
    () => 0,
  );

  const contactOnly = CONTACT_ONLY_ON.some((p) => pathname.startsWith(p));
  const questions = contactOnly ? [] : faqs;
  const messenger = links.find((l) => l.icon === "messenger");

  // Хуудас солигдоход цонх нээлттэй үлдэхгүй.
  React.useEffect(() => {
    setOpen(false);
    setSelected(null);
  }, [pathname]);

  React.useEffect(() => {
    if (!open) return;
    titleRef.current?.focus();
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

  // Асуулт ↔ жагсаалт солигдоход дэлгэц уншигч шинэ агуулгын эхнээс уншина.
  React.useEffect(() => {
    if (open) titleRef.current?.focus();
  }, [selected, open]);

  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  function toggle() {
    // Админ бичсэн бол цонхоор дамжуулахгүй шууд яриа руу нь оруулна.
    if (!open && unread > 0 && isTawkReady()) {
      void openAdminChat();
      return;
    }
    setOpen((v) => {
      if (!v) trackChat("open");
      return !v;
    });
    setSelected(null);
  }

  function pick(item: FaqItem) {
    trackChat("faq", item.question);
    setSelected(item);
  }

  async function contactAdmin() {
    trackChat("handoff", selected?.question);
    if (isTawkConfigured) {
      setConnecting(true);
      const ok = await openAdminChat();
      setConnecting(false);
      if (ok) {
        setOpen(false);
        return;
      }
    }
    if (messenger) {
      window.open(messenger.href, "_blank", "noopener,noreferrer");
      return;
    }
    toast.error(
      "Чат түр ачаалагдсангүй. Доорх утас, имэйлээр холбогдоорой.",
      "Холбогдож чадсангүй",
    );
  }

  const adminLabel = isTawkReady() ? "Яриагаа үргэлжлүүлэх" : "Админтай чатлах";

  return (
    <MotionConfig reducedMotion="user">
      <div
        ref={rootRef}
        className="fixed right-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 flex flex-col items-end gap-3 md:right-6 md:bottom-6"
      >
        <AnimatePresence>
          {open && (
            <motion.section
              id={panelId}
              role="dialog"
              aria-labelledby={titleId}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={spring}
              style={{ transformOrigin: "bottom right" }}
              className="bg-popover text-popover-foreground flex max-h-[min(30rem,calc(100svh-9rem))] w-[min(20rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl shadow-xl"
            >
              <header className="flex items-start justify-between gap-3 px-4 pt-4 pb-2.5">
                <div className="min-w-0">
                  <h2
                    ref={titleRef}
                    id={titleId}
                    tabIndex={-1}
                    className="font-serif text-base font-semibold outline-none"
                  >
                    {selected ? selected.question : "Асуух зүйл байна уу?"}
                  </h2>
                  {!selected && (
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {questions.length > 0
                        ? "Ихэнх асуултын хариулт энд бэлэн байна. Олдохгүй бол бидэнд шууд бичээрэй."
                        : "Захиалга, төлбөртэй холбоотой асуудал гарвал бидэнд шууд бичээрэй — даруй тусална."}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Хаах"
                  className="text-muted-foreground hover:text-foreground -mt-0.5 -mr-1 rounded-full p-1"
                >
                  <X className="size-4" />
                </button>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">
                {selected ? (
                  <div className="space-y-3 pb-2">
                    <div className="bg-secondary rounded-lg px-3 py-2.5 text-sm/relaxed">
                      <FaqAnswer answer={selected.answer} />
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelected(null)}
                      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
                    >
                      <ArrowLeft className="size-4" />
                      Бусад асуулт
                    </button>
                  </div>
                ) : (
                  questions.length > 0 && (
                    <ul className="space-y-1.5 pb-2">
                      {questions.map((item) => (
                        <li key={item.question}>
                          <button
                            type="button"
                            onClick={() => pick(item)}
                            className="bg-secondary/60 hover:bg-secondary flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm/snug transition-colors"
                          >
                            <span className="flex-1">{item.question}</span>
                            <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )
                )}
              </div>

              <footer className="space-y-2.5 px-4 pt-2.5 pb-4">
                {selected && (
                  <p className="text-muted-foreground text-xs">
                    Хариултаа олсонгүй юу? Бидэнд шууд бичээрэй.
                  </p>
                )}
                <button
                  type="button"
                  onClick={contactAdmin}
                  disabled={connecting}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-70"
                >
                  {connecting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <MessageCircle className="size-4" />
                  )}
                  {connecting ? "Холбогдож байна…" : adminLabel}
                </button>
                {links.length > 0 && (
                  <ul
                    aria-label="Бусад суваг"
                    className="flex items-center justify-center gap-2"
                  >
                    {links.map(({ href, label, icon }) => {
                      const Icon = ICONS[icon];
                      const external = href.startsWith("http");
                      return (
                        <li key={label}>
                          <a
                            href={href}
                            aria-label={label}
                            title={label}
                            {...(external && {
                              target: "_blank",
                              rel: "noopener noreferrer",
                            })}
                            className="bg-secondary hover:bg-secondary/70 text-muted-foreground hover:text-foreground flex size-8 items-center justify-center rounded-full transition-colors"
                          >
                            <Icon className="size-3.5" />
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </footer>
            </motion.section>
          )}
        </AnimatePresence>

        <motion.button
          ref={buttonRef}
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={panelId}
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
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          className={cn(
            "bg-primary text-primary-foreground group relative flex h-12 items-center rounded-full shadow-xl md:h-14",
            "focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          )}
        >
          {/* Hover-т «Асуух зүйл байна уу?» гэсэн шошго зүүн тийш гулсаж нээгдэнэ. */}
          <span
            className={cn(
              "hidden transition-[grid-template-columns] duration-300 ease-out md:grid",
              open
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
          <span className="relative flex size-12 items-center justify-center md:size-14">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={open ? "close" : "chat"}
                initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.2 }}
                className="flex"
              >
                {open ? (
                  <X className="size-5 md:size-6" />
                ) : (
                  <MessageCircle className="size-5 md:size-6" />
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
