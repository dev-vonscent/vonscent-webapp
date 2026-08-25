"use client";

import * as React from "react";
import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/thumbnails.css";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import type { ProductImage } from "@/lib/types";

/** Auto-advance interval — client asked for a 3-5s rotation. */
const AUTOPLAY_MS = 4000;

/**
 * Product gallery on one Embla instance for every breakpoint: full-bleed
 * swipe carousel on mobile (dots), framed carousel + thumbnail strip on
 * desktop. Tapping an image opens a zoomable lightbox (roadmap Phase 2).
 */
export function ProductGallery({
  images,
  name,
}: {
  images: ProductImage[];
  name: string;
}) {
  const many = images.length > 1;
  const reducedMotion = usePrefersReducedMotion();
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: many, watchDrag: many },
    many && !reducedMotion
      ? [Autoplay({ delay: AUTOPLAY_MS, stopOnInteraction: true })]
      : [],
  );
  const [active, setActive] = React.useState(0);
  const [lightboxAt, setLightboxAt] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setActive(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  // Any deliberate pick stops autoplay for good so we never yank the image
  // out from under someone who is looking at a specific shot.
  function pick(i: number) {
    emblaApi?.plugins().autoplay?.stop();
    emblaApi?.scrollTo(i);
  }

  function openLightbox(i: number) {
    emblaApi?.plugins().autoplay?.stop();
    setLightboxAt(i);
  }

  if (images.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {/* Mobile: full-bleed under the transparent header (-mx-4 cancels the
          page's px-4; -mt-20 = h-16 header + py-4 wrapper). Desktop: framed. */}
      <div className="relative -mx-4 -mt-20 sm:mx-0 sm:mt-0">
        <div
          ref={emblaRef}
          className="sm:border-border sm:bg-muted sm:shadow-soft overflow-hidden sm:rounded-2xl sm:border"
        >
          <div className="flex">
            {images.map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={() => openLightbox(i)}
                aria-label={`${name} — зураг ${i + 1} томруулах`}
                className="bg-muted relative aspect-4/5 min-w-0 flex-[0_0_100%] cursor-zoom-in sm:aspect-square"
              >
                <Image
                  src={img.url}
                  alt={img.alt || `${name} ${i + 1}`}
                  fill
                  priority={i === 0}
                  sizes="(max-width: 1024px) 100vw, (max-width: 1408px) 50vw, 652px"
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        </div>

        {many && (
          <div className="bg-secondary/70 absolute bottom-14 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full px-2.5 py-1.5 backdrop-blur sm:hidden">
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

      {/* Desktop thumbnail strip */}
      {many && (
        <div className="no-scrollbar mt-0 hidden gap-3 overflow-x-auto p-0.5 sm:flex">
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

      <Lightbox
        open={lightboxAt !== null}
        close={() => setLightboxAt(null)}
        index={lightboxAt ?? 0}
        slides={images.map((img, i) => ({
          src: img.url,
          alt: img.alt || `${name} ${i + 1}`,
        }))}
        plugins={many ? [Zoom, Thumbnails] : [Zoom]}
        carousel={{ finite: !many }}
        render={
          many
            ? undefined
            : { buttonPrev: () => null, buttonNext: () => null }
        }
        zoom={{ maxZoomPixelRatio: 3 }}
      />
    </div>
  );
}
