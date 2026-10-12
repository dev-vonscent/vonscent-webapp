"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import { TRIAL_SIZE_ML } from "@/lib/constants";
import { bestValueOf } from "@/features/products/best-value";
import type { Collection } from "../types";

/**
 * Багцын хэмжээ сонгогч — «2ml ×4», «Хамгийн ашигтай», «Туршиж үзэх», ₮/ml.
 * Багцын хуудас ба нүүрний хурдан нэмэх цонх хоёулаа үүнийг ашиглана.
 * Дөрвүүлээ нэг мөрөнд: хоёр мөр болмогц сүүлчийн хэмжээ (хамгийн үнэтэй нь)
 * доод хөвдөг цэсний доогуур орж, эхний дэлгэцэнд огт харагдахгүй байсан.
 */
export function CollectionSizePicker({
  collection,
  ml,
  onChange,
  labelId,
}: {
  collection: Collection;
  ml: number;
  onChange: (ml: number) => void;
  /** «Хэмжээ сонгох» гарчгийн id — radiogroup-ийн нэр. */
  labelId: string;
}) {
  const sizeRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  /** Нэг хэмжээний багцад нийт хэдэн ml орох вэ: «2ml ×4» = 8ml. */
  const memberCount = collection.members.length;
  const totalMl = (size: number) => size * Math.max(memberCount, 1);
  // Дан усных шиг: хамгийн бага ₮/ml, нөөцөөс үл хамааран (best-value.ts).
  const bestValueMl =
    bestValueOf(
      collection.prices.map((p) => ({ ml: totalMl(p.ml), price: p.price })),
    )?.ml ?? null;

  /**
   * Хэмжээний сонголт нь radiogroup — хоёрын нэгийг асаах toggle биш,
   * нэгийг нь сонгох жагсаалт. Тиймээс сум товчоор нүүж, фокус нь бүлэг дээр
   * ганцхан зогсоолтой байна (roving tabindex).
   */
  function onSizeKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const keys = [
      "ArrowRight",
      "ArrowDown",
      "ArrowLeft",
      "ArrowUp",
      "Home",
      "End",
    ];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const list = collection.prices;
    const from = list.findIndex((p) => p.ml === ml);
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
    let next: number;
    if (e.key === "Home") next = 0;
    else if (e.key === "End") next = list.length - 1;
    else next = (from + step + list.length) % list.length;
    // Байхгүй хэмжээг алгасна — сонгох боломжгүй зүйл дээр фокус зогсоохгүй.
    for (let i = 0; i < list.length && !list[next].available; i += 1) {
      next = (next + (step || 1) + list.length) % list.length;
    }
    if (!list[next].available) return;
    onChange(list[next].ml);
    sizeRefs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelId}
      onKeyDown={onSizeKeyDown}
      className="grid grid-cols-4 gap-2"
    >
      {collection.prices.map((p, i) => {
        const active = p.ml === ml;
        const isBestValue = bestValueMl === totalMl(p.ml);
        // 2ml нь sample биш — энгийн хэмжээ; шошго нь зөвхөн UI санал.
        const isTrial = p.ml === TRIAL_SIZE_ML;
        return (
          <button
            key={p.ml}
            type="button"
            role="radio"
            aria-checked={active}
            aria-disabled={p.available ? undefined : true}
            tabIndex={active ? 0 : -1}
            ref={(el) => {
              sizeRefs.current[i] = el;
            }}
            onClick={() => p.available && onChange(p.ml)}
            aria-label={`${p.ml}ml ×${memberCount}${p.available ? "" : " — байхгүй"}`}
            className={cn(
              "relative flex flex-col items-center rounded-lg px-1 pt-2.5 pb-2 transition-colors",
              !p.available
                ? "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
                : active
                  ? // Цул гадаргуу — «сонгогдсон» нь бүдэг өнгө биш,
                    // эргэсэн өнгө байх ёстой (/collections/build-тэй ижил).
                    "bg-foreground text-background"
                  : "bg-secondary hover:bg-accent",
            )}
          >
            {isBestValue ? (
              <span className="bg-foreground text-background absolute -top-2 rounded-full px-1.5 py-px text-[9px] font-semibold whitespace-nowrap">
                Хамгийн ашигтай
              </span>
            ) : (
              isTrial && (
                <span className="bg-card text-foreground absolute -top-2 rounded-full px-1.5 py-px text-[9px] font-semibold whitespace-nowrap shadow-sm">
                  Туршиж үзэх
                </span>
              )
            )}
            {/* Зураас нь ЗӨВХӨН хэмжээн дээр — «Байхгүй» гэдэг үг өөрөө
                төлвийг хэлж байгаа тул түүнийг дээрээс нь зурвал зүгээр
                л уншихад хэцүү болно. «2ml ×4» — нэг үнэртний хэмжээ ×
                үнэртний тоо, багцад нийт хэдэн ml орохыг хэлнэ. */}
            <span
              className={cn(
                "text-sm font-semibold whitespace-nowrap",
                !p.available && "line-through",
              )}
            >
              {p.ml}ml ×{memberCount}
            </span>
            <span
              className={cn(
                "text-xs",
                active ? "text-background/75" : "text-muted-foreground",
              )}
            >
              {p.available ? formatPrice(p.price) : "Байхгүй"}
            </span>
            {p.available && (
              <span
                className={cn(
                  "text-[10px]",
                  active ? "text-background/75" : "text-muted-foreground",
                )}
              >
                {formatPrice(Math.round(p.price / totalMl(p.ml)))}/ml
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
