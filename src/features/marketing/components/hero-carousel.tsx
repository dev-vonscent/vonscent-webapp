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
    <div className="relative overflow-hidden" ref={emblaRef}>
      <div className="flex">
        {banners.map((b, i) => (
          <div key={b.id} className="relative min-w-0 flex-[0_0_100%]">
            {/* Same layered layout as the static hero: editorial text beside
                a contained image — the upload is never scaled past 560px, so
                any admin-supplied resolution stays sharp. */}
            <div className="mx-auto grid max-w-352 items-center gap-8 px-4 pt-28 pb-16 md:grid-cols-2 md:px-8">
              <div className="relative z-10 max-w-md space-y-5 max-md:mx-auto max-md:flex max-md:flex-col max-md:items-center max-md:text-center md:order-1">
                <h2 className="font-serif text-3xl font-semibold tracking-tight text-balance text-white sm:text-5xl">
                  {b.title}
                </h2>
                {b.subtitle && (
                  <p className="text-sm text-white/70 sm:text-base">
                    {b.subtitle}
                  </p>
                )}
                {b.ctaLabel && (
                  <Button
                    asChild
                    size="lg"
                    className="bg-white text-black hover:bg-white/90"
                  >
                    <Link href={b.ctaHref || "/catalog"}>{b.ctaLabel}</Link>
                  </Button>
                )}
              </div>

              <div className="order-first relative mx-auto aspect-square w-full max-w-140 mask-[radial-gradient(ellipse_70%_68%_at_50%_50%,#000_55%,transparent_78%)] md:order-2">
                {b.imageUrl && (
                  <Image
                    src={b.imageUrl}
                    alt={b.title}
                    fill
                    priority={i === 0}
                    sizes="(max-width: 768px) 100vw, 560px"
                    className="object-contain"
                  />
                )}
              </div>
            </div>
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
