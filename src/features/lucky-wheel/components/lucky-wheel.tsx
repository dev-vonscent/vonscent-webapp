"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  Clock,
  Crown,
  Heart,
  Lock,
  ShoppingBag,
  Ticket,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { VPointIcon } from "@/components/shared/v-point-icon";
import { Confetti } from "./confetti";
import { PrizeReveal } from "./prize-reveal";
import { SpinHistory } from "./spin-history";
import { Wheel3D, type WheelHandle } from "./wheel-3d";
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

const TIER_LABEL = { common: "Энгийн", rare: "Ховор", grand: "Гранд" } as const;

const KIND_ICON = {
  points: VPointIcon,
  coupon_percent: Ticket,
  coupon_fixed: Ticket,
  bundle: Crown,
  none: Heart,
} as const;

const fmt = (n: number) => n.toLocaleString("mn-MN");

/** Short haptic — a wheel you can feel stop. Silently absent on desktop. */
function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Unsupported — the animation carries the feedback on its own.
  }
}

function StatChip({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-card flex items-center gap-2.5 rounded-full py-2 pr-4 pl-3">
      <Icon className="text-muted-foreground size-4 shrink-0" />
      <div className="leading-tight">
        <p className="text-muted-foreground text-[0.65rem]">{label}</p>
        <p className="text-sm font-semibold tabular-nums">{value}</p>
      </div>
    </div>
  );
}

/**
 * Each prize once, with how many wedges it holds — the wheel repeats coupons
 * across the rim and «Баярлалаа» is not a prize, so listing segments as-is
 * would read as 26 tiles of mostly the same thing.
 */
function legendItems(prizes: WheelPrize[]) {
  const seen = new Map<string, { prize: WheelPrize; count: number }>();
  for (const prize of prizes) {
    if (prize.kind === "none") continue;
    const key = `${prize.kind}:${prize.value}:${prize.minSubtotal}:${prize.label}`;
    const hit = seen.get(key);
    if (hit) hit.count += 1;
    else seen.set(key, { prize, count: 1 });
  }
  return [...seen.values()];
}

