"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProductCard } from "./product-card";
import { cn } from "@/lib/utils";
import type { ProductListItem } from "@/lib/types";

export function ProductCarousel({ products }: { products: ProductListItem[] }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = React.useState(true);
  const [atEnd, setAtEnd] = React.useState(false);

  const update = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  }, []);

  React.useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [update]);

  function scrollBy(dir: 1 | -1) {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  }

  return (
    <div className="group/carousel relative">
      <div
        ref={ref}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 sm:mx-0 sm:scroll-px-0 sm:px-0"
      >
        {products.map((p) => (
          <div
            key={p.id}
            className="w-[44%] shrink-0 snap-start sm:w-[31%] lg:w-[23.5%]"
          >
            <ProductCard product={p} />
          </div>
        ))}
      </div>

      <CarouselArrow
        side="left"
        onClick={() => scrollBy(-1)}
        disabled={atStart}
      />
      <CarouselArrow
        side="right"
        onClick={() => scrollBy(1)}
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
