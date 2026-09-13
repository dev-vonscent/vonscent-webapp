"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Brand name → logo path, from the `brands` table (0050). Logos are dark
 * artwork on transparent; the `.brand-logo` class (globals.css) inverts them
 * to white on the black theme and leaves them dark on the light ones. A brand
 * with no logo yet falls back to a styled wordmark, which for a typographic
 * house reads as a deliberate choice rather than a hole.
 *
 * This used to be a hard-coded map here. It moved into the database so the
 * admin can add a brand and its logo without a deploy — the Брэнд page and the
 * product form's picker read the same rows.
 */
export type BrandLogos = Record<string, string | null>;

/**
 * Brand wall — two rows of brand logos scrolling in opposite directions.
 * Pure CSS marquee (uses the `animate-marquee` keyframe from globals.css, which
 * translates the track by -50%, so the track holds two identical halves).
 */
function BrandLink({
  brand,
  logos,
  hidden,
}: {
  brand: string;
  logos: BrandLogos;
  /** Duplicate copies inside the marquee loop stay out of the a11y tree. */
  hidden?: boolean;
}) {
  const logo = logos[brand];
  return (
    <Link
      href={`/catalog?brand=${encodeURIComponent(brand)}`}
      aria-hidden={hidden}
      tabIndex={hidden ? -1 : 0}
      aria-label={brand}
      className="flex h-14 shrink-0 items-center justify-center opacity-70 transition-opacity hover:opacity-100"
    >
      {logo ? (
        // A 5:1 box suits a long wordmark and crushes a stacked mark: Chanel
        // (monogram over text) is height-limited and rendered a quarter of the
        // width Burberry gets. A squarer box splits the difference — stacked
        // marks grow, wordmarks give up a little length.
        <span className="relative h-10 w-32 sm:h-12 sm:w-40">
          <Image
            src={logo}
            alt={brand}
            fill
            unoptimized
            sizes="160px"
            // Lazy loading is wrong for a track that scrolls itself. The
            // browser only fetches an image once it intersects the viewport,
            // and everything past the visible window is clipped by the
            // `overflow-hidden` wrapper — so a logo started downloading at the
            // moment the animation carried it into view and blinked in
            // half-way across. The wall shows every brand within one cycle, so
            // all of them are needed as soon as the section is on screen.
            loading="eager"
            className="brand-logo object-contain"
          />
        </span>
      ) : (
        // Sized to sit *with* the logos rather than shout over them: at the
        // old size a long name like Maison Francis Kurkdjian was the loudest
        // thing in a row of real wordmarks.
        <span className="font-serif text-base font-semibold tracking-[0.18em] whitespace-nowrap uppercase sm:text-lg">
          {brand}
        </span>
      )}
    </Link>
  );
}

/**
 * Seconds each logo should take to travel its own width.
 *
 * The animation moves the track by -50%, i.e. by one half's width, so a fixed
 * duration means the scroll gets *faster* every time a brand is added — the
 * same 28s spread over a wider track. That is what happened when the catalogue
 * went from ten brands to thirty-two. Deriving the duration from the item
 * count instead pins the actual pixels-per-second, so the wall reads at the
 * same pace whether the shop sells five houses or fifty.
 */
const SECONDS_PER_LOGO = 4;

/**
 * Гүйлгэх мөр. Мөр бүр өөрөө хэвтээ scroll-той — гараараа гүйлгэж бүх брэндийг
 * үзэх боломжтой (утсан дээр анимацийг хүлээх шаардлагагүй). Хүрч/хулганаар
 * барьж байх үед `paused` — салангуут дахин урсана.
 */
function Track({
  items,
  logos,
  reverse,
  paused,
  onScroll,
}: {
  items: string[];
  logos: BrandLogos;
  reverse?: boolean;
  paused: boolean;
  onScroll: () => void;
}) {
  // 2× the items per half guarantees the half is wider than the viewport, and
  // the half is duplicated so -50% loops seamlessly.
  const half = [...items, ...items];
  const loop = [...half, ...half];
  return (
    <div
      onScroll={onScroll}
      // Гүйлгэх мөрийн scrollbar нь өөрөө чимэглэл болж хардаг тул энэ бол
      // `no-scrollbar`-ын зөвшөөрөгдсөн ховор тохиолдол (design.md §6.1).
      // `touch-action`-ыг хөндөхгүй: `pan-x` бол мөрөн дээрээс эхэлсэн босоо
      // гүйлт (хуудас өөрөө) хаагдана.
      className="no-scrollbar overflow-x-auto overscroll-x-contain"
    >
      <div
        className={cn(
          "animate-marquee flex w-max items-center gap-10 pr-10",
          paused && "paused",
          reverse && "direction-[reverse]",
        )}
        style={{ animationDuration: `${half.length * SECONDS_PER_LOGO}s` }}
      >
        {loop.map((b, i) => (
          <BrandLink key={i} brand={b} logos={logos} hidden={i >= half.length} />
        ))}
      </div>
    </div>
  );
}

