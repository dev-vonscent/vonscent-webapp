"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Байршуулалтын явц — picker tile-ийн дотор. Хувь мэдэгдэж байвал бар +
 * тоо, серверийн боловсруулалт (хувь мэдэгдэхгүй) үед spinner. Файл сонгоод
 * юу ч харагдахгүй байсныг засав: админ дахин дарж давхар хуулдаг байсан.
 */
export function UploadProgress({
  pct,
  label = "Байршуулж байна",
  className,
}: {
  /** 0–100, or null when the server is processing and no % is known. */
  pct: number | null;
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct ?? undefined}
      aria-label={label}
      className={cn(
        "text-muted-foreground flex w-full flex-col items-center gap-2 px-6 text-xs",
        className,
      )}
    >
      {pct === null ? (
        <>
          <Loader2 className="size-5 animate-spin" />
          <span>Боловсруулж байна…</span>
        </>
      ) : (
        <>
          <span className="tabular-nums">
            {label}… {pct}%
          </span>
          <span className="bg-border h-1 w-full overflow-hidden rounded-full">
            <span
              className="bg-foreground block h-full transition-[width] duration-150"
              style={{ width: `${pct}%` }}
            />
          </span>
        </>
      )}
    </div>
  );
}
