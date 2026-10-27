"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Clock, Gift, Lock, ShoppingBag, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { WheelSkeleton } from "@/components/shared/skeletons";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import { VPointIcon } from "@/components/shared/v-point-icon";
import { VPointMark } from "@/components/shared/v-point-mark";
import { Confetti } from "./confetti";
import { FortuneWheel, type WheelHandle } from "./fortune-wheel";
import { PrizeReveal } from "./prize-reveal";
import { SpinHistory } from "./spin-history";
import { MyGrandPrizes } from "./my-grand-prizes";
import { colorOf, prizeColors, type PrizeColor } from "../palette";
import {
  useCountdown,
  useSpin,
  useWheelSound,
  useWheelState,
} from "../use-wheel";
import type {
  SpinFailure,
  SpinMode,
  SpinSuccess,
  WheelPrize,
  WheelState,
} from "../types";

/** Why a spin was refused, in the customer's words. */
const REFUSAL: Record<string, string> = {
  COOLDOWN: "Үнэгүй эргэлт хараахан сэргээгүй байна.",
  DISABLED: "Азын хүрд түр хаалттай байна.",
  NOT_ENOUGH_POINTS: "V point хүрэлцэхгүй байна.",
  NO_ORDER_SPINS: "Захиалгын эрх дууссан байна.",
  NO_PRIZES: "Одоогоор шагнал тохируулагдаагүй байна.",
  NO_DB: "Холболт тасарлаа. Дахин оролдоно уу.",
};

const fmt = (n: number) => n.toLocaleString("mn-MN");

/** Short haptic — a wheel you can feel stop. Silently absent on desktop. */
function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Unsupported — the animation carries the feedback on its own.
  }
}

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

/* ── Stage backdrop ────────────────────────────────────────────────────── */

/** Twinkling points of light — fixed positions, so nothing jumps on render. */
const STARS = Array.from({ length: 26 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  top: (i * 53 + 7) % 100,
  size: 2 + (i % 3),
  delay: (i % 7) * 0.45,
}));

/**
 * The show's lighting: two spotlight beams sweeping from above and a scatter
 * of stars. Solid shapes at low opacity — the softness is blur, not a
 * gradient (design.md §2).
 */