/** Хүрэлт/гүйлгэлт зогссоны дараа анимац эргэж асах хүлээлт. */
const RESUME_AFTER_TOUCH_MS = 800;
const RESUME_AFTER_SCROLL_MS = 1500;

/**
 * «Барьж байвал зогс, тавихаар дахин урс» төлөв.
 *
 * Зөвхөн hover дээр түшиглэсэн CSS шийдэл утсан дээр ажиллахгүй: хуруу
 * хүрэхэд hover тогтож үлдэх ба мөр мөнхөд зогсдог. Тиймээс pointer/scroll
 * эвентээр зогсоож, тодорхой хугацааны дараа өөрөө сэргэнэ.
 */
function usePauseWhileTouched() {
  const [paused, setPaused] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  React.useEffect(() => clear, []);

  const pause = React.useCallback(() => {
    clear();
    setPaused(true);
  }, []);
  const resume = React.useCallback((delay = 0) => {
    clear();
    if (delay === 0) return setPaused(false);
    timer.current = setTimeout(() => setPaused(false), delay);
  }, []);

  return {
    paused,
    handlers: {
      // Хулгана: орохоор зогсоож, гарахаар шууд сэргээнэ.
      onPointerEnter: (e: React.PointerEvent) => {
        if (e.pointerType === "mouse") pause();
      },
      onPointerLeave: (e: React.PointerEvent) => {
        if (e.pointerType === "mouse") resume();
      },
      // Хүрэлт: дарж барих үед зогсоно, тавихад хэсэг хүлээгээд сэргэнэ.
      // Хулганы товшилт үүнд орохгүй: заагч нь мөрөн дээр байсаар байтал
      // дахин урсаж эхэлбэл дарах гэсэн лого нь оргоно — хулгана гартал
      // (`onPointerLeave`) зогссон хэвээр.
      onPointerDown: pause,
      onPointerUp: (e: React.PointerEvent) => {
        if (e.pointerType !== "mouse") resume(RESUME_AFTER_TOUCH_MS);
      },
      onPointerCancel: (e: React.PointerEvent) => {
        if (e.pointerType !== "mouse") resume(RESUME_AFTER_TOUCH_MS);
      },
      // Гарын товчоор дамжсан фокус — салангуут сэргэнэ.
      onFocusCapture: pause,
      onBlurCapture: () => resume(RESUME_AFTER_TOUCH_MS),
    },
    // Momentum scroll хуруу тавьсны дараа ч үргэлжилдэг тул тусдаа, уртавтар
    // хүлээлттэй: гүйлт бүрэн зогсмогц л анимац эргэж асна.
    onScroll: () => {
      pause();
      resume(RESUME_AFTER_SCROLL_MS);
    },
  };
}

export function BrandMarquee({
  brands,
  logos,
}: {
  brands: string[];
  logos: BrandLogos;
}) {
  const { paused, handlers, onScroll } = usePauseWhileTouched();
  if (brands.length === 0) return null;
  // A marquee of three logos loops awkwardly — a small catalogue gets a plain
  // centered row instead (5d).
  if (brands.length < 5) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
        {brands.map((b) => (
          <BrandLink key={b} brand={b} logos={logos} />
        ))}
      </div>
    );
  }
  const mid = Math.ceil(brands.length / 2);
  const row1 = brands.slice(0, mid);
  const row2 = brands.slice(mid);
  return (
    <div
      {...handlers}
      // `overflow-hidden` байхгүй: мөр бүр өөрийн хэвтээ scroll-той, тайралтыг
      // mask нь хийнэ.
      className="relative space-y-6"
      style={{
        maskImage:
          "linear-gradient(to right, transparent, #000 8%, #000 92%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent, #000 8%, #000 92%, transparent)",
      }}
    >
      <Track items={row1} logos={logos} paused={paused} onScroll={onScroll} />
      <Track
        items={row2.length ? row2 : row1}
        logos={logos}
        reverse
        paused={paused}
        onScroll={onScroll}
      />
    </div>
  );
}
