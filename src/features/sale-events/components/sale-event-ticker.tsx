"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  SALE_EVENT_TICKER_DEFAULT,
  type SaleEventTickerTheme,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { timerParts } from "../lib";

/**
 * Сайтын хамгийн дээд талын гүйдэг зурвас — явж буй арга хэмжээг
 * «BLACK FRIDAY ~30%  ДУУСАХАД 2 ӨДӨР 04:31:10» гэж зарлана (тоолуур
 * секунд тутам гүйнэ). Каталогийн доторх
 * зурвасыг орлосон (клиент, 2026-11-15). Дарвал тухайн арга хэмжээний
 * каталог руу.
 *
 * Хоёр хэсэг: `TickerSegment` — зөвхөн төрх (админы студийн харагдац ч
 * үүгээр зурна, төрх зөрөхгүй); `SaleEventTicker` — дэлгүүрийн live хувилбар.
 */

/**
 * Зурвасны суурь: цул зөөлөн хөх (`--announce`, gradient-гүй), нарийссан тод
 * том үсэг (Oswald) зурвасыг бүхэлд нь дүүргэнэ. Тусгаарлагч, дүрс байхгүй —
 * хэсгүүд нь өнгөөрөө (цагаан ↔ navy) ялгарна.
 */
export const TICKER_BAR =
  "bg-announce text-announce-foreground font-condensed flex h-8 items-center overflow-hidden text-base leading-none font-semibold tracking-wide uppercase sm:h-9 sm:text-lg";

/**
 * Нэг арга хэмжээ: «BLACK FRIDAY ~30%» (цагаан) «ДУУСАХАД 6 ӨДӨР 07:25:05»
 * (navy). Тоолуургүй бол `accent` нь гарчгийг navy болгож хэсэг бүр ээлжилнэ.
 */
export function TickerSegment({
  title,
  countdown,
  accent = false,
  className,
}: {
  title: React.ReactNode;
  /** Тоолуурын хэсэг — `TickerTimer` эсвэл (студид) асаах/унтраах товч. */
  countdown?: React.ReactNode;
  /** Гарчгийг navy өнгөөр (тоолуургүй үед ээлжлэхэд). */
  accent?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-x-4 pr-4 whitespace-nowrap",
        className,
      )}
    >
      <span className={cn(accent && "text-announce-accent")}>{title}</span>
      {countdown && <span className="text-announce-accent">{countdown}</span>}
    </span>
  );
}

/**
 * «ДУУСАХАД 6 ӨДӨР 07:25:05». Oswald-д тэнцүү өргөнтэй цифр (`tnum`) байхгүй
 * — «1» нарийн, «0» өргөн тул секунд солигдох бүрт зурвас савладаг байв.
 * Цифр бүр тогтмол өргөнтэй хайрцагт (`Digits`).
 */
export function TickerTimer({ ms }: { ms: number }) {
  const t = timerParts(ms);
  if (!t) return null;
  const days = t.days > 0 ? `${t.days} өдөр ` : "";
  return (
    <span>
      <span className="sr-only">{`Дуусахад ${days}${t.hh}:${t.mm}:${t.ss}`}</span>
      <span aria-hidden>
        Дуусахад{" "}
        {t.days > 0 && (
          <>
            <Digits value={String(t.days)} /> өдөр{" "}
          </>
        )}
        <Digits value={`${t.hh}:${t.mm}:${t.ss}`} />
      </span>
    </span>
  );
}

/** Цифр бүр ижил өргөн (`0.56em` — Oswald-ийн хамгийн өргөн цифрт багтана), «:» нарийн. */
function Digits({ value }: { value: string }) {
  return (
    <>
      {[...value].map((c, i) => (
        <span
          key={i}
          className={cn(
            "inline-block text-center",
            c === ":" ? "w-[0.28em]" : "w-[0.56em]",
          )}
        >
          {c}
        </span>
      ))}
    </>
  );
}

export interface TickerEvent {
  slug: string;
  name: string;
  headline: string | null;
  endsAt: string;
  showCountdown: boolean;
  /** Зурвасын өнгө (0187); null → өгөгдмөл. */
  tickerTheme: SaleEventTickerTheme | null;
}

