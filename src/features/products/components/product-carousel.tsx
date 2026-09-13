"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { ProductCard } from "./product-card";
import { cn } from "@/lib/utils";
import type { ProductListItem } from "@/lib/types";

export function ProductCarousel({
  products,
}: {
  products: (ProductListItem & { matchPct?: number })[];
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    containScroll: "trimSnaps",
    // Сум дарахад нэг бараагаар — "auto" нь харагдах бүлгээрээ (3-4 бараа)
    // үсэрдэг байсан.
    slidesToScroll: 1,
  });
  const [atStart, setAtStart] = React.useState(true);
  const [atEnd, setAtEnd] = React.useState(false);

  React.useEffect(() => {
    if (!emblaApi) return;
    const update = () => {
      setAtStart(!emblaApi.canScrollPrev());
      setAtEnd(!emblaApi.canScrollNext());
    };
    update();
    emblaApi.on("select", update).on("reInit", update);
    return () => {
      emblaApi.off("select", update).off("reInit", update);
    };
  }, [emblaApi]);

  return (
    // `@container`: сумны байрлалыг картын зурагны өндрөөр (карт бүр
    // контейнерийн өргөний хувиар өргөнтэй, зураг нь 4/5) тооцно.
    <div className="group/carousel @container relative">
      <div ref={emblaRef} className="-mx-4 overflow-hidden sm:mx-0">
        <div className="flex gap-4 px-4 sm:px-0">
          {products.map((p) => (
            <div
              key={p.id}
              className="w-[44%] min-w-0 shrink-0 sm:w-[31%] lg:w-[23.5%]"
            >
              <ProductCard product={p} matchPct={p.matchPct} />
            </div>
          ))}
        </div>
      </div>

      <CarouselArrow
        side="left"
        onClick={() => emblaApi?.scrollPrev()}
        disabled={atStart}
      />
      <CarouselArrow
        side="right"
        onClick={() => emblaApi?.scrollNext()}
        disabled={atEnd}
      />
    </div>
  );
}

function CarouselArrow({
  side,
  onClick,
  disabled,
}: {
  side: "left" | "right";
  onClick: () => void;
  disabled: boolean;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={side === "left" ? "Өмнөх" : "Дараах"}
      className={cn(
        // Голлосон: rail-ийн өндрийн яг дунд. Хүрээ token нь ил тод
        // (--border: transparent) тул ring-ээр ирмэг өгч, дэвсгэрийг
        // background-аас салгаж тодруулав.
        // Голлох цэг нь rail биш, картын ЗУРАГ: зурагны өндөр = картын өргөн
        // (31cqw / lg дээр 23.5cqw) × 5/4, тэгэхээр төв нь түүний хагас.
        "bg-background/85 text-foreground shadow-lift ring-foreground/15 absolute top-[calc(31cqw*5/8)] z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full ring-1 backdrop-blur transition-all md:flex lg:top-[calc(23.5cqw*5/8)]",
        "hover:bg-foreground hover:text-background hover:ring-foreground/40 opacity-0 group-focus-within/carousel:opacity-100 group-hover/carousel:opacity-100 focus-visible:opacity-100",
        "disabled:pointer-events-none disabled:opacity-0",
        side === "left" ? "-left-5" : "-right-5",
      )}
    >
      <Icon className="size-5" />
    </button>
  );
}
