"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

async function copy(code: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(code);
    return true;
  } catch {
    // Clipboard blocked — the code is on screen and selectable.
    return false;
  }
}

/**
 * Icon-only copy button. The tap is acknowledged by the icon turning into a
 * check for a moment — no label, so nothing shifts in the layout.
 */
export function CopyCodeButton({
  code,
  className,
}: {
  code: string;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  React.useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <span className={cn("relative inline-flex", className)}>
      <button
        type="button"
        aria-label={copied ? "Хуулсан" : `${code} кодыг хуулах`}
        onClick={async () => {
          if (!(await copy(code))) return;
          setCopied(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setCopied(false), 1600);
        }}
        // 36px товч, 44px хүрэх талбар (WCAG 2.5.8).
        className="text-muted-foreground hover:text-foreground hover:bg-accent relative flex size-9 items-center justify-center rounded-full transition-colors before:absolute before:top-1/2 before:left-1/2 before:size-11 before:-translate-1/2 before:content-['']"
      >
        {copied ? (
          <Check className="text-foreground size-4" />
        ) : (
          <Copy className="size-4" />
        )}
      </button>
    </span>
  );
}
