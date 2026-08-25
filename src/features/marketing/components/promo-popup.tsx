"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight, Copy, Check } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import type { PopupSettings, PopupSlide } from "@/features/content/api";

const STORAGE_KEY = "vonscent-popup-dismissed";
/** Per-tab flag: the popup is shown at most once per visit to the site. */
const SESSION_KEY = "vonscent-popup-seen";
const AUTOPLAY_MS = 5000;

/** True when `now` falls within the slide's optional [startsAt, endsAt] window. */
function isLive(slide: PopupSlide, now: number): boolean {
  if (slide.startsAt && now < new Date(slide.startsAt).getTime()) return false;
  if (slide.endsAt && now > new Date(slide.endsAt).getTime()) return false;
  return true;
}

/**
 * A coupon rendered as a dashed-border ticket with a copy button — the admin
 * only types the code; the presentation lives in code (questions.md №12).
 */
function CouponCode({ code }: { code: string }) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (e.g. non-secure context) — the code stays visible
      // to copy by hand.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`${code} купон хуулах`}
      className="border-primary/60 bg-secondary/60 hover:bg-secondary mx-auto flex items-center gap-3 rounded-lg border-2 border-dashed px-5 py-2.5 transition-colors"
    >
      <span className="font-mono text-lg font-semibold tracking-widest">
        {code}
      </span>
      {copied ? (
        <span className="text-success flex items-center gap-1 text-xs">
          <Check className="size-3.5" /> Хуулагдлаа
        </span>
      ) : (
        <span className="text-muted-foreground flex items-center gap-1 text-xs">
          <Copy className="size-3.5" /> Хуулах
        </span>
      )}
    </button>
  );
}

/**
 * Marketing popup carousel (admin A8). Shows scheduled slides once per
 * `frequencyHours` window. Auto-advances; pauses on manual swipe/drag, then
 * resumes. Closable.
 */
export function PromoPopup({ settings }: { settings: PopupSettings }) {
  const [open, setOpen] = React.useState(false);
  const [index, setIndex] = React.useState(0);
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

  // Filter to slides whose schedule is live now, then decide whether to show.
  React.useEffect(() => {
    const now = Date.now();
    const live = (settings.slides ?? []).filter(
      (s) => s.title && isLive(s, now),
    );
    setSlides(live);
    if (!settings.enabled || live.length === 0) return;
    // Two gates: the admin's frequency window across visits, and a per-tab flag
    // so navigating back to Home doesn't re-open it (requirement_fb.md §1 —
    // "Home руу буцах бүрд гарч ирдгийг болиулах"). The session flag is set as
    // soon as it opens, not only when dismissed, so leaving the page mid-popup
    // still counts as "seen".
    if (sessionStorage.getItem(SESSION_KEY)) return;
    const last = Number(localStorage.getItem(STORAGE_KEY) ?? 0);
    if ((now - last) / 36e5 < settings.frequencyHours) return;
    const t = setTimeout(() => {
      sessionStorage.setItem(SESSION_KEY, "1");
      setOpen(true);
    }, 1200);
    return () => clearTimeout(t);
  }, [settings.enabled, settings.frequencyHours, settings.slides]);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setOpen(false);
  }
  function go(dir: number) {
    emblaApi?.plugins().autoplay?.stop();
    if (dir > 0) emblaApi?.scrollNext();
    else emblaApi?.scrollPrev();
  }

  if (!open || slides.length === 0) return null;

  return (
    <div
      className="bg-foreground/40 fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={dismiss}
    >
      <div
        className="bg-card relative w-full max-w-md overflow-hidden rounded-xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={dismiss}
          aria-label="Хаах"
          className="bg-background/70 text-muted-foreground hover:bg-accent absolute top-3 right-3 z-10 rounded-md p-1"
        >
          <X className="size-4" />
        </button>

        <div ref={emblaRef} className="overflow-hidden">
          <div className="flex items-start">
            {slides.map((slide, i) => (
              <div key={i} className="min-w-0 flex-[0_0_100%]">
                {slide.imageUrl && (
                  <div className="bg-secondary relative aspect-16/10 w-full">
                    <Image
                      src={slide.imageUrl}
                      alt={slide.title}
                      fill
                      sizes="448px"
                      className="object-cover"
                    />
                  </div>
                )}

                <div className="space-y-3 p-8 text-center">
                  <h2 className="font-serif text-2xl font-semibold">
                    {slide.title}
                  </h2>
                  {slide.body && (
                    <p className="text-muted-foreground text-sm">
                      {slide.body}
                    </p>
                  )}
                  {slide.couponCode && <CouponCode code={slide.couponCode} />}
                  {slide.ctaLabel && (
                    <Button asChild className="mt-2" onClick={dismiss}>
                      <Link href={slide.ctaHref || "/catalog"}>
                        {slide.ctaLabel}
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {slides.length > 1 && (
          <>
            <button
              onClick={() => go(-1)}
              aria-label="Өмнөх"
              className="bg-background/70 hover:bg-accent absolute top-1/2 left-2 -translate-y-1/2 rounded-full p-1.5"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              onClick={() => go(1)}
              aria-label="Дараах"
              className="bg-background/70 hover:bg-accent absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1.5"
            >
              <ChevronRight className="size-4" />
            </button>
            <div className="flex justify-center gap-1.5 pb-4">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    emblaApi?.plugins().autoplay?.stop();
                    emblaApi?.scrollTo(i);
                  }}
                  aria-label={`${i + 1}`}
                  className={cn(
                    "size-1.5 rounded-full transition-colors",
                    i === index ? "bg-primary" : "bg-border",
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
