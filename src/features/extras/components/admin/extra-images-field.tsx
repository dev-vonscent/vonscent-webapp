"use client";

import * as React from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight, ImagePlus, X } from "lucide-react";
import { IMAGE_ACCEPT } from "@/lib/storage/limits";
import { prepareUpload } from "@/lib/storage/prepare-upload";
import { uploadErrorMessage, xhrUpload } from "@/lib/storage/upload-progress";
import { UploadProgress } from "@/features/admin/components/upload-progress";
import { EXTRA_IMAGES_MAX } from "@/lib/validators/extras";
import { cn } from "@/lib/utils";

/**
 * Нэмэлт барааны зургууд (4:5 — дэлгүүрийн карттай ижил харьцаа).
 * Эхний зураг нь картын зураг; сумаар дараалал солино. Хоосон байж болно
 * (үлдэгдэлтэй шил эх үнэртнийхээ зургийг авна).
 */
export function ExtraImagesField({
  value,
  onChange,
  max = EXTRA_IMAGES_MAX,
  gridClassName,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  /** Хувилбарын ганц зураг г.м. */
  max?: number;
  /** Баганын тоо — байрлах газрын өргөнд тааруулна. */
  gridClassName?: string;
}) {
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const full = value.length >= max;

  async function upload(file: File) {
    setError(null);
    const prepared = await prepareUpload(file);
    if (!prepared.ok) {
      setError(prepared.message);
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      const fd = new FormData();
      fd.append("file", prepared.file);
      fd.append("folder", "extras");
      const res = await xhrUpload<{ url?: string; demo?: boolean }>({
        url: "/api/upload",
        body: fd,
        onProgress: (pct) => setProgress(pct < 100 ? pct : null),
      });
      if (res.status < 200 || res.status >= 300 || res.json?.demo) {
        setError(uploadErrorMessage(res, "Зураг байршуулж чадсангүй"));
      } else if (!res.json?.url) {
        setError("Оруулахад алдаа гарлаа.");
      } else {
        onChange([...value, res.json.url]);
      }
    } catch {
      setError("Сүлжээний алдаа — дахин оролдоно уу.");
    } finally {
      setBusy(false);
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  return (
    <div className="space-y-1.5">
      {/* Ганц зураг (хувилбарын) — нарийн баганад ч бүтэн өргөнөөр. */}
      <ul
        className={cn(
          "grid gap-2",
          gridClassName ??
            (max === 1 ? "grid-cols-1" : "grid-cols-3 sm:grid-cols-4"),
        )}
      >
        {value.map((url, i) => (
          <li
            key={url}
            className="bg-secondary relative aspect-4/5 overflow-hidden rounded-lg"
          >
            <Image
              src={url}
              alt=""
              fill
              sizes="120px"
              className="object-cover"
            />
            {i === 0 && (
              <span className="bg-background/85 absolute bottom-1 left-1 rounded px-1.5 py-0.5 text-[10px] font-medium">
                Нүүр зураг
              </span>
            )}
            <div className="absolute top-1 right-1 flex gap-1">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="bg-background/85 text-muted-foreground hover:text-foreground flex size-8 items-center justify-center rounded-md disabled:hidden"
                aria-label={`${i + 1}-р зургийг өмнө нь`}
              >
                <ArrowLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === value.length - 1}
                className="bg-background/85 text-muted-foreground hover:text-foreground flex size-8 items-center justify-center rounded-md disabled:hidden"
                aria-label={`${i + 1}-р зургийг дараа нь`}
              >
                <ArrowRight className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => onChange(value.filter((u) => u !== url))}
                className="bg-background/85 text-muted-foreground hover:text-destructive flex size-8 items-center justify-center rounded-md"
                aria-label={`${i + 1}-р зургийг хасах`}
              >
                <X className="size-4" />
              </button>
            </div>
          </li>
        ))}
        {!full && (
          <li>
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="border-muted-foreground/40 bg-secondary text-muted-foreground hover:border-muted-foreground/70 hover:bg-accent flex aspect-4/5 w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs transition-colors disabled:opacity-60"
            >
              {busy ? (
                <UploadProgress pct={progress} />
              ) : (
                <>
                  <ImagePlus className="size-5" aria-hidden />
                  Зураг нэмэх
                </>
              )}
            </button>
          </li>
        )}
      </ul>
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
