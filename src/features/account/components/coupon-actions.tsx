"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

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