/** Нэг хагаст хамгийн багадаа ийм тооны хэсэг — өргөн дэлгэцийг дүүргэнэ. */
const MIN_SEGMENTS = 6;
const SECONDS_PER_SEGMENT = 10;

/**
 * Дэлгүүрийн live зурвас. Тоолуур нь hydration зөрөхгүйн тулд mount-ийн
 * дараа гарч, секунд тутам шинэчлэгдэнэ; аль нэг арга хэмжээ дуусахад хуудсыг серверээс шинэчилнэ
 * (layout дахин уншиж, зурвас алга болно). `prefers-reduced-motion` үед
 * хөдлөхгүй (globals.css). Хулгана эсвэл гарын фокус дээр нь байхад зогсоно
 * (WCAG 2.2.2).
 */
export function SaleEventTicker({ events }: { events: TickerEvent[] }) {
  const router = useRouter();
  const [now, setNow] = React.useState<number | null>(null);

  React.useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const anyEnded =
    now != null && events.some((e) => Date.parse(e.endsAt) <= now);
  React.useEffect(() => {
    if (anyEnded) router.refresh();
  }, [anyEnded, router]);

  // Дууссаныг шууд нууна — серверийн жагсаалт (кэш) хоцорсон ч, клиентийн
  // цаг түрүүлсэн ч хугацаагүй «үхсэн» зурвас үлдэхгүй.
  const active =
    now == null ? events : events.filter((e) => Date.parse(e.endsAt) > now);
  if (active.length === 0) return null;

  const segments = active.map((e) => ({
    slug: e.slug,
    theme: e.tickerTheme ?? SALE_EVENT_TICKER_DEFAULT,
    title: e.headline?.trim() || e.name,
    remaining:
      e.showCountdown && now != null ? Date.parse(e.endsAt) - now : null,
  }));
  // Хагас бүр ижил (keyframe нь -50% шилждэг) — хангалттай урт болтол давтана.
  // Тэгш тоо — тоолуургүй үед өнгө ээлжилдэг тул залгаас дээр ижил өнгө
  // зэрэгцэхгүй.
  let repeat = Math.max(1, Math.ceil(MIN_SEGMENTS / segments.length));
  if ((repeat * segments.length) % 2 === 1) repeat += 1;
  const half = Array.from({ length: repeat }, () => segments).flat();
  const loop = [...half, ...half];

  return (
    <div
      role="region"
      aria-label="Урамшуулал"
      // Суурь нь эхний арга хэмжээний өнгө; хэсэг бүр өөрийнхөөрөө (олон
      // арга хэмжээ өөр өнгөтэй бол блокоор ээлжилнэ).
      data-ticker={segments[0].theme}
      // Хөдөлгөөн багасгасан үед: зогсонги, давталтгүй, олон арга хэмжээ бол
      // хажуу тийш гүйлгэнэ.
      className={cn(
        TICKER_BAR,
        "group motion-reduce:overflow-x-auto motion-reduce:**:data-copy:hidden",
      )}
    >
      <div
        className="animate-marquee group-focus-within:paused group-hover:paused flex h-full w-max"
        style={{ animationDuration: `${half.length * SECONDS_PER_SEGMENT}s` }}
      >
        {loop.map((s, i) => {
          // Эхний давталт л дэлгэц уншигч, Tab-д харагдана.
          const hidden = i >= segments.length;
          return (
            <Link
              key={i}
              href={`/catalog?event=${encodeURIComponent(s.slug)}`}
              aria-hidden={hidden || undefined}
              tabIndex={hidden ? -1 : undefined}
              // Хөдөлгөөн багасгасан үед давталт нуугдана (доорх класс).
              data-copy={hidden || undefined}
              data-ticker={s.theme}
              className="bg-announce text-announce-foreground focus-visible:outline-announce-foreground flex h-full items-center pl-4 hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:-outline-offset-2"
            >
              <TickerSegment
                title={s.title}
                accent={s.remaining == null && i % 2 === 1}
                countdown={
                  s.remaining != null && s.remaining > 0 ? (
                    <TickerTimer ms={s.remaining} />
                  ) : null
                }
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
