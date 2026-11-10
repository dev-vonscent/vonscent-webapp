"use client";

import * as React from "react";
import { Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";

async function copy(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(done);
  } catch {
    toast.error("Хуулж чадсангүй. Гараар сонгож хуулна уу.");
  }
}

/**
 * Худалдан авагчийн хуваалцах үйлдлүүд (gift-cards-plan §2.2, §10):
 * Messenger г.м.-ээр холбоос (OG зурагтай), эсвэл кодыг гараар.
 */
export function GiftCardShare({
  url,
  code,
  recipientName,
}: {
  url: string;
  code: string;
  recipientName: string;
}) {
  const [canShare, setCanShare] = React.useState(false);
  React.useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && "share" in navigator);
  }, []);

  async function share() {
    try {
      await navigator.share({
        title: "Vonscent бэлгийн карт",
        text: `${recipientName}, танд Vonscent-ийн бэлгийн карт илгээлээ.`,
        url,
      });
    } catch {
      // Хэрэглэгч цуцалсан — юу ч хийхгүй.
    }
  }

  return (
    <div className="space-y-3">
      <div className="bg-background flex items-center justify-between gap-3 rounded-xl px-4 py-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs">Бэлгийн код</p>
          <p className="font-mono text-base font-semibold tracking-wider">
            {code}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Кодыг хуулах"
          onClick={() => copy(code, "Код хуулагдлаа.")}
        >
          <Copy className="size-4" />
        </Button>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        {canShare && (
          <Button
            type="button"
            className="bg-cta text-cta-foreground hover:bg-cta/90 flex-1"
            onClick={share}
          >
            <Share2 className="size-4" aria-hidden="true" />
            Хуваалцах
          </Button>
        )}
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          onClick={() => copy(url, "Холбоос хуулагдлаа — Messenger-ээр илгээж болно.")}
        >
          <Copy className="size-4" aria-hidden="true" />
          Холбоос хуулах
        </Button>
      </div>
    </div>
  );
}
