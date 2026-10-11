"use client";

import * as React from "react";
import { isCrispConfigured } from "@/lib/env";
import { trackChatOpen } from "@/lib/analytics";
import { toast } from "@/lib/toast";
import {
  getUnread,
  isChatOpen,
  openAdminChat,
  subscribeChat,
} from "@/features/chat/crisp";

/**
 * Чат нээх нэг логик — desktop-ийн дугуй цэс ба утасны толгойн товч
 * хоёулаа ашиглана. Crisp ачаалагдахгүй бол (adblocker) `fallbackHref`
 * (Messenger), тэр ч байхгүй бол контакт хуудас руу заана.
 */
export function useChatLauncher(fallbackHref?: string) {
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
      setConnecting(true);
      const ok = await openAdminChat();
      setConnecting(false);
      if (ok) return true;
    }
    if (fallbackHref) {
      window.open(fallbackHref, "_blank", "noopener,noreferrer");
      return false;
    }
    toast.error(
      "Чат түр ачаалагдсангүй. «Холбоо барих» хуудаснаас утас, имэйлээр холбогдоорой.",
      "Холбогдож чадсангүй",
    );
    return false;
  }

  return { connecting, unread, chatOpen, launch };
}
