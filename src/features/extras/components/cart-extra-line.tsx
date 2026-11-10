"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Package, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CartCheckbox } from "@/features/cart/components/cart-checkbox";
import { useCart, type CartExtra } from "@/features/cart/store";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  extraIssueLabel,
  type ExtraLineStatus,
} from "../use-extras-availability";

/** Нэг мөрийн дээд тоо — захиалгын validator-тэй ижил. */
const QTY_MAX = 99;

/**
 * Сагсны нэмэлт барааны мөр (extras-shop-plan §10) — сагсны хуудас (`page`)
 * ба drawer (`sheet`) хоёулаа. Үнэртний мөрөөс ялгаатай нь хэмжээ сонгохгүй;
 * үлдэгдэлтэй шил ганц ширхэг тул тоо өөрчлөхгүй. Нөөц багассан бол тоог
 * өөрөө багасгахгүй — «1 болгох» / «Хасах»-ыг хэрэглэгчид өгнө.
 */
export function CartExtraLine({
  line,
  status,
  selected,
  onRemove,
  size = "page",
}: {
  line: CartExtra;
  status: ExtraLineStatus;
  selected: boolean;
  onRemove: () => void;
  size?: "page" | "sheet";
}) {
  const setQty = useCart((s) => s.setExtraQty);
  const setSelected = useCart((s) => s.setExtraSelected);
  const single = line.mode === "leftover_liquid";
  const blocked = status.gone || status.available === 0;
  const max = Math.min(QTY_MAX, status.available ?? QTY_MAX);
  const issue = extraIssueLabel(line, status);
  const short =
    !blocked && status.available != null && line.qty > status.available;

  return (
    <div className="flex gap-3 md:gap-4">
      <CartCheckbox
        checked={selected}
        disabled={blocked}
        onCheckedChange={(v) => setSelected(line.key, Boolean(v))}
        aria-label={`${line.name} сонгох`}
        className="mt-1 self-start"
      />
      <Link
        href={`/extras/${line.slug}`}
        className={cn(
          "bg-muted relative shrink-0 overflow-hidden rounded-md",
          size === "page" ? "size-24" : "size-20",
        )}
      >
        {line.image ? (
          <Image
            src={line.image}
            alt={line.name}
            fill
            sizes={size === "page" ? "96px" : "80px"}
            className="object-cover"
          />
        ) : (
          <span className="flex size-full items-center justify-center">
            <Package className="text-muted-foreground size-5" aria-hidden />
          </span>
        )}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs">{line.categoryName}</p>
            <Link
              href={`/extras/${line.slug}`}
              className="hover:text-gold-strong line-clamp-2 text-sm/tight font-medium"
            >
              {line.name}
            </Link>
            {line.label && (
              <p className="text-muted-foreground mt-1 text-xs">{line.label}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full md:size-9"
            aria-label="Устгах"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
        {issue && (
          <div className="mt-1.5 space-y-1.5">
            <p className="text-destructive text-xs">{issue}</p>
            {short && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() =>
                  setQty(line.key, status.available!, status.available!)
                }
              >
                {status.available} болгох
              </Button>
            )}
          </div>
        )}
        <div className="mt-auto flex items-center justify-between pt-2">
          {single ? (
            <span className="text-muted-foreground text-xs">Ганц ширхэг</span>
          ) : (
            <div className="bg-secondary flex items-center rounded-full">
              <button
                type="button"
                className="hover:text-gold-strong flex size-11 items-center justify-center rounded-full disabled:opacity-40 md:size-9"
                onClick={() => setQty(line.key, line.qty - 1)}
                disabled={line.qty <= 1}
                aria-label="Хасах"
              >
                <Minus className="size-4 md:size-3.5" />
              </button>
              <span className="w-8 text-center text-sm tabular-nums md:w-6">
                {line.qty}
              </span>
              <button
                type="button"
                className="hover:text-gold-strong flex size-11 items-center justify-center rounded-full disabled:opacity-40 md:size-9"
                onClick={() => setQty(line.key, line.qty + 1, max)}
                disabled={line.qty >= max}
                aria-label="Нэмэх"
              >
                <Plus className="size-4 md:size-3.5" />
              </button>
            </div>
          )}
          <span className="text-sm font-medium whitespace-nowrap tabular-nums">
            {formatPrice(line.unitPrice * line.qty)}
          </span>
        </div>
      </div>
    </div>
  );
}
