"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  Facebook,
  Instagram,
  Mail,
  MessageCircle,
  Phone,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

/** Төлбөрийн урсгалд анхаарал сарниулахгүйн тулд эдгээр хуудсанд нуугдана. */
const HIDDEN_ON = ["/checkout", "/pay", "/contact"];

const spring = { type: "spring", stiffness: 420, damping: 30 } as const;

/**
 * Desktop-ийн баруун доод булангийн «Холбогдох» товч. Дарахад сувгууд доороос
 * дээш дараалан (stagger) гарч ирнэ. Гар утсанд доод навигац ба үйлдлийн
 * зурвас тэр зайг эзэлдэг тул `md`-ээс доош харагдахгүй — тэнд цэсний сошиал
 * холбоос үүргийг нь гүйцэтгэнэ.
 */
export function ContactFabMenu({ links }: { links: ContactLink[] }) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const menuId = React.useId();

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

  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  return (
    <MotionConfig reducedMotion="user">
      <div
        ref={rootRef}
        className="fixed right-6 bottom-6 z-40 hidden flex-col items-end gap-3 md:flex"
      >
        <AnimatePresence>
          {open && (
            <motion.ul
              id={menuId}
              className="flex flex-col items-end gap-2"
              initial="closed"
              animate="open"
              exit="closed"
              variants={{
                open: {
                  transition: { staggerChildren: 0.05, staggerDirection: -1 },
                },
                closed: {
                  transition: { staggerChildren: 0.03 },
                },
              }}
            >
              {links.map(({ href, label, icon }) => {
                const Icon = ICONS[icon];
                const external = href.startsWith("http");
                return (
                  <motion.li
                    key={label}
                    variants={{
                      open: { opacity: 1, y: 0, scale: 1 },
                      closed: { opacity: 0, y: 12, scale: 0.9 },
                    }}
                    transition={spring}
                    style={{ transformOrigin: "bottom right" }}
                  >
                    <a
                      href={href}
                      {...(external && {
                        target: "_blank",
                        rel: "noopener noreferrer",
                      })}
                      onClick={() => setOpen(false)}
                      className="bg-background text-foreground border-border hover:bg-secondary group flex h-11 items-center gap-3 rounded-full border py-2 pr-2 pl-4 text-sm font-medium shadow-lg transition-colors"
                    >
                      {label}
                      <span className="bg-secondary group-hover:bg-background flex size-8 items-center justify-center rounded-full transition-colors">
                        <Icon className="size-4" />
                      </span>
                    </a>
                  </motion.li>
                );
              })}
            </motion.ul>
          )}
        </AnimatePresence>

        <motion.button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={open ? "Хаах" : "Бидэнтэй холбогдох"}
          initial={{ opacity: 0, scale: 0.6, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ ...spring, delay: 0.8 }}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          className={cn(
            "bg-primary text-primary-foreground group flex h-14 items-center rounded-full shadow-xl",
            "focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          )}
        >
          {/* Hover-т «Асуух зүйл байна уу?» гэсэн шошго зүүн тийш гулсаж нээгдэнэ. */}
          <span
            className={cn(
              "grid transition-[grid-template-columns] duration-300 ease-out",
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
          <span className="relative flex size-14 items-center justify-center">
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
                  <X className="size-6" />
                ) : (
                  <MessageCircle className="size-6" />
                )}
              </motion.span>
            </AnimatePresence>
          </span>
        </motion.button>
      </div>
    </MotionConfig>
  );
}
