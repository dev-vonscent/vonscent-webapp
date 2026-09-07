"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  Clock,
  Coins,
  Crown,
  Gift,
  History,
  Lock,
  Sparkles,
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
import { formatDateTime } from "@/lib/format";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { Confetti } from "./confetti";
import { PrizeReveal } from "./prize-reveal";
import { Wheel3D, type WheelHandle } from "./wheel-3d";
import {
  useCountdown,
  useSpin,
  useWheelSound,
  useWheelState,
} from "../use-wheel";
import type { SpinFailure, SpinSuccess, WheelPrize } from "../types";

/** Why a spin was refused, in the customer's words. */
const REFUSAL: Record<string, string> = {
  COOLDOWN: "Үнэгүй эргэлт хараахан сэргээгүй байна.",
  DISABLED: "Азын хүрд түр хаалттай байна.",
  NOT_ENOUGH_POINTS: "V point хүрэлцэхгүй байна.",
  NO_PRIZES: "Одоогоор шагнал тохируулагдаагүй байна.",
  NO_DB: "Холболт тасарлаа. Дахин оролдоно уу.",
};

const TIER_LABEL = { common: "Энгийн", rare: "Ховор", grand: "Гранд" } as const;

const KIND_ICON = {
  points: Sparkles,
  coupon_percent: Ticket,
  coupon_fixed: Ticket,
  bundle: Crown,
} as const;

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

function PrizeLegend({ prizes }: { prizes: WheelPrize[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {prizes.map((prize, i) => {
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
            <p className="text-sm/snug font-medium">{prize.label}</p>
          </motion.div>
        );
      })}
    </div>
  );
}