function PrizeLegend({ prizes }: { prizes: WheelPrize[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-3">
      {legendItems(prizes).map(({ prize, count }, i) => {
        const Icon = KIND_ICON[prize.kind];
        return (
          <motion.div
            key={prize.slot}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ delay: i * 0.04 }}
            className={cn(
              "bg-card flex flex-col gap-2 rounded-xl p-3",
              prize.tier === "grand" && "ring-gold/60 ring-1",
            )}
          >
            {/* Fixed row height: only some tiles carry a tier badge, and
                without it their titles sit a badge-height higher than the
                rest. */}
            <div className="flex h-5 items-center justify-between gap-2">
              <Icon
                className={cn(
                  "size-4",
                  prize.tier === "grand"
                    ? "text-gold-strong"
                    : "text-muted-foreground",
                )}
              />
              {prize.tier !== "common" && (
                <Badge variant={prize.tier === "grand" ? "gold" : "secondary"}>
                  {TIER_LABEL[prize.tier]}
                </Badge>
              )}
            </div>
            <p className="text-sm/snug font-medium">
              {prize.label}
              {count > 1 && (
                <span className="text-muted-foreground font-normal">
                  {" "}
                  ×{count}
                </span>
              )}
            </p>
            {prize.minSubtotal > 0 && (
              <p className="text-muted-foreground text-xs">
                {fmt(prize.minSubtotal)}₮-с дээш захиалгад
              </p>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

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

const MODE_LABEL: Record<SpinMode, (state: WheelState) => string> = {
  free: () => "Үнэгүй эргүүлэх",
  order: (state) => `Захиалгын эрхээр эргүүлэх (${state.orderSpins})`,
  points: (state) => `${fmt(state.spinCost)}V-оор эргүүлэх`,
};

function SecondaryAction({
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
      try {
        const outcome = await spin.mutateAsync(mode);
        // The wheel turns *after* the server has decided, and stops on the
        // segment it actually awarded — never the other way round.
        await wheelRef.current?.spinTo(outcome.slot);
        setResult(outcome);
        setRevealOpen(true);
        // «Баярлалаа» is a miss — no fanfare, no confetti.
        if (outcome.kind !== "none") {
          buzz(outcome.tier === "grand" ? [30, 40, 30, 40, 80] : 35);
          sound.fanfare(outcome.tier === "grand");
          setBurst((n) => n + 1);
        }
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

  const hub = (() => {
    if (busy) return { label: "Эргэж байна", hint: undefined };
    if (!state?.signedIn) return { label: "Нэвтрэх", hint: "эргүүлэхийн тулд" };
    if (mode === "free") return { label: "ЭРГҮҮЛЭХ", hint: "Үнэгүй" };
    if (mode === "order")
      return { label: "ЭРГҮҮЛЭХ", hint: `${orderSpins} эрх` };
    if (mode === "points")
      return { label: "ЭРГҮҮЛЭХ", hint: `${fmt(state.spinCost)}V` };
    return { label: countdown.label, hint: "хүлээнэ" };
  })();

  const onHub = () => {
    if (!state?.signedIn || !mode) return;
    void run(mode);
  };

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

  return (
    // Collection хуудастай ижил өргөн (max-w-352). Утсан дээр нэг багана:
    // толгой → хүрд → бусад. `lg`-ээс хүрд ба үйлдэл зүүн баганад наалдаж
    // (sticky), толгой ба мэдээлэл баруун баганад урсана — DOM-ын дараалал
    // утасных хэвээр, байршлыг grid-ийн мөр/баганаар л заана.
    <div className="mx-auto max-w-352 px-4 pt-4 pb-16 md:px-8 lg:pt-10">
      <Confetti fire={burst} intense={result?.tier === "grand"} />

      <div className="lg:grid lg:grid-cols-2 lg:gap-x-12 xl:gap-x-20">
        {/* ── Толгой ─────────────────────────────────────────────────── */}
        <header className="mb-6 text-center lg:col-start-2 lg:row-start-1 lg:mb-10 lg:text-left">
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-serif text-3xl tracking-tight sm:text-4xl lg:text-5xl"
          >
            Азын хүрд
          </motion.h1>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 lg:mt-6 lg:justify-start">
            <StatChip
              icon={Clock}
              label="Үнэгүй эргэлт"
              value={freeReady ? "Бэлэн" : countdown.label}
            />
            {state.signedIn && state.orderSpinStep > 0 && (
              <StatChip
                icon={ShoppingBag}
                label="Захиалгын эрх"
                value={fmt(orderSpins)}
              />
            )}
            {state.signedIn && (
              <StatChip
                icon={VPointIcon}
                label="V point"
                value={fmt(state.points)}
              />
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={sound.toggle}
              aria-pressed={sound.on}
              aria-label={sound.on ? "Дууг унтраах" : "Дууг асаах"}
              className="rounded-full"
            >
              {sound.on ? (
                <Volume2 className="size-4" />
              ) : (
                <VolumeX className="size-4" />
              )}
            </Button>
          </div>
        </header>

        {/* ── Хүрд + үйлдэл ─────────────────────────────────────────── */}
        <div className="lg:sticky lg:top-24 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:self-start">
          <Wheel3D
            className="lg:max-w-136"
            ref={wheelRef}
            prizes={state.prizes}
            onSpin={onHub}
            hubLabel={hub.label}
            hubHint={hub.hint}
            busy={busy}
            disabled={!state.signedIn || !mode}
            onTick={() => {
              sound.tick();
              buzz(4);
            }}
          />

          {/* ── Үйлдэл ─────────────────────────────────────────────────── */}
          <div className="mx-auto mt-8 flex max-w-sm flex-col items-center gap-3">
            {!state.signedIn ? (
              <>
                <Button asChild size="lg" className="w-full">
                  <Link href="/login?next=/lucky-wheel">Нэвтэрч эргүүлэх</Link>
                </Button>
                <p className="text-muted-foreground text-center text-xs">
                  Хүрд зөвхөн бүртгэлтэй хэрэглэгчид нээлттэй — шагнал таны данс
                  руу шууд орно.
                </p>
              </>
            ) : mode ? (
              <>
                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => run(mode)}
                  disabled={busy}
                >
                  {MODE_LABEL[mode](state)}
                </Button>
                {/* The other entitlements stay one tap away — someone holding
                order credits may still prefer to keep them for later. */}
                {mode !== "order" && orderSpins > 0 && (
                  <SecondaryAction onClick={() => run("order")} disabled={busy}>
                    Эсвэл захиалгын эрхээр ({orderSpins})
                  </SecondaryAction>
                )}
                {mode !== "points" && canPay && (
                  <SecondaryAction
                    onClick={() => run("points")}
                    disabled={busy}
                  >
                    Эсвэл {fmt(state.spinCost)}V-оор
                  </SecondaryAction>
                )}
                {!freeReady && (
                  <p className="text-muted-foreground text-center text-xs tabular-nums">
                    Дараагийн үнэгүй эргэлт {countdown.label}-ийн дараа
                  </p>
                )}
              </>
            ) : (
              <>
                <Button size="lg" className="w-full" disabled>
                  {fmt(state.spinCost)}V-оор эргүүлэх
                </Button>
                <p className="text-muted-foreground text-center text-xs tabular-nums">
                  V point хүрэлцэхгүй — үнэгүй эргэлт {countdown.label}-ийн
                  дараа
                </p>
              </>
            )}
          </div>
        </div>

        <div className="lg:col-start-2 lg:row-start-2">
          {/* ── Шагналууд ──────────────────────────────────────────────── */}
          <section className="mt-12 lg:mt-0">
            <h2 className="mb-3 text-sm font-semibold tracking-wide uppercase">
              Хүрдэн дэх шагналууд
            </h2>
            <PrizeLegend prizes={state.prizes} />
          </section>

          {/* ── Хэрхэн ажилладаг ───────────────────────────────────────── */}
          <section className="mt-10 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
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

          {/* ── Дүрэм ──────────────────────────────────────────────────── */}
          <section className="mt-10">
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
                        дүнгээр). Захиалга цуцлагдвал ашиглаагүй эрх нь хүчингүй
                        болно.
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
                    <li>V point шууд таны дансанд орж, зарцуулах боломжтой.</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </section>

          {/* ── Түүх ───────────────────────────────────────────────────── */}
          <SpinHistory
            items={state.history}
            hasMore={state.hasMoreHistory}
            className="mt-10"
          />
        </div>
      </div>

      <PrizeReveal
        result={result}
        open={revealOpen}
        onClose={() => setRevealOpen(false)}
      />
    </div>
  );
}
