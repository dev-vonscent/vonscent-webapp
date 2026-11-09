"use client";

import * as React from "react";
import Image from "next/image";
import { animate, MotionConfig, motion, useReducedMotion } from "motion/react";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SegmentedTabs } from "@/components/shared/segmented-tabs";
import { LEADERBOARD_PERIODS, type LeaderboardPeriod } from "../lib";
import type { Leaderboard, LeaderboardEntry, Leaderboards } from "../types";
import { TierFrame } from "./tier-frame";

function initialOf(name: string | null | undefined) {
  return (name?.trim() || "V").charAt(0).toUpperCase();
}

/**
 * «Top 3 хэрэглэгч» — сүүлийн 7 хоног / 1 сар / бүх цаг үеийн хамгийн их
 * худалдан авалт хийсэн гурав, тухайн хугацааны захиалгын дүнтэй
 * (feature flag `user_tiers`). Нүүр хуудас
 * (хэн ч, `me` байхгүй) ба түвшний хуудсанд (өөрийн байр, зурагтай) ижил.
 */
export function TopCustomers({
  boards,
  myAvatar = null,
  showMe = false,
  headingClassName,
}: {
  boards: Leaderboards;
  /** Нэвтэрсэн хэрэглэгч топод байвал өөрийн зургаар. */
  myAvatar?: string | null;
  /** Топод ороогүй бол «Таны байр #N» мөр. */
  showMe?: boolean;
  headingClassName?: string;
}) {
  const [period, setPeriod] = React.useState<LeaderboardPeriod>("week");
  const board = boards[period];
  const panelRef = React.useRef<HTMLDivElement>(null);
  useStickyMinHeight(panelRef);

  return (
    // Түвшний хуудас (account) shop template-ийн MotionConfig-оос гадуур —
    // motion унтраасан хэрэглэгчид тавцан өсөх хөдөлгөөнийг энд ч унтраана.
    <MotionConfig reducedMotion="user">
      <section className="bg-card relative space-y-6 overflow-hidden rounded-2xl p-5 sm:space-y-8 sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <h2
              className={cn(
                "font-serif text-xl font-semibold tracking-tight",
                headingClassName,
              )}
            >
              Top 3 хэрэглэгч
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Хамгийн их худалдан авалт хийсэн хэрэглэгчид
            </p>
          </div>
          <SegmentedTabs
            label="Хугацаа"
            tabs={LEADERBOARD_PERIODS.map((p) => ({
              value: p.key,
              label: p.label,
            }))}
            value={period}
            onChange={setPeriod}
            className="shrink-0 sm:inline-flex"
          />
        </div>

        {/* Табаас хамаарч өндөр өөр (нэр мөр шилжих, сул байр, мессеж) —
          хуудасны доод хэсэгт байхад агшвал browser scroll-ыг дээш татдаг. */}
        <div ref={panelRef} className="space-y-6 sm:space-y-8">
          {showMe && (
            <p className="text-muted-foreground bg-secondary rounded-xl px-4 py-3 text-center text-sm">
              {board.me ? (
                <>
                  Таны байр{" "}
                  <span className="text-foreground font-semibold">
                    #{board.me.rank}
                  </span>{" "}
                  — шилдэг гуравт ойртож байна!
                </>
              ) : board.top.some((e) => e.isMe) ? (
                "Та шилдэг гуравт байна — байраа хадгалаарай!"
              ) : (
                "Энэ хугацаанд захиалга хийгээд жагсаалтад нэрээ гаргаарай."
              )}
            </p>
          )}

          <Podium key={period} board={board} myAvatar={myAvatar} />
        </div>
      </section>
    </MotionConfig>
  );
}

/**
 * Элементийн өндрийг хэзээ ч багасгахгүй — хамгийн их өндрийг `min-height`
 * болгон барина (өргөн өөрчлөгдвөл дахин хэмжинэ). Таб солиход контент
 * агшиж, хуудасны төгсгөлд scroll дээш үсрэхээс сэргийлнэ. Style-ийг шууд
 * өөрчилнө — re-render хийхгүй.
 */
