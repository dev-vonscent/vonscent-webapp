"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import type { PopupSettings, PopupSlide } from "@/features/content/api";

const AUTOPLAY_MS = 5000;
/** Хуудас зурагдаж амжсаны дараа гарна — дээрээс нь шууд унахгүй. */
const OPEN_DELAY_MS = 800;

/** True when `now` falls within the slide's optional [startsAt, endsAt] window. */
function isLive(slide: PopupSlide, now: number): boolean {
  if (slide.startsAt && now < new Date(slide.startsAt).getTime()) return false;
  if (slide.endsAt && now > new Date(slide.endsAt).getTime()) return false;
  return true;
}

/**
 * Сурталчилгааны popup (backlog G1–G3).
 *
 * Зөвхөн зураг: гарчиг, текст, товч, купон байхгүй — зураг нь өөрөө зар,
 * холбоостой бол дарахад тийшээ очно. Зөвхөн нүүр хуудсанд, нүүр нээгдэх
 * бүрд (refresh, буцаж ирэх) гарна; «нэг session-д нэг удаа», «хэдэн цаг
 * тутамд» гэсэн хязгаарлалт байхгүй тул юу ч хадгалахгүй. Олон слайд бол
 * автоматаар шилжинэ, сум/свайпаар гараар солино; гараар хөдөлгөсний дараа
 * автомат зогсоно.
 *
 * Radix Dialog дээр суурилсан: Escape, гадна дарах, focus trap, scroll lock,
 * дэлгэц уншигчийн `role=dialog` бүгд бэлэн ирнэ.
 */
export function PromoPopup({ settings }: { settings: PopupSettings }) {
  const [open, setOpen] = React.useState(false);
  const [index, setIndex] = React.useState(0);
  // Хуваарь нь браузарын цагаар шийдэгдэнэ — серверийн ISR кэш хуучин
  // байсан ч дууссан зар үзэгдэхгүй.
  const [slides, setSlides] = React.useState<PopupSlide[]>([]);
  const many = slides.length > 1;
  const reducedMotion = usePrefersReducedMotion();
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: many, watchDrag: many },
    many && !reducedMotion
      ? [Autoplay({ delay: AUTOPLAY_MS, stopOnInteraction: true })]
      : [],
  );

  React.useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  React.useEffect(() => {
    const now = Date.now();
    const live = (settings.slides ?? []).filter(
      (s) => Boolean(s.imageUrl) && isLive(s, now),
    );
    setSlides(live);
    if (!settings.enabled || live.length === 0) return;
    const t = setTimeout(() => setOpen(true), OPEN_DELAY_MS);
    return () => clearTimeout(t);
  }, [settings.enabled, settings.slides]);

  function go(dir: number) {
    emblaApi?.plugins().autoplay?.stop();
    if (dir > 0) emblaApi?.scrollNext();
    else emblaApi?.scrollPrev();
  }

  if (slides.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        aria-describedby={undefined}
        className="max-w-lg gap-0 overflow-hidden p-0"
      >
        <DialogTitle className="sr-only">Сурталчилгаа</DialogTitle>

        <div ref={emblaRef} className="overflow-hidden">
          <div className="flex items-start">
            {slides.map((slide, i) => (
              <div
                key={`${slide.imageUrl}-${i}`}
                className="min-w-0 flex-[0_0_100%]"
              >
                <SlideImage
                  slide={slide}
                  eager={i === 0}
                  onNavigate={() => setOpen(false)}
                />
              </div>
            ))}
          </div>
        </div>

        {many && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Өмнөх зар"
              className="bg-background/70 text-foreground hover:bg-background absolute top-1/2 left-2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full backdrop-blur transition-colors"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Дараах зар"
              className="bg-background/70 text-foreground hover:bg-background absolute top-1/2 right-2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full backdrop-blur transition-colors"
            >
              <ChevronRight className="size-4" />
            </button>
            <div
              role="tablist"
              aria-label="Зарууд"
              className="bg-background/70 absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full px-2.5 py-1.5 backdrop-blur"
            >
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`${i + 1}-р зар`}
                  onClick={() => {
                    emblaApi?.plugins().autoplay?.stop();
                    emblaApi?.scrollTo(i);
                  }}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === index
                      ? "bg-foreground w-4"
                      : "bg-foreground/35 w-1.5",
                  )}
                />
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Зураг өөрийн харьцаагаараа, тайрахгүй — админ ямар ч хэмжээтэй зураг
 * оруулж болно. Хэт өндөр зураг дэлгэцээс хэтрэхгүйн тулд 80vh-д хашина.
 */
function SlideImage({
  slide,
  eager,
  onNavigate,
}: {
  slide: PopupSlide;
  eager: boolean;
  onNavigate: () => void;
}) {
  const img = (
    <Image
      src={slide.imageUrl!}
      // Зар нь зураг дотроо — админ alt бичдэггүй, ерөнхий тайлбар хангалттай.
      alt="Сурталчилгаа"
      width={1080}
      height={1350}
      sizes="(max-width: 544px) calc(100vw - 2rem), 512px"
      loading={eager ? "eager" : "lazy"}
      className="bg-secondary h-auto max-h-[80vh] w-full object-contain"
      // Свайп хийхэд браузарын зураг чирэх үйлдэл саад болдог.
      draggable={false}
    />
  );
  if (!slide.href) return img;
  return (
    <Link
      href={slide.href}
      onClick={onNavigate}
      className="block focus-visible:outline-none"
      aria-label="Зар үзэх"
    >
      {img}
    </Link>
  );
}
