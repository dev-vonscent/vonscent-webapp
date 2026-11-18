"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Luggage,
  Maximize2,
  PiggyBank,
  Pocket,
  TestTube,
  type LucideIcon,
} from "lucide-react";
import {
  sizeHint,
  type SizeHintKind,
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
 * - Карт дээр зөвхөн хэмжээ + «75 цацалт» (эсвэл төлөв: «Дууссан»,
 *   «Түр байхгүй», «Зарахгүй»). Үнэ нь дээрх `SizePrice`-д.
 * - Дууссан / савгүй хэмжээ СОНГОГДОНО (task 4): үнэ нь дээр харагдана,
 *   худалдан авах товчийг дуудагч идэвхгүй болгоно. Зөвхөн «Зарахгүй»
 *   (админы хаасан, багцад бүрэн бус) сонгогдохгүй.
 * - Хямдралтай хэмжээ (2.6): картын баруун дээд буланд бодит хувь «−15%» —
 *   `destructive` token-ий жижиг starburst (эсвэл pill), картын ирмэгээс
 *   гарсан тул сонгогдсон (`bg-cta`) ч, сонгогдоогүй ч ижил харагдана.
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
  saleMarker = "burst",
}: {
  options: readonly SizeOption[];
  value: string;
  onChange: (id: string) => void;
  heading?: string;
  /** Хямдралын тэмдгийн хэлбэр (2.6): `burst` анхдагч, `pill` нөөц. */
  saleMarker?: "burst" | "pill";
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
          const status = o.note ?? o.sprays;
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
              aria-label={[
                o.label,
                o.note,
                o.salePct > 0 ? `${o.salePct}% хямдралтай` : null,
              ]
                .filter(Boolean)
                .join(" — ")}
              data-sale={o.salePct > 0 || undefined}
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
              {o.salePct > 0 && (
                <SaleMarker pct={o.salePct} shape={saleMarker} />
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
                  // Багцын «тус бүр 300 цацалт» 4 баганад багтахгүй —
                  // «тус бүр» / «300 цацалт» гэж хоёр мөрөнд орно.
                  "text-center text-xs/tight text-balance",
                  active ? "text-cta-foreground/75" : "text-muted-foreground",
                )}
              >
                {status}
              </span>
            </button>
          );
        })}
      </div>
      {/* Нэг тогтсон газар — сонгосон хэмжээгээр icon + текст солигдоно.
          Өндөр нь тогтмол (хоосон үед ч) — layout үсрэхгүй. */}
      <SizeHintRow hint={hint} />
    </div>
  );
}

const HINT_ICON: Record<SizeHintKind, LucideIcon> = {
  trial: TestTube,
  pocket: Pocket,
  travel: Luggage,
  value: PiggyBank,
  largest: Maximize2,
};

/**
 * Хэмжээний зөвлөмж (task 15): `bg-muted` зөөлөн дэвсгэртэй нэг мөр, хэмжээнд
 * тохирох icon. `transition-colors` үгүй — сонголтоор шууд солигдоно.
 */
function SizeHintRow({
  hint,
}: {
  hint: { text: string; kind: SizeHintKind } | null;
}) {
  const Icon = hint ? HINT_ICON[hint.kind] : null;
  return (
    <p
      aria-live="polite"
      data-testid="size-hint"
      data-kind={hint?.kind}
      className={cn(
        "flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
        hint ? "bg-muted text-foreground" : "invisible",
      )}
    >
      {Icon && (
        <Icon aria-hidden className="text-muted-foreground size-4 shrink-0" />
      )}
      <span>{hint?.text}</span>
    </p>
  );
}

/**
 * 14 хошуут зууван starburst (viewBox 100×60): «−30%» шиг 4 тэмдэгт
 * дотроо багтана, өндөр нь намхан тул картын хэмжээний шошгыг хаахгүй.
 */
const BURST_POINTS = Array.from({ length: 28 }, (_, i) => {
  const r = i % 2 === 0 ? 1 : 0.84;
  const a = (Math.PI * i) / 14 - Math.PI / 2;
  return `${(50 + 50 * r * Math.cos(a)).toFixed(2)},${(30 + 30 * r * Math.sin(a)).toFixed(2)}`;
}).join(" ");

/**
 * Картын хямдралын тэмдэг «−15%» (2.6). Өнгө нь `destructive` /
 * `destructive-foreground` token — theme бүрт contrast-аа хадгална (black
 * theme-д цайвар улаан дээр бараан тоо). Дэлгэц уншигчид картын aria-label
 * «15% хямдралтай» хэлнэ — энд aria-hidden.
 */
function SaleMarker({ pct, shape }: { pct: number; shape: "burst" | "pill" }) {
  if (shape === "pill") {
    return (
      <span
        aria-hidden
        data-marker="pill"
        className="bg-destructive text-destructive-foreground absolute -top-2 -right-1.5 rounded-full px-1.5 py-0.5 text-[11px] leading-none font-bold tabular-nums"
      >
        −{pct}%
      </span>
    );
  }
  return (
    <span
      aria-hidden
      data-marker="burst"
      className="absolute -top-5 -right-2 flex h-7 w-12 items-center justify-center"
    >
      <svg
        viewBox="0 0 100 60"
        preserveAspectRatio="none"
        className="text-destructive absolute inset-0 size-full"
      >
        <polygon points={BURST_POINTS} fill="currentColor" />
      </svg>
      <span className="text-destructive-foreground relative text-[11px] leading-none font-bold tracking-tight tabular-nums">
        −{pct}%
      </span>
    </span>
  );
}
