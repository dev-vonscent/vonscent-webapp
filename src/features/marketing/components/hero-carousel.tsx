"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import Fade from "embla-carousel-fade";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import type { HeroBanner } from "@/features/content/api";

/** Slow rotation — the hero is decorative, not something to chase. */
const AUTOPLAY_MS = 6000;

/**
 * Home hero driven by the `hero_banners` table (admin A8), on Embla with the
 * fade plugin (keeps the old cross-fade look, adds swipe + loop). A single
 * banner renders statically with no controls.
 */
export function HeroCarousel({ banners }: { banners: HeroBanner[] }) {
  const many = banners.length > 1;
  const reducedMotion = usePrefersReducedMotion();
  const autoplay = many && !reducedMotion;
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: many, duration: 40, watchDrag: many },
    autoplay
      ? [Fade(), Autoplay({ delay: AUTOPLAY_MS, stopOnInteraction: true })]
      : [Fade()],
  );
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  if (banners.length === 0) return null;

  return (
    <div className="absolute inset-0 overflow-hidden" ref={emblaRef}>
      <div className="flex h-full">
        {banners.map((b, i) => (
          <div key={b.id} className="relative h-full min-w-0 flex-[0_0_100%]">
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
      </div>

      {many && (
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
          {banners.map((b, i) => (
            <button
              key={b.id}
              onClick={() => {
                emblaApi?.plugins().autoplay?.stop();
                emblaApi?.scrollTo(i);
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
