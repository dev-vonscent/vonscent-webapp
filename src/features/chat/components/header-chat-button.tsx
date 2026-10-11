"use client";

import { Loader2, MessageCircleMore } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useChatLauncher } from "@/features/chat/use-chat-launcher";

/**
 * Утасны толгойн чатын товч — зөвхөн төлбөрийн хуудсанд, доод цэс (түүний
 * хажуугийн чатын товч) «Төлөх» зурвасаар нуугдах үед.
 */
export function HeaderChatButton({
  variant = "ghost",
  className,
}: {
  variant?: ButtonProps["variant"];
  className?: string;
}) {
  const { connecting, unread, launch } = useChatLauncher();
  return (
    <Button
      variant={variant}
      size="icon"
      onClick={() => void launch()}
      data-chat-entry
      aria-busy={connecting}
      aria-label={
        unread > 0 ? `Админаас ${unread} шинэ мессеж` : "Бидэнтэй чатлах"
      }
      className={cn("relative", className)}
    >
      {connecting ? (
        <Loader2 className="size-5 animate-spin" />
      ) : (
        <MessageCircleMore className="size-5" />
      )}
      {unread > 0 && (
        <span
          aria-hidden
          className="bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums"
        >
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Button>
  );
}
