"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { ProductImage } from "@/lib/types";

/** Auto-advance interval — client asked for a 3-5s rotation. */
const AUTOPLAY_MS = 4000;

export function ProductGallery({
  images,
  name,
}: {
  images: ProductImage[];
  name: string;
}) {
  const [active, setActive] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const current = images[active] ?? images[0];
  const scrollerRef = React.useRef<HTMLDivElement>(null);

  // Track the active slide while swiping on mobile.
  function onScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== active) setActive(idx);
  }

  const go = React.useCallback((i: number) => {
    setActive(i);
    const el = scrollerRef.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }, []);

  // Rotate on its own; any manual interaction stops it for good so we never
  // yank the image out from under someone who is looking at a specific shot.
  React.useEffect(() => {
    if (paused || images.length < 2) return;
    const t = setInterval(
      () => setActive((i) => (i + 1) % images.length),
      AUTOPLAY_MS,
    );
    return () => clearInterval(t);
  }, [paused, images.length]);

  // Keep the mobile scroller in sync with autoplay's index changes.
  React.useEffect(() => {
    const el = scrollerRef.current;
    if (!el || paused) return;
    const target = active * el.clientWidth;
    if (Math.abs(el.scrollLeft - target) > 8) {
      el.scrollTo({ left: target, behavior: "smooth" });
    }
  }, [active, paused]);

  function pick(i: number) {
    setPaused(true);
    go(i);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Mobile: full-bleed swipeable image carousel.
          -mx-4 cancels the page's px-4; -mt-20 pulls the image up under the
          transparent compact header (h-16 header + py-4 wrapper = 80px). */}
      <div className="relative -mx-4 -mt-20 sm:hidden">
        <div
          ref={scrollerRef}
          onScroll={onScroll}
          onPointerDown={() => setPaused(true)}
          className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
        >
          {images.map((img, i) => (
            <div
              key={i}
              className="bg-muted relative aspect-[4/5] w-full shrink-0 snap-center"
            >
              <Image
                src={img.url}
                alt={img.alt || `${name} ${i + 1}`}
                fill
                priority={i === 0}
                sizes="(max-width: 640px) 100vw, 1px"
                className="object-cover"
              />
            </div>
          ))}
        </div>
        {images.length > 1 && (
          <div className="bg-secondary/70 absolute bottom-14 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full px-2.5 py-1.5 backdrop-blur">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => pick(i)}
                aria-label={`Зураг ${i + 1}`}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === active
                    ? "bg-foreground w-6"
                    : "bg-muted-foreground/60 w-1.5",
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* Desktop: main image + thumbnails */}
      <div className="hidden sm:block">
        <div className="border-border bg-muted shadow-soft relative aspect-[4/5] overflow-hidden rounded-2xl border">
          {current && (
            <Image
              src={current.url}
              alt={current.alt || name}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, (max-width: 1408px) 50vw, 652px"
              className="object-cover"
            />
          )}
        </div>
        {images.length > 1 && (
          <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto p-0.5">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => pick(i)}
                className={cn(
                  "bg-muted relative size-20 shrink-0 overflow-hidden rounded-xl transition-all",
                  i === active
                    ? "ring-foreground ring-2"
                    : "opacity-60 hover:opacity-100",
                )}
                aria-label={`Зураг ${i + 1}`}
              >
                <Image
                  src={img.url}
                  alt={img.alt || `${name} ${i + 1}`}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