function useStickyMinHeight(ref: React.RefObject<HTMLElement | null>) {
  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let width = el.offsetWidth;
    let max = 0;
    const observer = new ResizeObserver(() => {
      if (el.offsetWidth !== width) {
        width = el.offsetWidth;
        max = 0;
        el.style.minHeight = "";
      }
      if (el.offsetHeight > max) {
        max = el.offsetHeight;
        el.style.minHeight = `${max}px`;
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
}

/** Тавцангийн дараалал: 2 · 1 · 3 — ялагч голд, хамгийн өндөрт. */
const PODIUM_ORDER = [2, 1, 3] as const;
const PODIUM_HEIGHT: Record<number, string> = {
  1: "h-24 sm:h-32",
  2: "h-16 sm:h-24",
  3: "h-12 sm:h-20",
};

/**
 * Тавцангийн өнгө theme бүрт: гэрэл дээрээс тусна — дээд гадаргуу хамгийн
 * цайвар, урд нүүр бараан. Ирмэг дээр 1px гэрэл (bevel), нийлсэн газарт
 * ambient occlusion сүүдэр, тоо нь сийлсэн мэт (дээр бараан, доор гэгээ).
 * Бүгд цул өнгө + shadow — gradient биш.
 */
const PODIUM_TONES = cn(
  // Бараан theme
  "[--pd-top-1:var(--foreground)] [--pd-edge-1:var(--muted-foreground)]",
  "[--pd-top:var(--muted-foreground)] [--pd-edge:color-mix(in_oklab,var(--muted-foreground)_45%,var(--background))]",
  "[--pd-body-1:var(--accent)] [--pd-body:var(--secondary)]",
  "[--pd-base-top:color-mix(in_oklab,var(--muted-foreground)_40%,var(--background))] [--pd-base-front:var(--muted)]",
  "[--pd-shade:rgb(0_0_0/0.55)] [--pd-glow:var(--foreground)] [--pd-hi:rgb(255_255_255/0.28)]",
  "[--pd-engrave:0_-1px_0_rgb(0_0_0/0.7),0_1px_0_rgb(255_255_255/0.1)]",
  // Цагаан theme
  "in-[.white]:[--pd-top-1:var(--background)] in-[.white]:[--pd-edge-1:color-mix(in_oklab,var(--foreground)_38%,var(--background))]",
  "in-[.white]:[--pd-top:color-mix(in_oklab,var(--foreground)_3%,var(--background))] in-[.white]:[--pd-edge:color-mix(in_oklab,var(--foreground)_28%,var(--background))]",
  "in-[.white]:[--pd-body-1:color-mix(in_oklab,var(--foreground)_10%,var(--background))] in-[.white]:[--pd-body:color-mix(in_oklab,var(--foreground)_7%,var(--background))]",
  "in-[.white]:[--pd-base-top:color-mix(in_oklab,var(--foreground)_6%,var(--background))] in-[.white]:[--pd-base-front:color-mix(in_oklab,var(--foreground)_16%,var(--background))]",
  "in-[.white]:[--pd-shade:rgb(0_0_0/0.16)] in-[.white]:[--pd-glow:transparent] in-[.white]:[--pd-hi:rgb(255_255_255/0.9)]",
  "in-[.white]:[--pd-engrave:0_-1px_0_rgb(0_0_0/0.18),0_1px_0_rgb(255_255_255/0.95)]",
);

/**
 * Тагны дээд гадаргуу — нэг цэгийн perspective (харагч дээрээс). Доор байх
 * тусам дээд гадаргуу нь их харагдана: 1 < 2 < 3 < суурь. Ар ирмэг нь
 * подиумын төв рүү ойртоно — голынх тэгш хэмтэй, 2-р тагны зүүн ирмэг
 * хазайж баруун нь 1-р блокийн ард орно, 3-р нь эсрэгээрээ.
 */
const LID_TOP: Record<number, string> = {
  1: "h-3 sm:h-4 [clip-path:polygon(2.5%_0,97.5%_0,100%_100%,0_100%)]",
  2: "h-3.5 sm:h-5 [clip-path:polygon(9%_0,100%_0,100%_100%,0_100%)]",
  3: "h-4 sm:h-[22px] [clip-path:polygon(0_0,90%_0,100%_100%,0_100%)]",
};

/**
 * Нийлмэл тайз: гурван блок зайгүй нийлж (2 · 1 · 3), нийтлэг суурин дээр
 * зогсоно; суурь шалан дээр сүүдэр тусгана. Гадаргуу бүр цул өнгө — дээд
 * тал цайвар, урд тал бараан — gradient биш (design.md §2). Border сайтаар
 * хаалттай тул ирмэг/зааг нь inset shadow.
 */
function Podium({
  board,
  myAvatar,
}: {
  board: Leaderboard;
  myAvatar: string | null;
}) {
  const meInTop = board.top.some((e) => e.isMe);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={cn("relative mx-auto max-w-3xl px-2 sm:px-6", PODIUM_TONES)}
    >
      <span
        aria-hidden
        className="bg-foreground/15 pointer-events-none absolute bottom-10 left-1/2 size-48 -translate-x-1/2 rounded-full blur-3xl sm:size-72"
      />
      <div className="relative grid grid-cols-3 items-end">
        {PODIUM_ORDER.map((rank, i) => {
          const entry = board.top.find((e) => e.rank === rank);
          const winner = rank === 1;
          return (
            <div key={rank} className="flex min-w-0 flex-col items-center">
              <div className="mb-3 w-full min-w-0 px-1 sm:mb-4">
                {entry ? (
                  <PodiumPerson
                    entry={entry}
                    myAvatar={myAvatar}
                    delay={0.1 + i * 0.08}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 pb-1">
                    <span className="bg-secondary flex size-14 items-center justify-center rounded-full">
                      <span className="text-muted-foreground text-xs">Сул</span>
                    </span>
                    {/* Үзэгч өөрөө топод байвал «таных байж болно» утгагүй. */}
                    {!meInTop && (
                      <p className="text-muted-foreground text-center text-xs">
                        Энэ байр таных байж болно
                      </p>
                    )}
                  </div>
                )}
              </div>
              <motion.div
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{
                  duration: 0.5,
                  delay: 0.1 + i * 0.08,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className={cn(
                  "relative w-full origin-bottom",
                  winner && "z-10",
                )}
              >
                {/* Таг: блокоос хоёр тийш илүү гарсан, дээд гадаргуу нь
                    (хэтийн төлөвтэй трапец) өргөн + урд ирмэг. */}
                <span aria-hidden className="relative -mx-1 block sm:-mx-2">
                  <span
                    className={cn(
                      "block w-full",
                      LID_TOP[rank],
                      winner ? "bg-(--pd-top-1)" : "bg-(--pd-top)",
                    )}
                  />
                  <span
                    className={cn(
                      "block h-2 w-full sm:h-2.5",
                      // Дээд ирмэг дээр 1px гэрэл — хурц ирмэгийг bevel болгоно.
                      winner
                        ? "bg-(--pd-edge-1) shadow-[inset_0_1px_0_var(--pd-hi),0_-4px_32px_-4px_var(--pd-glow)]"
                        : "bg-(--pd-edge) shadow-[inset_0_1px_0_var(--pd-hi)]",
                    )}
                  />
                </span>
                {/* Их бие: дээд талдаа тагны сүүдэр, ёроолдоо суурьтай
                    нийлсэн AO сүүдэр. Ялагч хөршүүд дээрээ хажуу сүүдэр
                    тусгана (z-10). Тоо сийлсэн мэт. */}
                <span
                  className={cn(
                    "flex w-full items-center justify-center font-serif font-semibold tabular-nums text-shadow-(--pd-engrave)",
                    PODIUM_HEIGHT[rank],
                    winner
                      ? "text-foreground bg-(--pd-body-1) text-4xl shadow-[inset_0_14px_14px_-10px_var(--pd-shade),inset_0_-10px_12px_-10px_var(--pd-shade),-10px_0_18px_-10px_var(--pd-shade),10px_0_18px_-10px_var(--pd-shade)] sm:text-6xl"
                      : "text-muted-foreground bg-(--pd-body) text-3xl shadow-[inset_0_14px_14px_-10px_var(--pd-shade),inset_0_-10px_12px_-10px_var(--pd-shade)] sm:text-5xl",
                  )}
                >
                  {rank}
                </span>
              </motion.div>
            </div>
          );
        })}
      </div>
      {/* Суурь: блокуудаас өргөн; дээд гадаргуу нь блокуудын өмнө харагдана. */}
      <div aria-hidden className="relative -mx-2 sm:-mx-6">
        {/* Хамгийн доор тул дээд гадаргуу нь хамгийн их харагдана. */}
        <span className="block h-4 w-full bg-(--pd-base-top) [clip-path:polygon(3.5%_0,96.5%_0,100%_100%,0_100%)] sm:h-6" />
        <span className="block h-3 w-full bg-(--pd-base-front) shadow-[inset_0_1px_0_var(--pd-hi)] sm:h-5" />
        {/* Шал дээрх сүүдэр. */}
        <span className="bg-background absolute inset-x-4 -bottom-3 -z-10 h-6 rounded-full blur-lg" />
      </div>
    </motion.div>
  );
}

/**
 * Дүнг 0-ээс тоолж өсгөнө (тавцан өсөхтэй зэрэг). Текстийг ref-ээр шууд
 * шинэчилнэ — frame бүрт re-render хийхгүй. Дэлгэц уншигчид эцсийн дүнг
 * `sr-only`-оор шууд сонсоно; reduced motion үед шууд эцсийн дүн.
 */
function CountUpPrice({ value, delay }: { value: number; delay: number }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const reduceMotion = useReducedMotion();
  // Layout effect: paint-аас өмнө — reduced motion үед «0₮» анивчихгүй.
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduceMotion) {
      el.textContent = formatPrice(value);
      return;
    }
    const controls = animate(0, value, {
      duration: 1.2,
      delay,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        el.textContent = formatPrice(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [value, delay, reduceMotion]);
  return (
    <>
      <span ref={ref} aria-hidden>
        {formatPrice(0)}
      </span>
      <span className="sr-only">{formatPrice(value)}</span>
    </>
  );
}

function PodiumPerson({
  entry,
  myAvatar,
  delay,
}: {
  entry: LeaderboardEntry;
  myAvatar: string | null;
  delay: number;
}) {
  const winner = entry.rank === 1;
  const avatar = entry.avatarUrl ?? (entry.isMe ? myAvatar : null);
  return (
    <div className="flex w-full min-w-0 flex-col items-center gap-1.5">
      <TierFrame
        tier={entry.tier}
        className={
          winner
            ? "[--avatar:56px] sm:[--avatar:72px]"
            : "[--avatar:44px] sm:[--avatar:56px]"
        }
      >
        {avatar ? (
          <Image
            src={avatar}
            alt=""
            fill
            sizes="72px"
            className="object-cover"
          />
        ) : (
          <span
            className={cn(
              "flex h-full items-center justify-center font-serif font-semibold",
              winner ? "text-xl sm:text-2xl" : "text-base sm:text-lg",
            )}
          >
            {initialOf(entry.name)}
          </span>
        )}
      </TierFrame>
      <p
        title={entry.name}
        className="line-clamp-3 w-full text-center text-sm/snug font-medium text-balance wrap-break-word"
      >
        {entry.name}
        {entry.isMe && <span className="text-muted-foreground"> (Та)</span>}
      </p>
      <p className="text-foreground text-sm font-semibold tabular-nums sm:text-base">
        <CountUpPrice value={entry.amount} delay={delay} />
      </p>
    </div>
  );
}
