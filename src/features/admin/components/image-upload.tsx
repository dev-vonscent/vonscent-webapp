"use client";

import * as React from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { IMAGE_ACCEPT } from "@/lib/storage/limits";
import { prepareUpload } from "@/lib/storage/prepare-upload";
import { adminFetch } from "@/features/admin/lib/mutate";

/**
 * Wide-format single-image picker for marketing imagery (hero banners, promo
 * popup slides). The landscape counterpart of `icon-upload.tsx`: a
 * click-to-replace tile that uploads to Supabase Storage and reports the
 * public URL — replacing the free-text URL fields where admins pasted Google
 * Drive links that next/image can't render.
 */
export function ImageUpload({
  value,
  onChange,
  folder = "marketing",
  label = "Зураг",
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  folder?: string;
  label?: string;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [warning, setWarning] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setError(null);
    setWarning(null);
    const prepared = await prepareUpload(file);
    if (!prepared.ok) {
      setError(prepared.message);
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", prepared.file);
      fd.append("folder", folder);
      const res = await adminFetch<{ url?: string; width?: number }>(
        "/api/upload",
        { method: "POST", body: fd },
      );
      const data = res.ok ? res.data : null;
      if (!res.ok) {
        setError(res.demo ? "Demo горим: зураг хадгалагдсангүй." : res.error);
      } else if (!data?.url) {
        setError("Оруулахад алдаа гарлаа.");
      } else {
        // The hero renders the banner up to 560px wide (×2 for retina) — a
        // narrower source will look soft there.
        if (typeof data.width === "number" && data.width < 1120) {
          setWarning(
            `Зургийн өргөн ${data.width}px байна — 1120px-ээс өргөн зураг оруулбал илүү тод харагдана.`,
          );
        }
        onChange(data.url);
      }
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="relative w-full max-w-60">
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          aria-label={value ? `${label} солих` : `${label} оруулах`}
          className="border-muted-foreground/40 bg-secondary text-muted-foreground hover:border-muted-foreground/70 hover:bg-accent relative flex aspect-16/10 w-full items-center justify-center overflow-hidden rounded-md border border-dashed transition-colors disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="size-5 animate-spin" />
          ) : value ? (
            // Plain <img>: previously-saved values can point at hosts outside
            // next.config's allowlist (pasted Google Drive links), and
            // next/image would throw on those instead of rendering a preview.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt=""
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <span className="flex flex-col items-center gap-1 text-xs">
              <ImagePlus className="size-5" />
              Зураг оруулах
            </span>
          )}
        </button>
        {value && !busy && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="bg-background/80 text-muted-foreground hover:text-destructive absolute top-1.5 right-1.5 rounded-md p-1"
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
      {warning && <p className="text-muted-foreground text-xs">⚠ {warning}</p>}
    </div>
  );
}
