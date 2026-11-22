"use client";

import * as React from "react";
import Image from "next/image";
import { ShoppingCart } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ShopExtraCard, ShopExtraDetail } from "../types";
import { eyebrowText, repeatsName } from "../lib/display";
import { ExtraPurchase } from "./extra-purchase";
import { useFocusedVariantImage, VariantImageProvider } from "./variant-image";

/**
 * Нэмэлт барааны картын «Сагсанд нэмэх» — үнэртний `QuickAdd`-тэй ижил
 * товч, ижил цонх. Хувилбар, анхааруулга (шприц, үлдэгдэлтэй шил), тоо
 * бүгд барааны хуудасных (`ExtraPurchase`) — дүрэм хоёр газар зөрөхгүй.
 */
export function ExtraQuickAdd({
  extra,
  className,
}: {
  extra: ShopExtraCard;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [detail, setDetail] = React.useState<ShopExtraDetail | null>(null);
  const eyebrow = eyebrowText(extra);

  // Хувилбартай бүтэн мэдээллийг цонх анх нээгдэхэд л татна.
  React.useEffect(() => {
    if (!open || detail) return;
    let cancelled = false;
    fetch(`/api/extras?slug=${encodeURIComponent(extra.slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { extra?: ShopExtraDetail } | null) => {
        if (!cancelled && data?.extra) setDetail(data.extra);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, detail, extra.slug]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Сагсанд нэмэх"
          className={cn(
            "bg-background/80 text-foreground hover:bg-background relative flex size-8 items-center justify-center rounded-full backdrop-blur transition-colors before:absolute before:top-1/2 before:left-1/2 before:size-11 before:-translate-1/2 before:content-['']",
            className,
          )}
        >
          <ShoppingCart className="size-4" />
        </button>
      </DialogTrigger>

      <DialogContent className="gap-4 p-4 sm:p-6">
        <DialogTitle className="sr-only">Сагсанд нэмэх</DialogTitle>

        {/* Хувилбар сонгоход жижиг зураг тэр хувилбарынх болно. */}
        <VariantImageProvider>
          <QuickAddSummary extra={extra} eyebrow={eyebrow} />
          {detail ? (
            <ExtraPurchase extra={detail} buyBar={false} />
          ) : (
            <div className="space-y-3">
              <Skeleton className="h-9 w-32" />
              <div className="grid grid-cols-3 gap-2">
                <Skeleton className="h-14 rounded-lg" />
                <Skeleton className="h-14 rounded-lg" />
                <Skeleton className="h-14 rounded-lg" />
              </div>
              <Skeleton className="h-12 w-full rounded-md" />
            </div>
          )}
        </VariantImageProvider>
      </DialogContent>
    </Dialog>
  );
}

function QuickAddSummary({
  extra,
  eyebrow,
}: {
  extra: ShopExtraCard;
  eyebrow: string;
}) {
  const image = useFocusedVariantImage() ?? extra.image;
  return (
    <div className="flex items-center gap-3">
      <div className="bg-secondary relative size-16 shrink-0 overflow-hidden rounded-xl">
        {image && (
          <Image
            src={image}
            alt={extra.name}
            fill
            sizes="64px"
            className="object-cover"
          />
        )}
      </div>
      <div className="min-w-0">
        {!repeatsName(eyebrow, extra.name) && (
          <p className="text-muted-foreground truncate text-[11px] tracking-[0.15em] uppercase">
            {eyebrow}
          </p>
        )}
        <p className="font-serif text-base/tight font-medium">{extra.name}</p>
      </div>
    </div>
  );
}