const STEPS = [
  {
    icon: Clock,
    title: "24 цагт нэг үнэгүй",
    body: "Сүүлийн үнэгүй эргэлтээс хойш 24 цаг өнгөрөхөд эрх сэргэнэ.",
  },
  {
    icon: Coins,
    title: "Эсвэл 2,000V-оор",
    body: "Хуримтлуулсан V point-оороо нэмэлт эргэлт худалдаж авна.",
  },
  {
    icon: Gift,
    title: "Хоосон салбар байхгүй",
    body: "Найман салбар бүгд шагналтай — оноо, купон эсвэл 2мл таних багц.",
  },
] as const;

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

  const run = React.useCallback(
    async (mode: "free" | "points") => {
      if (busy || !state) return;
      setSpinning(true);
      try {
        const outcome = await spin.mutateAsync(mode);
        // The wheel turns *after* the server has decided, and stops on the
        // segment it actually awarded — never the other way round.
        await wheelRef.current?.spinTo(outcome.slot);
        buzz(outcome.tier === "grand" ? [30, 40, 30, 40, 80] : 35);
        sound.fanfare(outcome.tier === "grand");
        setResult(outcome);
        setRevealOpen(true);
        setBurst((n) => n + 1);
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
    if (freeReady) return { label: "ЭРГҮҮЛЭХ", hint: "Үнэгүй" };
    if (canPay)
      return {
        label: "ЭРГҮҮЛЭХ",
        hint: `${state.spinCost.toLocaleString("mn-MN")}V`,
      };
    return { label: countdown.label, hint: "хүлээнэ" };
  })();

  const onHub = () => {
    if (!state?.signedIn) return;
    void run(freeReady ? "free" : "points");
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
    <div className="mx-auto max-w-3xl px-4 pt-4 pb-16">
      <Confetti fire={burst} intense={result?.tier === "grand"} />

      {/* ── Толгой ─────────────────────────────────────────────────── */}
      <header className="mb-6 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-serif text-3xl tracking-tight sm:text-4xl"
        >
          Азын хүрд
        </motion.h1>
        <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">
          Найман салбар, бүгд шагналтай. Өдөрт нэг удаа үнэгүй эргүүлж, оноо
          эсвэл хөнгөлөлтөө шууд аваарай.
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <StatChip
            icon={Clock}
            label="Үнэгүй эргэлт"
            value={freeReady ? "Бэлэн" : countdown.label}
          />
          {state.signedIn && (
            <StatChip
              icon={Coins}
              label="V point"
              value={state.points.toLocaleString("mn-MN")}
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

      {/* ── Хүрд ───────────────────────────────────────────────────── */}
      <Wheel3D
        ref={wheelRef}
        prizes={state.prizes}
        onSpin={onHub}
        hubLabel={hub.label}
        hubHint={hub.hint}
        busy={busy}
        disabled={!state.signedIn || (!freeReady && !canPay)}
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
              Хүрд зөвхөн бүртгэлтэй хэрэглэгчид нээлттэй — шагнал таны данс руу
              шууд орно.
            </p>
          </>
        ) : freeReady ? (
          <>
            <Button
              size="lg"
              className="w-full"
              onClick={() => run("free")}
              disabled={busy}
            >
              Үнэгүй эргүүлэх
            </Button>
            {canPay && (
              <button
                type="button"
                onClick={() => run("points")}
                disabled={busy}
                className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-4 disabled:opacity-50"
              >
                Эсвэл {state.spinCost.toLocaleString("mn-MN")}V-оор дахин
                эргүүлэх
              </button>
            )}
          </>
        ) : (
          <>
            <Button
              size="lg"
              className="w-full"
              onClick={() => run("points")}
              disabled={busy || !canPay}
            >
              {state.spinCost.toLocaleString("mn-MN")}V-оор эргүүлэх
            </Button>
            <AnimatePresence mode="wait">
              <motion.p
                key={countdown.label}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-muted-foreground text-center text-xs tabular-nums"
              >
                {canPay
                  ? `Дараагийн үнэгүй эргэлт ${countdown.label}-ийн дараа`
                  : `V point хүрэлцэхгүй — үнэгүй эргэлт ${countdown.label}-ийн дараа`}
              </motion.p>
            </AnimatePresence>
          </>
        )}
      </div>

      {/* ── Шагналууд ──────────────────────────────────────────────── */}
      <section className="mt-12">
        <h2 className="mb-3 text-sm font-semibold tracking-wide uppercase">
          Хүрдэн дэх шагналууд
        </h2>
        <PrizeLegend prizes={state.prizes} />
      </section>

      {/* ── Хэрхэн ажилладаг ───────────────────────────────────────── */}
      <section className="mt-10 grid gap-3 sm:grid-cols-3">
        {STEPS.map((step) => (
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
                  Үнэгүй эргэлт сүүлийн үнэгүй эргэлтээс {state.freeSpinHours}{" "}
                  цагийн дараа сэргэнэ.
                </li>
                <li>
                  Нэмэлт эргэлт зөвхөн {state.spinCost.toLocaleString("mn-MN")}
                  V-оор — өөр аргаар эргэлт нэмэгдэхгүй.
                </li>
                <li>
                  Хүрднээс авсан ашиглагдаагүй купон нэг дор нэг л байна: шинийг
                  хожвол өмнөх нь солигдоно.
                </li>
                <li>
                  Бүх купон 1 сар хүчинтэй, нэг захиалгад нэг удаа ашиглагдана.
                </li>
                <li>
                  Хувиар хөнгөлөх купонд дээд хязгаар тавигдсан (жишээ нь 10% →
                  15,000₮).
                </li>
                <li>
                  Хүрднээс сард авах V point-д дээд хязгаар бий; хязгаарт хүрвэл
                  салбар купон болж хувирна.
                </li>
                <li>
                  2мл таних багц сарын хязгаартай — дууссан үед салбар купон руу
                  шилжинэ.
                </li>
                <li>
                  Сугалаа сервер тал дээр, нийт эргэлтийн сангаас бодогдоно.
                </li>
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      {/* ── Түүх ───────────────────────────────────────────────────── */}
      {state.history.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-wide uppercase">
            <History className="size-4" /> Миний эргэлтүүд
          </h2>
          <ul className="divide-muted/60 divide-y">
            {state.history.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.label}</p>
                  <p className="text-muted-foreground text-xs">
                    {formatDateTime(item.createdAt)}
                    {item.spinType === "paid" && " · пойнтоор"}
                  </p>
                </div>
                {item.couponCode && (
                  <code
                    className={cn(
                      "shrink-0 rounded-md px-2 py-1 text-xs tracking-wider",
                      item.couponActive
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground/60 line-through",
                    )}
                  >
                    {item.couponCode}
                  </code>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <PrizeReveal
        result={result}
        open={revealOpen}
        onClose={() => setRevealOpen(false)}
      />
    </div>
  );
}
