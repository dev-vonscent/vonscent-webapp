"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { ProductCard } from "./product-card";
import { cn } from "@/lib/utils";
import type { ProductListItem } from "@/lib/types";

export function ProductCarousel({ products }: { products: ProductListItem[] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    containScroll: "trimSnaps",
    slidesToScroll: "auto",
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
    <div className="group/carousel relative">
      <div ref={emblaRef} className="-mx-4 overflow-hidden sm:mx-0">
        <div className="flex gap-4 px-4 sm:px-0">
          {products.map((p) => (
            <div
              key={p.id}
              className="w-[44%] min-w-0 shrink-0 sm:w-[31%] lg:w-[23.5%]"
            >
              <ProductCard product={p} />
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
        "border-border bg-card text-foreground shadow-lift absolute top-[28%] z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border transition-all md:flex",
        "hover:border-gold-strong/50 opacity-0 group-hover/carousel:opacity-100",
        "disabled:pointer-events-none disabled:opacity-0",
        side === "left" ? "-left-5" : "-right-5",
      )}
    >
      <Icon className="size-5" />
    </button>
  );
}
