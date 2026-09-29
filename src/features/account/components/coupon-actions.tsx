"use client";

import * as React from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { shareText } from "./coupons";

async function copy(code: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(code);
    return true;
  } catch {
    // Clipboard blocked — the code is on screen and selectable.
    return false;
  }
}

/** Copies the code, with a moment of «Хуулсан» so the tap is acknowledged. */
export function CopyCodeButton({
  code,
  size = "sm",
}: {
  code: string;
  size?: "sm" | "default";
}) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      size={size}
      aria-label={`${code} кодыг хуулах`}
      onClick={async () => {
        if (!(await copy(code))) return;
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      {copied ? "Хуулсан" : "Хуулах"}
    </Button>
  );
}

/**
 * Hands the code to a friend (0104: a personal coupon may be shared).
 *
 * The native share sheet where there is one — on a phone that is Messenger,
 * Viber, SMS in one tap. Elsewhere it copies the message instead. A share the
 * customer dismisses is not an error and gets no fallback: they changed their
 * mind, and a surprise "copied" toast would be noise.
 */
export function ShareCodeButton({
  code,
  label,
  size = "sm",
}: {
  code: string;
  /** What the coupon is worth, e.g. «10%». */
  label: string;
  size?: "sm" | "default";
}) {
  async function onShare() {
    const text = shareText(label, code);
    const url = `${window.location.origin}/checkout`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Vonscent купон", text, url });
        return;
      } catch (e) {
        if ((e as DOMException)?.name === "AbortError") return;
      }
    }
    if (await copy(`${text}\n${url}`)) {
      toast.success("Найздаа илгээхэд бэлэн боллоо.", "Хуулсан");
    }
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size={size}
      aria-label={`${code} кодыг хуваалцах`}
      onClick={onShare}
    >
      <Share2 className="size-4" />
      Хуваалцах
    </Button>
  );
}
