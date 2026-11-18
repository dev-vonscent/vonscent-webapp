"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  sizeHint,
  spraysText,
  type SizeOption,
} from "@/features/products/size-options";

const NAV_KEYS = [
  "ArrowRight",
  "ArrowDown",
  "ArrowLeft",
  "ArrowUp",
  "Home",
  "End",
] as const;

/**
 * Хэмжээ сонгогч (task 15, 4, 2.6) — барааны дэлгэрэнгүй, бэлэн багцын
 * хуудас, хоёр quick-add бүгд ЭНЭ нэг компонент.
 *
 * - Карт дээр зөвхөн хэмжээ + «≈ 75 цацалт» (эсвэл төлөв: «Дууссан»,
 *   «Түр байхгүй», «Зарахгүй»). Үнэ нь дээрх `SizePrice`-д.
 * - Дууссан / савгүй хэмжээ СОНГОГДОНО (task 4): үнэ нь дээр харагдана,
 *   худалдан авах товчийг дуудагч идэвхгүй болгоно. Зөвхөн «Зарахгүй»
 *   (админы хаасан, багцад бүрэн бус) сонгогдохгүй.
 * - Хямдралтай хэмжээ (2.6): картын баруун дээд буланд «%» тэмдэг —
 *   `destructive` token-ий жижиг дугуй, картын ГАДНА ирмэг дээр тул сонгогдсон
 *   (`bg-cta`) ч, сонгогдоогүй ч ижил харагдана.
 * - «Туршиж үзэх» / «Хамгийн ашигтай» тэмдэг картаас авагдаж, сонгогчийн
 *   ДООР нэг мөр болсон (`SIZE_HINTS`).
 * - radiogroup: сум / Home / End товчоор нүүж сонгоно, фокус бүлэгт ганц
 *   зогсоолтой (roving tabindex), сонгогдохгүй картыг алгасна.
 * - Сонгогдсон нь `bg-cta text-cta-foreground`, `transition-colors` үгүй
 *   (design.md §7.1).
 */
export function SizeSelector({
  options,
  value,
  onChange,
  heading = "Хэмжээ сонгох",
}: {
  options: readonly SizeOption[];
  value: string;
  onChange: (id: string) => void;
  heading?: string;
}) {
  const labelId = React.useId();
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const selected = options.find((o) => o.id === value) ?? null;
  const hint = sizeHint(options, selected);
  // Фокусын ганц зогсоол: сонгогдсон карт, эс бөгөөс сонгож болох эхнийх.
  const tabStop =
    selected?.selectable === true
      ? selected.id
      : options.find((o) => o.selectable)?.id;

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!(NAV_KEYS as readonly string[]).includes(e.key)) return;
    e.preventDefault();
    const n = options.length;
    if (!n) return;
    const from = options.findIndex((o) => o.id === value);
    const back =
      e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "End";
    const step = back ? -1 : 1;
    let next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? n - 1
          : (Math.max(from, 0) + step + n) % n;
    // Сонгож болохгүй картыг алгасна — фокус тэр дээр зогсохгүй.
    for (let i = 0; i < n && !options[next].selectable; i += 1) {
      next = (next + step + n) % n;
    }
    if (!options[next].selectable) return;
    onChange(options[next].id);
    refs.current[next]?.focus();
  }

  return (
    <div className="space-y-3">
      <p id={labelId} className="text-sm font-medium">
        {heading}
      </p>
      {/* Хэмжээ хаалттай жагсаалт (ML_SIZES = 4) — утсан дээр ч нэг мөрөнд
          багтахаар тэнцүү 4 багана. */}
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        onKeyDown={onKeyDown}
        className="grid grid-cols-4 gap-2"
      >
        {options.map((o, i) => {
          const active = o.id === value;
          const status = o.note ?? spraysText(o.ml);
          return (
            <button
              key={o.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={active}
              aria-disabled={o.selectable ? undefined : true}
              tabIndex={o.id === tabStop ? 0 : -1}
              aria-label={[o.label, o.note, o.onSale ? "хямдралтай" : null]
                .filter(Boolean)
                .join(" — ")}
              data-sale={o.onSale || undefined}
              onClick={() => o.selectable && onChange(o.id)}
              className={cn(
                "relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-2",
                !o.selectable
                  ? "bg-secondary/40 text-muted-foreground cursor-not-allowed opacity-60"
                  : active
                    ? "bg-cta text-cta-foreground"
                    : "bg-secondary hover:bg-accent",
              )}
            >
              {o.onSale && (
                <span
                  aria-hidden
                  className="bg-destructive text-destructive-foreground absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full text-[11px] leading-none font-bold"
                >
                  %
                </span>
              )}
              {/* Зураас зөвхөн хэмжээн дээр: «Дууссан» гэдэг үгийг
                  зурвал уншигдахгүй. */}
              <span
                className={cn(
                  "text-sm font-semibold whitespace-nowrap",
                  !o.buyable && "line-through",
                )}
              >
                {o.label}
              </span>
              <span
                className={cn(
                  "text-xs whitespace-nowrap",
                  active ? "text-cta-foreground/75" : "text-muted-foreground",
                )}
              >
                {status}
              </span>
            </button>
          );
        })}
      </div>
      {/* Нэг тогтсон газар — сонгосон хэмжээгээр текст солигдоно. */}
      <p
        className="text-muted-foreground min-h-4 text-xs"
        aria-live="polite"
        data-testid="size-hint"
      >
        {hint}
      </p>
    </div>
  );
}
