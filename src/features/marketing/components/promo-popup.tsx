"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import type { PopupSettings, PopupSlide } from "@/features/content/api";

const AUTOPLAY_MS = 5000;
/** Хуудас зурагдаж амжсаны дараа гарна — дээрээс нь шууд унахгүй. */
const OPEN_DELAY_MS = 800;

/**
 * Нэг document-д ганц удаа. Модулийн хувьсагч нь client navigation-ы үед
 * (нүүр → бараа → буцах) хадгалагдана, харин F5/шинэ таб дээр шинээр
 * ачаалагдаж false болно — яг «зөвхөн reload дээр» гэсэн хүсэлт.
 * sessionStorage тохирохгүй: тэр reload-ыг давж үлдэнэ.
 */
let shownForThisDocument = false;

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
 * холбоостой бол дарахад тийшээ очно. Зөвхөн нүүр хуудсанд, хуудас бүтнээрээ
 * ачаалагдах бүрд (эхний нээлт, refresh) нэг л удаа гарна — сайт дотор
 * навигаци хийгээд нүүр рүү буцахад дахин гарахгүй. Олон слайд бол
 * автоматаар шилжинэ, сум/свайпаар гараар солино; гараар хөдөлгөсний дараа
 * автомат зогсоно.
 *
 * Radix Dialog дээр суурилсан: Escape, гадна дарах, focus trap, scroll lock,
 * дэлгэц уншигчийн `role=dialog` бүгд бэлэн ирнэ.
 */
export function PromoPopup({ settings }: { settings: PopupSettings }) {
  const [open, setOpen] = React.useState(false);
  const [index, setIndex] = React.useState(0);
  // Автомат шилжилт ажиллаж байгаа эсэх — WCAG 2.2.2 нь 5 секундээс урт
  // автоматаар хөдөлдөг агуулгад ЗОГСООХ арга шаарддаг.
  const [playing, setPlaying] = React.useState(true);
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
    if (shownForThisDocument) return;
    const t = setTimeout(() => {
      shownForThisDocument = true;
      setOpen(true);
    }, OPEN_DELAY_MS);
    return () => clearTimeout(t);
  }, [settings.enabled, settings.slides]);

  function stopAutoplay() {
    emblaApi?.plugins().autoplay?.stop();
    setPlaying(false);
  }

  function go(dir: number) {
    stopAutoplay();
    if (dir > 0) emblaApi?.scrollNext();
    else emblaApi?.scrollPrev();
  }

  function togglePlay() {
    const autoplay = emblaApi?.plugins().autoplay;
    if (!autoplay) return;
    if (playing) autoplay.stop();
    else autoplay.play();
    setPlaying(!playing);
  }

  if (slides.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        aria-describedby={undefined}
        // Зөвхөн зураг харагдана: хүрээ/дэвсгэр/сүүдэргүй, зурагны өөрийн
        // харьцаагаар агшина (letterbox үүсэхгүй).
        className="w-auto max-w-[min(100vw_-_2rem,32rem)] gap-0 border-0 bg-transparent p-0 shadow-none"
      >
        <DialogTitle className="sr-only">Сурталчилгаа</DialogTitle>

        {/* `aria-roledescription="carousel"` нь дэлгэц уншигчид энэ бүлэг
            нь эргэлддэг гэдгийг хэлнэ; слайд бүр «N / M» гэсэн нэртэй.
            Өмнө нь цэгүүд нь `role="tablist"`/`role="tab"` байсан нь буруу
            байв — tab нь `tabpanel` шаарддаг бөгөөд энд тийм зүйл байхгүй. */}
        <div
          ref={emblaRef}
          className="overflow-hidden rounded-2xl"
          role="group"
          aria-roledescription="carousel"
          aria-label="Сурталчилгааны зарууд"
        >
          <div className="flex items-start">
            {slides.map((slide, i) => (
              <div
                key={`${slide.imageUrl}-${i}`}
                className="min-w-0 flex-[0_0_100%]"
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} / ${slides.length}`}
                // Харагдахгүй байгаа слайдууд нь DOM-д үлддэг тул дэлгэц
                // уншигч тэднийг ч уншиж, Tab нь тэдний холбоос дээр
                // очдог байв — хэрэглэгч «алга болсон» товч дээр гацна.
                aria-hidden={i !== index}
              >
                <SlideImage
                  slide={slide}
                  eager={i === 0}
                  focusable={i === index}
                  onNavigate={() => setOpen(false)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Слайд солигдохыг чимээгүй зарлана. `aria-live` нь ЗААВАЛ DOM-д
            урьдчилан байх ёстой — агуулгатай нь хамт нэмэгдвэл уншигдахгүй. */}
        <div aria-live="polite" aria-atomic className="sr-only">
          {many ? `${index + 1} / ${slides.length} зар` : ""}
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
            <div className="bg-background/70 absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full px-2.5 py-1.5 backdrop-blur">
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`${i + 1}-р зар руу очих`}
                  aria-current={i === index ? "true" : undefined}
                  onClick={() => {
                    stopAutoplay();
                    emblaApi?.scrollTo(i);
                  }}
                  className={cn(
                    // Товшилтын талбай нь хараагдах цэгээсээ том: 6px өндөр
                    // зорилт нь гар чичирдэг хүнд бараг боломжгүй.
                    "flex h-6 items-center px-0.5",
                    "after:block after:h-1.5 after:rounded-full after:transition-all",
                    i === index
                      ? "after:bg-foreground after:w-4"
                      : "after:bg-foreground/35 after:w-1.5",
                  )}
                />
              ))}
              {/* Автомат шилжилтийг зогсоох арга (WCAG 2.2.2). Сум/свайп нь
                  ч зогсоодог ч тэр нь «зогсоох» гэж нэрлэгдээгүй байв. */}
              {!reducedMotion && (
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={
                    playing
                      ? "Автомат шилжилтийг зогсоох"
                      : "Автомат шилжилтийг үргэлжлүүлэх"
                  }
                  className="text-foreground/70 hover:text-foreground ml-1 flex size-6 items-center justify-center"
                >
                  {playing ? (
                    <Pause className="size-3" />
                  ) : (
                    <Play className="size-3" />
                  )}
                </button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Зураг өөрийн харьцаагаараа, тайрахгүй — админ ямар ч хэмжээтэй зураг
 * оруулж болно. Хэт өндөр зураг дэлгэцээс хэтрэхгүйн тулд 85svh-д хашина.
 */
function SlideImage({
  slide,
  eager,
  focusable,
  onNavigate,
}: {
  slide: PopupSlide;
  eager: boolean;
  /** Идэвхтэй слайд эсэх — идэвхгүй слайдын холбоос Tab-д орохгүй. */
  focusable: boolean;
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
      className="mx-auto block h-auto max-h-[85svh] w-auto max-w-full"
      // Свайп хийхэд браузарын зураг чирэх үйлдэл саад болдог.
      draggable={false}
    />
  );
  if (!slide.href) return img;
  return (
    <Link
      href={slide.href}
      onClick={onNavigate}
      tabIndex={focusable ? undefined : -1}
      // `focus-visible:outline-none` байсан нь гарнаас ажилладаг хүнд
      // холбоос нь фокуслагдсаныг харуулахгүй болгож байв.
      className="block"
      aria-label="Зар үзэх"
    >
      {img}
    </Link>
  );
}
