"use client";

import * as React from "react";
import { MotionConfig, motion } from "motion/react";
import { Loader2, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { isCrispConfigured } from "@/lib/env";
import { trackChatOpen } from "@/lib/analytics";
import { toast } from "@/lib/toast";
import {
  getUnread,
  isChatOpen,
  openAdminChat,
  subscribeChat,
} from "@/features/chat/crisp";

const spring = { type: "spring", stiffness: 420, damping: 30 } as const;

/**
 * Баруун доод булангийн чатын товч — дарахад Crisp-г тэр мөчид ачаалж
 * шууд яриа руу оруулна (`openAdminChat`). Crisp тохируулаагүй эсвэл
 * adblocker хаасан бол Messenger.
 *
 * Crisp нээлттэй үед өөрийн ✕ товчийг яг энэ байрлалд гаргадаг тул энэ
 * товч нуугдана — давхардахгүй.
 *
 * Гар утсанд доод навигац (эсвэл түүнийг орлосон «Захиалах» зурвас)-ын дээр
 * суух тул тэдгээрийн өндрөөр дээш өргөгдөнө.
 */
export function ChatWidget({ messengerHref }: { messengerHref?: string }) {
  const [connecting, setConnecting] = React.useState(false);
  const unread = React.useSyncExternalStore(subscribeChat, getUnread, () => 0);
  const adminOpen = React.useSyncExternalStore(
    subscribeChat,
    isChatOpen,
    () => false,
  );

  if (adminOpen) return null;

  async function open() {
    if (connecting) return;
    trackChatOpen();
    if (isCrispConfigured) {
      setConnecting(true);
      const ok = await openAdminChat();
      setConnecting(false);
      if (ok) return;
    }
    if (messengerHref) {
      window.open(messengerHref, "_blank", "noopener,noreferrer");
      return;
    }
    toast.error(
      "Чат түр ачаалагдсангүй. «Холбоо барих» хуудаснаас утас, имэйлээр холбогдоорой.",
      "Холбогдож чадсангүй",
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <motion.button
        type="button"
        onClick={open}
        aria-busy={connecting}
        aria-label={
          unread > 0 ? `Админаас ${unread} шинэ мессеж` : "Бидэнтэй чатлах"
        }
        initial={{ opacity: 0, scale: 0.6, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ ...spring, delay: 0.8 }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        className={cn(
          "bg-primary text-primary-foreground group fixed right-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 flex h-12 items-center rounded-full shadow-xl md:right-6 md:bottom-6 md:h-14",
          "focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        )}
      >
        {/* Hover-т «Асуух зүйл байна уу?» гэсэн шошго зүүн тийш гулсаж нээгдэнэ. */}
        <span className="hidden grid-cols-[0fr] transition-[grid-template-columns] duration-300 ease-out group-hover:grid-cols-[1fr] group-focus-visible:grid-cols-[1fr] md:grid">
          <span className="overflow-hidden">
            <span className="block pl-5 text-sm font-medium whitespace-nowrap">
              Асуух зүйл байна уу?
            </span>
          </span>
        </span>
        <span className="flex size-12 items-center justify-center md:size-14">
          {connecting ? (
            <Loader2 className="size-5 animate-spin md:size-6" />
          ) : (
            <MessageCircle className="size-5 md:size-6" />
          )}
        </span>
        {unread > 0 && (
          <span
            aria-hidden
            className="bg-destructive text-destructive-foreground absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </motion.button>
    </MotionConfig>
  );
}
