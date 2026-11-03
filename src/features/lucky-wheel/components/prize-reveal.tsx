"use client";

import * as React from "react";
import Link from "next/link";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { animate, motion, useMotionValue } from "motion/react";
import {
  BookOpen,
  Check,
  Copy,
  Gift,
  HeartCrack,
  Package,
  RotateCw,
  Ticket,
  X,
} from "lucide-react";
import { formatDate, formatPrice } from "@/lib/format";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { VPointIcon } from "@/components/shared/v-point-icon";
import { VPointMark } from "@/components/shared/v-point-mark";
import { CouponTicket } from "@/features/account/components/coupon-ticket";
import type { MissTip, SpinSuccess } from "../types";

/** Headline per tier — the wheel's only moment of raised voice. */
const TIER_TITLE = {
  common: "Баяр хүргэе!",
  rare: "Ховор шагнал!",
  grand: "ГРАНД ШАГНАЛ!",
} as const;

/** A miss in one line — no «Баярлалаа», no spent-points note (client). */
const MISS_LINE = "Энэ удаад шагнал таарсангүй";

/** How long the card stays face-down before it turns over. */
const FLIP_DELAY = 0.45;

function PrizeIcon({ kind }: { kind: SpinSuccess["kind"] }) {
  const className = "size-9";
  if (kind === "points") return <VPointIcon className={className} />;
  if (kind === "bundle") return <Gift className={className} />;
  if (kind === "product") return <Package className={className} />;
  // The wheel's own broken heart — the card and the wedge say the same thing.
  if (kind === "none") return <HeartCrack className={className} />;
  return <Ticket className={className} />;
}

/** The lines that say what the customer actually holds now. */
export function prizeTerms(result: SpinSuccess): string[] {
  const terms: string[] = [];
  // A miss carries a tip instead (`MissTipCard`).
  if (result.kind === "none") return terms;
  if (result.kind === "points") {
    terms.push("Оноо шууд зарцуулагдах боломжтой.");
    terms.push(`Одоогийн үлдэгдэл: ${result.points.toLocaleString("mn-MN")}V`);
    return terms;
  }
  if (result.kind === "bundle") {
    terms.push(
      "Та Азын хүрд хуудасны «Миний шагнал» хэсгээс багцаа сонгоод дараагийн захиалгатайгаа хамт хүргүүлээд аваарай.",
    );
    return terms;
  }
  if (result.kind === "product") {
    terms.push(
      "Шагнал «Миний шагнал» хэсэгт хадгалагдлаа — дараагийн захиалгад тань үнэгүй орно.",
    );
    return terms;
  }
  if (result.minSubtotal > 0) {
    terms.push(`${formatPrice(result.minSubtotal)}-с дээш захиалгад`);
  } else {
    terms.push("Доод хязгааргүй");
  }
  if (result.maxDiscount) {
    terms.push(`Дээд хөнгөлөлт ${formatPrice(result.maxDiscount)}`);
  }
  if (result.couponExpiresAt) {
    terms.push(`${formatDate(result.couponExpiresAt)} хүртэл хүчинтэй`);
  }
  return terms;
}

/**
 * Slow-turning light rays in the prize's own colour. Solid wedges at low
 * opacity, not a gradient (design.md §2) — the softness is the scrim's blur.
 */
function Rays({ color, grand }: { color: string; grand: boolean }) {
  const count = 20;
  const step = 360 / count;
  return (
    <motion.svg
      aria-hidden
      viewBox="-100 -100 200 200"
      className="pointer-events-none absolute top-1/2 left-1/2 size-[170vmax] -translate-1/2 sm:size-[140vmax]"
      initial={{ opacity: 0, rotate: 0 }}
      animate={{ opacity: 1, rotate: 360 }}
      transition={{
        opacity: { duration: 0.6 },
        rotate: { duration: 36, repeat: Infinity, ease: "linear" },
      }}
    >
      {Array.from({ length: count / 2 }, (_, i) => {
        const a0 = ((i * 2 * step - 90 - step / 3) * Math.PI) / 180;
        const a1 = ((i * 2 * step - 90 + step / 3) * Math.PI) / 180;
        return (
          <path
            key={i}
            d={`M0 0 L${100 * Math.cos(a0)} ${100 * Math.sin(a0)} L${100 * Math.cos(a1)} ${100 * Math.sin(a1)} Z`}
            fill={color}
            opacity={grand ? 0.3 : 0.2}
          />
        );
      })}
    </motion.svg>
  );
}

