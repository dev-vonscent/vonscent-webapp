"use client";

import * as React from "react";
import { isCrispConfigured } from "@/lib/env";
import { trackChatOpen } from "@/lib/analytics";
import { toast, type ToastAction } from "@/lib/toast";
import {
  getUnread,
  isChatOpen,
  openAdminChat,
  preloadChat,
  subscribeChat,
} from "@/features/chat/crisp";

export interface ContactLink {
  href: string;
  label: string;
  icon: "messenger" | "instagram" | "phone";
}

/**
 * Crisp ачаалагдахгүй үеийн гарцууд. Сувгууд серверээс (`ContactFab`)
 * ирдэг тул тэр нь энд бүртгэнэ — утасны толгойн товч ч ижил гарцтай.
 */
let fallbackLinks: ContactLink[] = [];
export function setChatFallbackLinks(links: ContactLink[]) {
  fallbackLinks = links;
}

/** Toast-ын тайлбарт: «Messenger эсвэл утсаар …» — байгаа гарцаараа. */
const CHANNEL_WORD: Record<string, string> = {
  Messenger: "Messenger-ээр",
  Залгах: "утсаар",
};

function fallbackActions(): ToastAction[] {
  const actions: ToastAction[] = [];
  const messenger = fallbackLinks.find((l) => l.icon === "messenger");
  const phone = fallbackLinks.find((l) => l.icon === "phone");
  if (messenger)
    actions.push({
      label: "Messenger",
      onClick: () =>
        window.open(messenger.href, "_blank", "noopener,noreferrer"),
    });
  if (phone)
    actions.push({
      label: "Залгах",
      onClick: () => window.location.assign(phone.href),
    });
  return actions;
}

/**
 * Чат нээх нэг логик — desktop-ийн дугуй цэс ба утасны толгойн товч
 * хоёулаа ашиглана.
 *
 * Товч руу чиглэх мөчид (`intentProps`) Crisp урьдчилан ачаалагдаж эхэлнэ.
 * Crisp ачаалагдахгүй бол (adblocker, сүлжээ) Messenger-ийг автоматаар
 * нээхгүй: хүлээлтийн дараа хэрэглэгчийн даралт хүчингүй болсон тул
 * `window.open`-ийг popup blocker чимээгүй хаадаг. Оронд нь toast-ын
 * товчоор — шинэ даралт — сонгуулна.
 */
export function useChatLauncher() {
  const [connecting, setConnecting] = React.useState(false);
  const unread = React.useSyncExternalStore(subscribeChat, getUnread, () => 0);
  const chatOpen = React.useSyncExternalStore(
    subscribeChat,
    isChatOpen,
    () => false,
  );

  async function launch(): Promise<boolean> {
    if (connecting) return false;
    trackChatOpen();
    if (isCrispConfigured) {
      // Хүлээх хооронд зөвхөн товчны spinner — toast нь «ачаалж байна» гээд
      // дараа нь алдаа гэж хоёр удаа анхаарал сарниулдаг байв.
      setConnecting(true);
      const ok = await openAdminChat();
      setConnecting(false);
      if (ok) return true;
    }
    const actions = fallbackActions();
    if (actions.length > 0) {
      toast.errorWithActions(
        `${actions.map((a) => CHANNEL_WORD[a.label]).join(" эсвэл ")} бидэнтэй шууд холбогдоорой.`,
        "Чат нээгдсэнгүй",
        actions,
      );
    } else {
      toast.error(
        "«Холбоо барих» хуудаснаас утас, имэйлээр холбогдоорой.",
        "Чат нээгдсэнгүй",
      );
    }
    return false;
  }

  /** Чатын товч дээр `onPointerEnter` / `onFocus` / `onPointerDown`-д. */
  const preload = isCrispConfigured ? preloadChat : undefined;
  const intentProps = {
    onPointerEnter: preload,
    onFocus: preload,
    onPointerDown: preload,
  };

  return { connecting, unread, chatOpen, launch, intentProps };
}
