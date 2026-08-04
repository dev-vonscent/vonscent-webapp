"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { HeroBanner } from "@/features/content/api";

/** Slow rotation — the hero is decorative, not something to chase. */
const AUTOPLAY_MS = 6000;

/**
 * Home hero driven by the `hero_banners` table (admin A8). Falls back to a
 * single static slide when the store has only one banner, in which case no
 * controls are rendered at all.
 */
export function HeroCarousel({ banners }: { banners: HeroBanner[] }) {
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);

  React.useEffect(() => {
    if (paused || banners.length < 2) return;
    const t = setInterval(
      () => setIndex((i) => (i + 1) % banners.length),
      AUTOPLAY_MS,
    );
    return () => clearInterval(t);
  }, [paused, banners.length]);

  if (banners.length === 0) return null;

  return (
    <div className="absolute inset-0" onPointerDown={() => setPaused(true)}>
      {banners.map((b, i) => (
        <div
          key={b.id}
          aria-hidden={i !== index}
          className={cn(
            "absolute inset-0 transition-opacity duration-700",
            i === index ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          {b.imageUrl && (
            <Image
              src={b.imageUrl}
              alt={b.title}
              fill
              priority={i === 0}
              sizes="100vw"
              className="object-cover"
            />
          )}
          {(b.title || b.subtitle || b.ctaLabel) && (
            <div className="absolute inset-0 flex flex-col items-center justify-end gap-3 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-8 text-center sm:justify-center sm:p-12">
              <h2 className="font-serif text-3xl font-semibold text-white drop-shadow sm:text-5xl">
                {b.title}
              </h2>
              {b.subtitle && (
                <p className="max-w-xl text-sm text-white/85 sm:text-base">
                  {b.subtitle}
                </p>
              )}
              {b.ctaLabel && (
                <Button asChild size="lg" className="mt-1">
                  <Link href={b.ctaHref || "/catalog"}>{b.ctaLabel}</Link>
                </Button>
              )}
            </div>
          )}
        </div>
      ))}

      {banners.length > 1 && (
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
          {banners.map((b, i) => (
            <button
              key={b.id}
              onClick={() => {
                setPaused(true);
                setIndex(i);
              }}
              aria-label={`Баннер ${i + 1}`}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index ? "w-6 bg-white" : "w-1.5 bg-white/50",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
