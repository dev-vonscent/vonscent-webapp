"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";

/** Label/value row with an optional copy button — bank details, invoice ids. */
export function CopyRow({
  label,
  value,
  copy,
  mono,
}: {
  label: string;
  value: string;
  copy?: boolean;
  mono?: boolean;
}) {
  const [copied, setCopied] = React.useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      // Confirming the copy matters more here than anywhere else in the app:
      // a mistyped transfer reference is an order nobody can match up.
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked (insecure context, permissions) — the value is
      // on screen and selectable, so there is nothing to recover from.
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="flex min-w-0 items-center gap-2">
        <span
          className={
            mono
              ? "truncate font-mono text-sm font-medium"
              : "truncate text-sm font-medium"
          }
        >
          {value}
        </span>
        {/* Хүрэх талбарыг `before`-оор тэлнэ — дүрс нь 14px хэвээр, дарагдах
            талбар нь 44px. Энэ бол дансны дугаар, гүйлгээний утгыг хуулдаг
            товч: буруу хуулагдсан утга нь хэн ч тааруулж чадахгүй захиалга
            болдог тул системд хамгийн жижиг байх ёсгүй (WCAG 2.5.8).
            `checkbox` / `radio-group` дээр хэрэглэсэн ижил арга. */}
        {copy && (
          <button
            type="button"
            onClick={onCopy}
            className="text-muted-foreground hover:text-foreground relative shrink-0 transition-colors before:absolute before:top-1/2 before:left-1/2 before:size-11 before:-translate-1/2 before:content-['']"
            aria-label={`${label} хуулах`}
          >
            {copied ? (
              <Check className="text-success size-3.5" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </button>
        )}
      </span>
    </div>
  );
}