/** A number that counts up from 0 once the card has turned. */
function CountUp({ value, delay }: { value: number; delay: number }) {
  const reduced = usePrefersReducedMotion();
  const mv = useMotionValue(reduced ? value : 0);
  const [shown, setShown] = React.useState(reduced ? value : 0);
  React.useEffect(() => {
    if (reduced) return;
    const controls = animate(mv, value, {
      duration: 1.1,
      delay,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setShown(Math.round(v)),
    });
    return () => controls.stop();
  }, [mv, value, delay, reduced]);
  return <span className="tabular-nums">{shown.toLocaleString("mn-MN")}</span>;
}

/**
 * The won coupon, drawn as it appears in «Миний купон» (the shared
 * `CouponTicket`) — just the code and the value. Tap to copy the code.
 */
function WonCoupon({ result }: { result: SpinSuccess }) {
  const [copied, setCopied] = React.useState(false);
  const code = result.couponCode ?? "";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Купоны код хуулагдлаа");
    } catch {
      toast.error("Хуулж чадсангүй — кодоо гараар тэмдэглэнэ үү");
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Купоны код ${code} хуулах`}
      className="w-full text-left transition-transform hover:-translate-y-0.5"
    >
      <CouponTicket
        type={result.kind === "coupon_percent" ? "percent" : "fixed"}
        value={result.value}
        code={code}
        bigSymbol
      />
      {/* Under the ticket: the ticket itself carries only code and value. */}
      <span className="mt-2 flex items-center justify-center gap-1 text-xs opacity-70">
        {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
        {copied ? "Код хуулагдсан" : "Дарж кодоо хуулна"}
      </span>
    </button>
  );
}

/** Headline letters dropping in one by one — for the grand prize only. */
function GrandTitle({ text }: { text: string }) {
  return (
    <span aria-label={text} className="inline-flex">
      {[...text].map((ch, i) => (
        <motion.span
          key={i}
          aria-hidden
          initial={{ y: -18, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{
            delay: FLIP_DELAY + 0.35 + i * 0.035,
            type: "spring",
            stiffness: 420,
            damping: 14,
          }}
          className="inline-block whitespace-pre"
        >
          {ch}
        </motion.span>
      ))}
    </span>
  );
}

/**
 * Each prize comes on a metal card by tier — gold for the grand, silver for a
 * rare one, bronze for the everyday, dark iron for a miss («Хоосон»). Same build
 * for all: a bright lip, a deeper ledge, an engraved inner frame and an outer
 * rim, all solid insets (design.md §2 — no gradient), foil streaks, a glint.
 */
type Metal = "gold" | "silver" | "bronze" | "iron";

interface MetalStyle {
  base: string;
  deep: string;
  mid: string;
  shine: string;
  /** Dark ink reads on it (gold, silver, bronze); iron takes white. */
  dark: boolean;
}

const METALS: Record<Metal, MetalStyle> = {
  gold: {
    base: "var(--wheel-gold)",
    deep: "var(--wheel-gold-deep)",
    mid: "var(--wheel-gold-mid)",
    shine: "var(--wheel-gold-shine)",
    dark: true,
  },
  silver: {
    base: "var(--metal-silver)",
    deep: "var(--metal-silver-deep)",
    mid: "var(--metal-silver-mid)",
    shine: "var(--metal-silver-shine)",
    dark: true,
  },
  bronze: {
    base: "var(--metal-bronze)",
    deep: "var(--metal-bronze-deep)",
    mid: "var(--metal-bronze-mid)",
    shine: "var(--metal-bronze-shine)",
    dark: true,
  },
  iron: {
    base: "var(--metal-iron)",
    deep: "var(--metal-iron-deep)",
    mid: "var(--metal-iron-mid)",
    shine: "var(--metal-iron-shine)",
    dark: false,
  },
};

export function metalOf(result: Pick<SpinSuccess, "kind" | "tier">): Metal {
  if (result.kind === "none") return "iron";
  if (result.tier === "grand") return "gold";
  if (result.tier === "rare") return "silver";
  return "bronze";
}

function metalCard(m: MetalStyle, glow: boolean): string {
  return [
    `inset 0 2px 0 ${m.shine}`,
    `inset 0 -4px 0 ${m.mid}`,
    `inset 0 0 0 10px ${m.base}`,
    `inset 0 0 0 11px ${m.deep}`,
    `inset 0 0 0 12px color-mix(in oklab, ${m.shine} 55%, transparent)`,
    `0 0 0 2px ${m.deep}`,
    `0 0 0 5px ${m.base}`,
    `0 0 0 7px ${m.deep}`,
    "0 24px 60px rgb(0 0 0 / 0.6)",
    ...(glow
      ? [`0 0 90px color-mix(in oklab, ${m.base} 50%, transparent)`]
      : []),
  ].join(", ");
}

/** Foil streaks and a glint that crosses the card now and then. */
function MetalFoil({ shine, glint }: { shine: string; glint: boolean }) {
  const reduced = usePrefersReducedMotion();
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      {/* Two faint static streaks — the brushed look of foil. */}
      <span
        className="absolute -inset-y-10 left-[18%] w-16 opacity-15"
        style={{ rotate: "24deg", backgroundColor: shine }}
      />
      <span
        className="absolute -inset-y-10 left-[62%] w-6 opacity-20"
        style={{ rotate: "24deg", backgroundColor: shine }}
      />
      {glint && !reduced && (
        <motion.span
          className="absolute -inset-y-10 left-0 w-14 opacity-70"
          style={{
            rotate: "24deg",
            filter: "blur(6px)",
            backgroundColor: shine,
          }}
          initial={{ x: "-8rem" }}
          animate={{ x: ["-8rem", "34rem"] }}
          transition={{
            delay: FLIP_DELAY + 0.9,
            duration: 1.5,
            ease: "easeInOut",
            repeat: Infinity,
            repeatDelay: 2.8,
          }}
        />
      )}
    </span>
  );
}

/** The game-show buttons, matching the page's gold «SPIN». */
const GOLD_BUTTON =
  "bg-wheel-cta text-wheel-ink-dark inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-[0.8rem] font-black uppercase sm:text-sm shadow-[0_5px_0_var(--wheel-cta-deep)] transition-[translate,box-shadow] active:translate-y-1 active:shadow-[0_1px_0_var(--wheel-cta-deep)]";
const PLAIN_BUTTON =
  "inline-flex h-12 w-full items-center justify-center bg-foreground/8 hover:bg-foreground/12 text-foreground rounded-xl text-sm font-bold transition-colors";

/**
 * The prize, revealed: a full-screen stage over the page in the prize's own
 * colour. The card arrives face-down (the V mark), turns over, and only then
 * does the prize count up — the beat of suspense the wheel's slow stop has
 * been building. Each tier has its metal (`METALS`).
 *
 * A miss («Хоосон») skips the show: no rays, no flip — one plain line, a tip
 * about the shop (`settings.spin.missTips`) and the way to the next spin.
 */
export function PrizeReveal({
  result,
  tip,
  open,
  onClose,
  again,
}: {
  result: SpinSuccess | null;
  /** Shown on a miss; picked by the page so it changes from spin to spin. */
  tip?: MissTip | null;
  open: boolean;
  onClose: () => void;
  /** Offered when the customer can spin again right away. */
  again?: { label: React.ReactNode; onClick: () => void } | null;
}) {
  const reduced = usePrefersReducedMotion();
  if (!result) return null;

  const miss = result.kind === "none";
  const grand = result.tier === "grand";
  const metal = METALS[metalOf(result)];
  const flip = !reduced && !miss;
  const title = miss ? MISS_LINE : TIER_TITLE[result.tier];
  const contentDelay = flip ? FLIP_DELAY + 0.3 : 0.1;
  const ink = metal.dark ? "text-wheel-ink-dark" : "text-white";
  const soft = metal.dark ? "text-wheel-ink-dark/70" : "text-white/70";

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => !next && onClose()}
    >
      <DialogPrimitive.Portal>
        {/* Portalled to <body>, outside the page's `.force-black` — so it
            pins the black palette itself. */}
        <DialogPrimitive.Overlay className="force-black bg-background/85 data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed inset-0 z-50 backdrop-blur-md" />
        <DialogPrimitive.Content
          // The stage fills the screen; a tap on the empty stage closes it,
          // as a tap outside a dialog would.
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          className="force-black fixed inset-0 z-50 grid place-items-center overflow-hidden p-6 outline-none"
        >
          {!miss && !reduced && <Rays color={metal.base} grand={grand} />}

          <div className="relative w-full max-w-sm perspective-distant">
            <motion.div
              className="relative transform-3d"
              initial={
                reduced
                  ? { opacity: 0 }
                  : { scale: 0.6, opacity: 0, rotateY: flip ? 180 : 0 }
              }
              animate={
                reduced
                  ? { opacity: 1 }
                  : {
                      scale: 1,
                      opacity: 1,
                      rotateY: 0,
                      // A grand win lands with a jolt.
                      ...(grand ? { x: [0, -8, 8, -5, 5, 0] } : {}),
                    }
              }
              transition={{
                scale: { type: "spring", stiffness: 260, damping: 20 },
                opacity: { duration: 0.2 },
                rotateY: {
                  delay: FLIP_DELAY,
                  duration: 0.7,
                  ease: [0.3, 1.4, 0.5, 1],
                },
                x: { delay: FLIP_DELAY + 0.6, duration: 0.45 },
              }}
            >
              {/* Back of the card — what shows before it turns. */}
              {flip && (
                <div
                  aria-hidden
                  className={cn(
                    "absolute inset-0 grid place-items-center rounded-3xl backface-hidden",
                    ink,
                  )}
                  style={{
                    transform: "rotateY(180deg)",
                    backgroundColor: metal.base,
                    boxShadow: metalCard(metal, grand),
                  }}
                >
                  <VPointMark className="size-28" />
                </div>
              )}

              {/* Front of the card. */}
              <div
                className={cn(
                  "relative isolate flex flex-col items-center gap-5 overflow-hidden rounded-3xl px-6 pt-10 pb-6 text-center backface-hidden",
                  ink,
                )}
                style={{
                  backgroundColor: metal.base,
                  boxShadow: metalCard(metal, grand),
                }}
              >
                <MetalFoil shine={metal.shine} glint={!miss} />

                <DialogPrimitive.Close
                  aria-label="Хаах"
                  className={cn(
                    "absolute top-3 right-3 grid size-9 place-items-center rounded-full transition-colors",
                    metal.dark
                      ? "hover:bg-wheel-ink-dark/10"
                      : "hover:bg-white/10",
                  )}
                >
                  <X className="size-4" />
                </DialogPrimitive.Close>

                <motion.div
                  initial={reduced ? false : { scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{
                    delay: contentDelay,
                    type: "spring",
                    stiffness: 380,
                    damping: 14,
                  }}
                  className="grid size-22 place-items-center rounded-full"
                  // A dark medallion with the icon in the card's own metal.
                  style={{
                    backgroundColor: metal.dark
                      ? "var(--wheel-ink-dark)"
                      : "rgb(255 255 255 / 0.1)",
                    color: metal.dark ? metal.base : "rgb(255 255 255 / 0.75)",
                    boxShadow: `0 0 0 3px ${metal.shine}, 0 0 0 6px ${metal.deep}`,
                  }}
                >
                  <PrizeIcon kind={result.kind} />
                </motion.div>

                <div className="space-y-2">
                  <DialogPrimitive.Title
                    className={cn(
                      // A miss says it once, in the big line below.
                      miss
                        ? "sr-only"
                        : "text-xs font-black tracking-[0.3em] uppercase",
                      metal.dark ? "text-wheel-ink-dark" : "text-white/70",
                    )}
                  >
                    {grand && !reduced ? <GrandTitle text={title} /> : title}
                  </DialogPrimitive.Title>
                  <motion.p
                    initial={reduced ? false : { opacity: 0, y: 8, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{
                      delay: contentDelay + 0.1,
                      type: "spring",
                      stiffness: 300,
                      damping: 16,
                    }}
                    className={cn(
                      "font-black tracking-tight",
                      miss ? "text-2xl/tight" : "text-3xl/tight",
                    )}
                  >
                    {miss ? (
                      MISS_LINE
                    ) : result.kind === "points" ? (
                      <>
                        +<CountUp value={result.value} delay={contentDelay} /> V
                        point
                      </>
                    ) : (
                      result.label
                    )}
                  </motion.p>
                  {!miss && result.pointsSpent > 0 && (
                    <p className={cn("text-xs", soft)}>
                      {result.pointsSpent.toLocaleString("mn-MN")}V зарцуулав
                    </p>
                  )}
                </div>

                <motion.div
                  initial={reduced ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: contentDelay + 0.25 }}
                  className="flex w-full flex-col items-center gap-4"
                >
                  {result.couponCode && <WonCoupon result={result} />}

                  {miss ? (
                    tip ? (
                      <DialogPrimitive.Description asChild>
                        {/* Shop know-how, not a prize: a book and a «Та
                            мэдэх үү?» eyebrow, set apart from the miss line
                            by a rule, so nobody reads it as something won. */}
                        <div className="w-full border-t border-white/10 pt-4 text-left">
                          <p className="flex items-center gap-1.5 text-[0.7rem] font-semibold tracking-[0.2em] text-white/50 uppercase">
                            <BookOpen className="size-3.5" />
                            Та мэдэх үү?
                          </p>
                          <div className="mt-2 rounded-2xl bg-white/6 px-4 py-3.5">
                            <p className="text-sm font-bold text-white">
                              {tip.title}
                            </p>
                            <p className="mt-1 text-sm/relaxed text-white/70">
                              {tip.body}
                            </p>
                          </div>
                        </div>
                      </DialogPrimitive.Description>
                    ) : (
                      <DialogPrimitive.Description className="sr-only">
                        {MISS_LINE}
                      </DialogPrimitive.Description>
                    )
                  ) : (
                    <DialogPrimitive.Description asChild>
                      <ul className={cn("space-y-1 text-sm", soft)}>
                        {(result.couponCode
                          ? ["Купон таны «Миний купон» хэсэгт хадгалагдлаа."]
                          : prizeTerms(result)
                        ).map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </DialogPrimitive.Description>
                  )}

                  <div className="flex w-full flex-col gap-2.5 pt-1">
                    {again && (
                      <button
                        type="button"
                        className={cn(
                          GOLD_BUTTON,
                          // On a light metal the yellow would wash out — a
                          // dark button in the card's own metal instead.
                          metal.dark &&
                            "bg-wheel-ink-dark shadow-[0_5px_0_rgb(0_0_0/0.35)]",
                        )}
                        style={metal.dark ? { color: metal.base } : undefined}
                        onClick={again.onClick}
                      >
                        <RotateCw className="size-4" />
                        {again.label}
                      </button>
                    )}
                    {!miss && (
                      <Link
                        href="/catalog"
                        className={cn(
                          again ? PLAIN_BUTTON : GOLD_BUTTON,
                          metal.dark &&
                            "bg-wheel-ink-dark/10 text-wheel-ink-dark hover:bg-wheel-ink-dark/15 shadow-none",
                        )}
                      >
                        {result.couponCode ? "Купоноо ашиглах" : "Дэлгүүр үзэх"}
                      </Link>
                    )}
                    {(miss || !again) && (
                      <button
                        type="button"
                        className={cn(
                          "h-10 w-full text-sm font-semibold",
                          soft,
                        )}
                        onClick={onClose}
                      >
                        Хаах
                      </button>
                    )}
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
