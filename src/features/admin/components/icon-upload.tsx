"use client";

import * as React from "react";
import Image from "next/image";
import { ImagePlus, Loader2, X } from "lucide-react";
import { IMAGE_ACCEPT } from "@/lib/storage/limits";
import { prepareUpload } from "@/lib/storage/prepare-upload";

/**
 * Single-image picker for the small square icons the admin manages (todo.md
 * B3b: scent family icons). The gallery editor in `product-images.tsx` is the
 * multi-image, reorderable counterpart; an icon needs neither, so this is a
 * click-to-replace tile that reports the uploaded URL and lets the caller
 * decide when to persist it.
 */
export function IconUpload({
  value,
  onChange,
  label = "Дүрс",
  size = 48,
  allowClear = true,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  size?: number;
  /** Hide the clear (X) button — click-to-replace stays available. */
  allowClear?: boolean;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setError(null);
    // Icons render at 48px, so they need far less than the default bound.
    const prepared = await prepareUpload(file, 512);
    if (!prepared.ok) {
      setError(prepared.message);
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", prepared.file);
      fd.append("folder", "families");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => null);
      if (data?.demo) {
        setError("Demo горим: зураг хадгалагдсангүй.");
      } else if (!res.ok || !data?.url) {
        setError("Оруулахад алдаа гарлаа.");
      } else {
        onChange(data.url as string);
      }
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          aria-label={value ? `${label} солих` : `${label} оруулах`}
          className="border-muted-foreground/40 bg-secondary text-muted-foreground hover:border-muted-foreground/70 hover:bg-accent flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-dashed transition-colors disabled:opacity-60"
          style={{ width: size, height: size }}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : value ? (
            <Image
              src={value}
              alt=""
              width={size}
              height={size}
              className="size-full object-contain"
            />
          ) : (
            <ImagePlus className="size-4" />
          )}
        </button>
        {allowClear && value && !busy && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-muted-foreground hover:text-destructive"
            aria-label={`${label} хасах`}
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
        }}
      />
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