function StageBackdrop() {
  const reduced = usePrefersReducedMotion();
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      {[-1, 1].map((side) => (
        <motion.svg
          key={side}
          viewBox="-50 0 100 100"
          preserveAspectRatio="none"
          // Own GPU layer: the blur is rasterised once and only the
          // transform animates.
          className="absolute top-[-5%] h-[115%] w-[70%] opacity-50 blur-md will-change-transform"
          style={{
            left: side < 0 ? "-10%" : undefined,
            right: side > 0 ? "-10%" : undefined,
            transformOrigin: side < 0 ? "20% 0%" : "80% 0%",
          }}
          animate={reduced ? undefined : { rotate: [side * -8, side * 8] }}
          transition={{
            duration: 7,
            repeat: Infinity,
            repeatType: "mirror",
            ease: "easeInOut",
          }}
        >
          <path
            d={
              side < 0
                ? "M-30 0 L-22 0 L40 100 L0 100 Z"
                : "M22 0 L30 0 L0 100 L-40 100 Z"
            }
            fill="var(--wheel-gold)"
            style={{ opacity: "var(--wheel-beam-opacity)" }}
          />
        </motion.svg>
      ))}
      {STARS.map((s, i) => (
        <span
          key={i}
          className="wheel-twinkle absolute rounded-full"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            backgroundColor: "var(--wheel-star)",
            animation: `wheel-twinkle ${2.4 + (i % 4) * 0.5}s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

/* ── Paytable ──────────────────────────────────────────────────────────── */

/**
 * Each prize once, with how many wedges it holds — the wheel repeats coupons
 * across the rim and «Баярлалаа» is not a prize.
 */
function payItems(prizes: WheelPrize[]) {
  const seen = new Map<string, { prize: WheelPrize; count: number }>();
  for (const prize of prizes) {
    if (prize.kind === "none") continue;
    const key = `${prize.kind}:${prize.value}:${prize.minSubtotal}:${prize.label}`;
    const hit = seen.get(key);
    if (hit) hit.count += 1;
    else seen.set(key, { prize, count: 1 });
  }
  // Grand first, then the rest from the rarest down.
  return [...seen.values()].sort(
    (a, b) =>
      Number(b.prize.tier === "grand") - Number(a.prize.tier === "grand") ||
      a.count - b.count,
  );
}

function Swatch({ color }: { color: PrizeColor }) {
  return (
    <span
      className="size-4 shrink-0 rounded-full"
      style={{
        backgroundColor: color.fill,
        boxShadow: "0 0 0 2px var(--wheel-gold-deep)",
      }}
    />
  );
}

/** The jackpot row's gold: solid bands like the wedge's — a bright lip on
 *  top, a deeper ledge below, a fine dark edge — and a glow round it. */
const GRAND_ROW_SHADOW = [
  "inset 0 2px 0 var(--wheel-gold-shine)",
  "inset 0 -3px 0 var(--wheel-gold-mid)",
  "inset 0 0 0 1px var(--wheel-gold-deep)",
  "0 0 28px color-mix(in oklab, var(--wheel-gold) 50%, transparent)",
].join(", ");

/**
 * A glint crossing the jackpot row now and then, top-left to bottom-right: a
 * tilted solid band (blurred, not a gradient — design.md §2) that slides
 * across while the row clips it.
 */
function Glint() {
  const reduced = usePrefersReducedMotion();
  if (reduced) return null;
  return (
    <motion.span
      aria-hidden
      // -z-10 inside the row's `isolate`: over the gold, under the text.
      className="pointer-events-none absolute left-0 -z-10 w-8 opacity-80"
      style={{
        top: "-1.5rem",
        bottom: "-1.5rem",
        rotate: "24deg",
        filter: "blur(3px)",
        backgroundColor: "var(--wheel-gold-shine)",
      }}
      initial={{ x: "-6rem" }}
      animate={{ x: ["-6rem", "44rem"] }}
      transition={{
        duration: 1.4,
        ease: "easeInOut",
        repeat: Infinity,
        repeatDelay: 2.4,
      }}
    />
  );
}

function Paytable({ prizes }: { prizes: WheelPrize[] }) {
  const colors = React.useMemo(() => prizeColors(prizes), [prizes]);
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {payItems(prizes).map(({ prize, count }, i) => {
        const grand = prize.tier === "grand";
        return (
          <motion.li
            key={prize.slot}
            initial={{ opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.04 }}
            // The jackpot row is polished gold, like its wedge.
            style={grand ? { boxShadow: GRAND_ROW_SHADOW } : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3.5 py-3",
              grand
                ? "bg-wheel-gold text-wheel-ink-dark relative isolate overflow-hidden sm:col-span-2"
                : "bg-foreground/5",
            )}
          >
            {grand && <Glint />}
            {grand ? (
              <Gift className="size-5 shrink-0" />
            ) : (
              <Swatch color={colorOf(colors, prize)} />
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-sm/tight font-bold">
                {prize.label}
              </span>
              {(grand || prize.minSubtotal > 0) && (
                <span
                  className={cn(
                    "block text-xs",
                    grand ? "text-wheel-ink-dark/70" : "text-muted-foreground",
                  )}
                >
                  {grand
                    ? "Гранд шагнал — хамгийн ховор"
                    : `${fmt(prize.minSubtotal)}₮-с дээш захиалгад`}
                </span>
              )}
            </span>
            <span
              className={cn(
                "shrink-0 text-xs font-semibold tabular-nums",
                grand ? "text-wheel-ink-dark/70" : "text-muted-foreground",
              )}
            >
              ×{count}
            </span>
          </motion.li>
        );
      })}
    </ul>
  );
}

/* ── Stats ─────────────────────────────────────────────────────────────── */

function StatPill({
  icon: Icon,
  label,
  value,
  lit,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  /** Something is ready to use — the pill lights up. */
  lit?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-full py-2 pr-4 pl-2.5",
        lit ? "bg-wheel-gold text-wheel-ink-dark" : "bg-foreground/6",
      )}
    >
      <span
        className={cn(
          "grid size-7 place-items-center rounded-full",
          lit ? "bg-wheel-ink-dark/10" : "bg-foreground/8",
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="leading-tight">
        <span
          className={cn(
            "block text-[0.65rem]",
            lit ? "text-wheel-ink-dark/70" : "text-muted-foreground",
          )}
        >
          {label}
        </span>
        <span className="block text-sm font-bold tabular-nums">{value}</span>
      </span>
    </div>
  );
}

/* ── Rules ─────────────────────────────────────────────────────────────── */

/** The three ways to earn a spin, from the live settings. */
function steps(state: WheelState) {
  return [
    {
      icon: Clock,
      title: `${state.freeSpinHours} цагт нэг үнэгүй`,
      body: `Сүүлийн үнэгүй эргэлтээс хойш ${state.freeSpinHours} цаг өнгөрөхөд эрх сэргэнэ.`,
    },
    ...(state.orderSpinStep > 0
      ? [
          {
            icon: ShoppingBag,
            title: `${fmt(state.orderSpinStep)}₮ тутамд нэг`,
            body: `Төлөгдсөн захиалгын ${fmt(state.orderSpinStep)}₮ тутамд нэг эрх нэмэгдэнэ.`,
          },
        ]
      : []),
    ...(state.spinCost > 0
      ? [
          {
            icon: VPointIcon,
            title: `${fmt(state.spinCost)}V-оор нэг`,
            body: "Хуримтлуулсан V point-оороо нэмэлт эргэлт авах боломжтой.",
          },
        ]
      : []),
  ];
}

/* ── Spinning ──────────────────────────────────────────────────────────── */

/** Free first (it expires into the cooldown), then order credits, then points. */
function nextMode(
  freeReady: boolean,
  orderSpins: number,
  canPay: boolean,
): SpinMode | null {
  if (freeReady) return "free";
  if (orderSpins > 0) return "order";
  if (canPay) return "points";
  return null;
}

/** «1,000» + the V point mark (a V with a bar), as prices are written. */
function Points({ value }: { value: number }) {
  return (
    <span className="whitespace-nowrap">
      {fmt(value)}
      <VPointMark />
    </span>
  );
}

const MODE_LABEL: Record<SpinMode, (state: WheelState) => React.ReactNode> = {
  free: () => "Үнэгүй эргүүлэх",
  order: (state) => `Захиалгын эрхээр эргүүлэх (${state.orderSpins})`,
  points: (state) => (
    <>
      <Points value={state.spinCost} />
      -оор эргүүлэх
    </>
  ),
};

/**
 * The big gold button — the game-show «SPIN». Solid gold on a darker ledge
 * that it presses down into.
 */
const SPIN_BUTTON = cn(
  "bg-wheel-cta text-wheel-ink-dark flex h-14 w-full items-center justify-center rounded-2xl text-base font-black tracking-wide uppercase transition-[translate,box-shadow]",
  "shadow-[0_6px_0_var(--wheel-cta-deep)] active:translate-y-1 active:shadow-[0_2px_0_var(--wheel-cta-deep)]",
  "disabled:bg-foreground/10 disabled:text-muted-foreground disabled:shadow-none",
);

function TextAction({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-4 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function LuckyWheel() {
  const { data: state, isLoading, refetch } = useWheelState();
  const spin = useSpin();
  const wheelRef = React.useRef<WheelHandle>(null);
  const sound = useWheelSound();

  const [spinning, setSpinning] = React.useState(false);
  const [result, setResult] = React.useState<SpinSuccess | null>(null);
  const [revealOpen, setRevealOpen] = React.useState(false);
  const [burst, setBurst] = React.useState(0);

  const countdown = useCountdown(state?.nextFreeAt);
  const freeReady =
    !!state?.freeReady || (!!state?.nextFreeAt && countdown.ready);

  // No rubber-band at the ends on this page: iOS pulled the document past
  // its edges and showed the light theme's background above and below the
  // black stage. Restored when the page goes.
  React.useEffect(() => {
    const root = document.documentElement;
    const before = root.style.overscrollBehaviorY;
    root.style.overscrollBehaviorY = "none";
    return () => {
      root.style.overscrollBehaviorY = before;
    };
  }, []);

  // The cooldown expiring is the one state change no request tells us about.
  React.useEffect(() => {
    if (countdown.ready && state && !state.freeReady && state.nextFreeAt) {
      void refetch();
    }
  }, [countdown.ready, state, refetch]);

  const canPay =
    !!state && state.points >= state.spinCost && state.spinCost > 0;
  const busy = spinning || spin.isPending;
  const orderSpins = state?.orderSpins ?? 0;
  const mode = nextMode(freeReady, orderSpins, canPay);

  const run = React.useCallback(
    async (mode: SpinMode) => {
      if (busy || !state) return;
      setSpinning(true);
      setRevealOpen(false);
      try {
        const outcome = await spin.mutateAsync(mode);
        const win = outcome.kind !== "none";
        sound.whoosh();
        // The wheel turns *after* the server has decided, and stops on the
        // segment it actually awarded — never the other way round.
        await wheelRef.current?.spinTo(outcome.slot, { win });
        setResult(outcome);
        if (win) {
          buzz(outcome.tier === "grand" ? [30, 40, 30, 40, 80] : 35);
          sound.fanfare(outcome.tier === "grand");
          setBurst((n) => n + 1);
        } else {
          sound.miss();
        }
        // Let the lit wedge register before the card covers it — and use the
        // pause to refresh, so «Дахин эргүүлэх» on the card offers an
        // entitlement that still exists.
        await Promise.all([refetch(), wait(win ? 900 : 500)]);
        setRevealOpen(true);
      } catch (error) {
        const failure = error as SpinFailure;
        if (failure?.reason === "AUTH") {
          toast.error("Эргүүлэхийн тулд нэвтэрнэ үү");
        } else {
          toast.error(REFUSAL[failure?.reason] ?? "Эргэлт амжилтгүй боллоо");
        }
        void refetch();
      } finally {
        setSpinning(false);
      }
    },
    [busy, state, spin, sound, refetch],
  );

  // Same shape the route boundary shows, so the hand-over is invisible.
  if (isLoading || !state) return <WheelSkeleton />;

  if (!state.enabled || state.prizes.length === 0) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-24 text-center">
        <Lock className="text-muted-foreground size-10" />
        <div>
          <p className="font-medium">Азын хүрд түр хаалттай</p>
          <p className="text-muted-foreground text-sm">
            Тун удахгүй дахин нээгдэнэ. Тэр хооронд каталогоо үзээрэй.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/catalog">Каталог үзэх</Link>
        </Button>
      </div>
    );
  }

  const hub = (() => {
    if (busy) return { label: "", hint: undefined };
    if (!state.signedIn) return { label: "НЭВТРЭХ", hint: undefined };
    if (mode === "free") return { label: "ЭРГҮҮЛЭХ", hint: "Үнэгүй" };
    if (mode === "order")
      return { label: "ЭРГҮҮЛЭХ", hint: `${orderSpins} эрх` };
    if (mode === "points")
      return { label: "ЭРГҮҮЛЭХ", hint: <Points value={state.spinCost} /> };
    return { label: countdown.label, hint: "хүлээнэ" };
  })();

  const again =
    state.signedIn && mode && !busy
      ? {
          // Short — it sits on one line of a phone-width card.
          label:
            mode === "free" ? (
              "Дахин үнэгүй эргүүлэх"
            ) : mode === "order" ? (
              `Дахин эргүүлэх · ${orderSpins} эрх`
            ) : (
              <>
                Дахин эргүүлэх · <Points value={state.spinCost} />
              </>
            ),
          onClick: () => {
            setRevealOpen(false);
            window.scrollTo({ top: 0, behavior: "smooth" });
            // After the stage has faded, so the spin is seen from the start.
            setTimeout(() => void run(mode), 350);
          },
        }
      : null;

  return (
    // Black in every theme (the header keeps the visitor's): the wheel is a
    // lit stage, and on white its gold lost all its shine.
    // On a phone the stage runs up behind the floating 64px bar to the
    // screen's top edge (-mt-16, the product gallery's trick), and its own
    // top padding clears the bar's buttons; from md the header is solid.
    // At the bottom it reaches under the layout's 6rem bottom-nav padding too
    // (-mb-24 pb-24), so no strip of the light theme shows below the stage.
    <div className="force-black bg-background text-foreground -mt-16 -mb-24 pb-24 md:my-0 md:pb-0">
      <Confetti fire={burst} intense={result?.tier === "grand"} />

      {/* ── The stage ─────────────────────────────────────────────────── */}
      {/* `overflow-clip`, not `hidden`: it trims the beams without becoming a
          scroll container, which would stop the wheel from sticking. */}
      <section className="relative isolate overflow-clip">
        <StageBackdrop />

        <div className="mx-auto grid max-w-352 gap-8 px-4 pt-20 pb-6 md:px-8 md:pt-6 md:pb-16 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start lg:gap-x-14 lg:gap-y-8 lg:py-14">
          {/* Title — first on a phone, top of the right column on desktop. */}
          <header className="text-center lg:col-start-2 lg:row-start-1 lg:text-left">
            <p className="text-wheel-accent text-xs font-bold tracking-[0.35em] uppercase">
              Өдөр бүр үнэгүй
            </p>
            <motion.h1
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className="text-wheel-title mt-2 text-5xl font-black tracking-tight uppercase sm:text-6xl lg:text-7xl"
              // A solid ledge under the letters — marquee lettering, no gradient.
              style={{ textShadow: "0 4px 0 var(--wheel-cta-deep)" }}
            >
              Азын хүрд
            </motion.h1>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
              <StatPill
                icon={Clock}
                label="Үнэгүй эргэлт"
                value={freeReady ? "Бэлэн!" : countdown.label}
                lit={state.signedIn && freeReady}
              />
              {state.signedIn && state.orderSpinStep > 0 && (
                <StatPill
                  icon={ShoppingBag}
                  label="Захиалгын эрх"
                  value={fmt(orderSpins)}
                  lit={orderSpins > 0}
                />
              )}
              {state.signedIn && (
                <StatPill
                  icon={VPointIcon}
                  label="V point"
                  value={fmt(state.points)}
                />
              )}
              <button
                type="button"
                onClick={sound.toggle}
                aria-pressed={sound.on}
                aria-label={sound.on ? "Дууг унтраах" : "Дууг асаах"}
                className="bg-foreground/6 hover:bg-foreground/12 grid size-11 place-items-center rounded-full transition-colors"
              >
                {sound.on ? (
                  <Volume2 className="size-4" />
                ) : (
                  <VolumeX className="size-4" />
                )}
              </button>
            </div>
          </header>

          {/* The wheel — left column on desktop, held in place while the
              right column scrolls past it. Its gap below the header stays
              the stage's own top padding (lg:py-14 = 3.5rem) whether the
              header is showing or slid away. `--header-offset` carries a
              4px hairline the measured gap doesn't, so: visible = offset +
              3.3125rem, hidden = a plain 3.5rem (top-14). Same `top` transition
              as the product gallery, in step with the header. */}
          <div className="lg:sticky lg:top-[calc(var(--header-offset)+3.3125rem)] lg:col-start-1 lg:row-span-4 lg:row-start-1 lg:self-start lg:transition-[top] lg:duration-300 lg:ease-out lg:in-data-[header-hidden=true]:top-14">
            <FortuneWheel
              ref={wheelRef}
              prizes={state.prizes}
              onSpin={() => {
                if (mode && state.signedIn) void run(mode);
              }}
              hubLabel={hub.label}
              hubHint={hub.hint}
              busy={busy}
              disabled={!state.signedIn || !mode}
              onTick={() => {
                sound.tick();
                buzz(4);
              }}
            />
          </div>

          {/* The action. */}
          <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-3 lg:col-start-2 lg:row-start-2 lg:mx-0 lg:items-start">
            {!state.signedIn ? (
              <>
                <Link href="/login?next=/lucky-wheel" className={SPIN_BUTTON}>
                  Нэвтэрч эргүүлэх
                </Link>
                <p className="text-muted-foreground text-center text-xs lg:text-left">
                  Хүрд зөвхөн бүртгэлтэй хэрэглэгчид нээлттэй — шагнал таны данс
                  руу шууд орно.
                </p>
              </>
            ) : mode ? (
              <>
                <button
                  type="button"
                  className={SPIN_BUTTON}
                  onClick={() => run(mode)}
                  disabled={busy}
                >
                  {busy ? "Эргэж байна…" : MODE_LABEL[mode](state)}
                </button>
                {mode !== "order" && orderSpins > 0 && (
                  <TextAction onClick={() => run("order")} disabled={busy}>
                    Эсвэл захиалгын эрхээр ({orderSpins})
                  </TextAction>
                )}
                {mode !== "points" && canPay && (
                  <TextAction onClick={() => run("points")} disabled={busy}>
                    Эсвэл <Points value={state.spinCost} />
                    -оор
                  </TextAction>
                )}
                {!freeReady && (
                  <p className="text-muted-foreground text-center text-xs tabular-nums">
                    Дараагийн үнэгүй эргэлт {countdown.label}-ийн дараа
                  </p>
                )}
              </>
            ) : (
              <>
                <button type="button" className={SPIN_BUTTON} disabled>
                  <Points value={state.spinCost} />
                  -оор эргүүлэх
                </button>
                <p className="text-muted-foreground text-center text-xs tabular-nums">
                  V point хүрэлцэхгүй — үнэгүй эргэлт {countdown.label}-ийн
                  дараа
                </p>
              </>
            )}
          </div>

          {/* The customer's grand prizes (if any), then the paytable. */}
          <div className="lg:col-start-2 lg:row-start-3">
            <MyGrandPrizes signedIn={state.signedIn} className="mb-10" />
            <h2 className="text-wheel-accent mb-3 text-xs font-bold tracking-[0.3em] uppercase">
              Шагналууд
            </h2>
            <Paytable prizes={state.prizes} />
          </div>
          {/* How it works, rules, history — under the paytable, in the
              column that scrolls. */}
          <div className="lg:col-start-2 lg:row-start-4">
            <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {steps(state).map((step) => (
                <div key={step.title} className="bg-card rounded-xl p-4">
                  <step.icon className="text-muted-foreground mb-2 size-5" />
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="text-muted-foreground mt-1 text-xs/relaxed">
                    {step.body}
                  </p>
                </div>
              ))}
            </section>

            <div className="mt-10 space-y-10">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="rules">
                  <AccordionTrigger>Дэлгэрэнгүй дүрэм</AccordionTrigger>
                  <AccordionContent>
                    <ul className="text-muted-foreground list-disc space-y-2 pl-4 text-sm">
                      <li>
                        Үнэгүй эргэлт сүүлийн үнэгүй эргэлтээс{" "}
                        {state.freeSpinHours} цагийн дараа сэргэнэ —
                        хуримтлагдахгүй.
                      </li>
                      {state.orderSpinStep > 0 && (
                        <li>
                          Төлөгдсөн захиалгын {fmt(state.orderSpinStep)}₮ тутамд
                          нэг эрх (хүргэлт ороогүй, купоны хөнгөлөлтийг хассан
                          дүнгээр). Захиалга цуцлагдвал ашиглаагүй эрх нь
                          хүчингүй болно.
                        </li>
                      )}
                      {state.spinCost > 0 && (
                        <li>
                          {fmt(state.spinCost)}V-оор нэмэлт эргэлт авч болно.
                        </li>
                      )}
                      <li>
                        Бүх купон 1 сар хүчинтэй, нэг захиалгад нэг удаа
                        ашиглагдана. Хожсон купонууд хуримтлагдана.
                      </li>
                      <li>
                        Мөнгөн дүнтэй купон (5,000₮, 10,000₮) 100,000₮-с дээш
                        захиалгад хэрэглэгдэнэ.
                      </li>
                      <li>
                        V point шууд таны дансанд орж, зарцуулах боломжтой.
                      </li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <SpinHistory
                items={state.history}
                hasMore={state.hasMoreHistory}
              />
            </div>
          </div>
        </div>
      </section>

      <PrizeReveal
        result={result}
        open={revealOpen}
        onClose={() => setRevealOpen(false)}
        // Straight back to the wheel for the next one — the loop is the fun.
        again={again}
      />
    </div>
  );
}
