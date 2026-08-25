"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductCarousel } from "@/features/products/components/product-carousel";
import { SideImage } from "@/components/shared/side-image";
import { cn } from "@/lib/utils";
import type { ProductListItem } from "@/lib/types";
import { GENDER_QUESTION, QUIZ_QUESTIONS } from "../questions";
import { buildProfile } from "../score";

/**
 * "Үнэрээ ол" — the home page scent quiz. Runs entirely on the client so the
 * ISR home page stays cacheable; matching happens in POST /api/quiz once the
 * last question is answered.
 */

type Phase = "intro" | "quiz" | "loading" | "results" | "error";
type GenderPick = "male" | "female" | "any";

const TOTAL_STEPS = 1 + QUIZ_QUESTIONS.length;

const SEASON_LABEL: Record<string, string> = {
  spring: "Хавар",
  summer: "Зун",
  autumn: "Намар",
  winter: "Өвөл",
};

const INTENSITY_LABEL: Record<string, string> = {
  light: "Зөөлөн үнэр",
  medium: "Дунд зэрэг",
  strong: "Тод үнэр",
};

/** Crossfade + soft rise between the widget's phases (intro/quiz/results/…). */
const phaseVariants = {
  enter: { opacity: 0, y: 12 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

/** Direction-aware slide between questions; `custom` is +1 (next) / -1 (back). */
const stepVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 48 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -48 }),
};

/** Staggered entrance for grids/lists — the parent sets transition delays. */
const listVariants = {
  center: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
};

const itemVariants = {
  enter: { opacity: 0, y: 14, scale: 0.97 },
  center: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 380, damping: 28 },
  },
} as const;

/** Top-N keys of a weight record, heaviest first, zero-weights dropped. */
function topKeys(rec: Record<string, number | undefined>, n: number): string[] {
  return Object.entries(rec)
    .filter((e): e is [string, number] => (e[1] ?? 0) > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

export function ScentQuiz({
  families = [],
}: {
  /** slug → label source for the profile chips (3b). */
  families?: { slug: string; label: string }[];
}) {
  const [phase, setPhase] = React.useState<Phase>("intro");
  const [step, setStep] = React.useState(0);
  // +1 when moving forward, -1 when going back — drives the slide direction.
  const [dir, setDir] = React.useState(1);
  const [gender, setGender] = React.useState<GenderPick>("any");
  const [picks, setPicks] = React.useState<Record<string, string>>({});
  const [result, setResult] = React.useState<{
    items: ProductListItem[];
    fallback: boolean;
  } | null>(null);
  const advanceTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    },
    [],
  );

  const submit = React.useCallback(
    async (finalGender: GenderPick, finalPicks: Record<string, string>) => {
      setPhase("loading");
      try {
        const res = await fetch("/api/quiz", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gender: finalGender,
            picks: Object.values(finalPicks),
          }),
        });
        if (!res.ok) throw new Error("quiz_failed");
        setResult(await res.json());
        setPhase("results");
      } catch {
        setPhase("error");
      }
    },
    [],
  );

  // A short pause lets the picked tile light up before the next question.
  function advanceFrom(
    current: number,
    nextGender: GenderPick,
    nextPicks: Record<string, string>,
  ) {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => {
      setDir(1);
      if (current + 1 < TOTAL_STEPS) setStep(current + 1);
      else void submit(nextGender, nextPicks);
    }, 250);
  }

  function pickGender(value: GenderPick) {
    setGender(value);
    advanceFrom(0, value, picks);
  }

  function pickOption(questionId: string, optionId: string) {
    const next = { ...picks, [questionId]: optionId };
    setPicks(next);
    advanceFrom(step, gender, next);
  }

  function back() {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    setDir(-1);
    if (step === 0) setPhase("intro");
    else setStep(step - 1);
  }

  function restart() {
    setPicks({});
    setGender("any");
    setResult(null);
    setStep(0);
    setDir(1);
    setPhase("quiz");
  }

  const question = step > 0 ? QUIZ_QUESTIONS[step - 1] : null;

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="border-border bg-card relative overflow-hidden rounded-2xl border"
      >
        <AnimatePresence mode="wait" initial={false}>
          {phase === "intro" && (
            <motion.div
              key="intro"
              variants={phaseVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="relative grid grid-cols-1 md:grid-cols-[1fr_320px]"
            >
              {/* Side imagery (5c) — bleeds to the card edge and fades into the
                  bg-card surface; a warm CSS glow stands in until
                  public/quiz-side-v2.webp is generated (prompts/quiz-options.md). */}
              <SideImage
                src="/quiz-side-v2.webp"
                sizes="(max-width: 768px) 100vw, 320px"
                className="relative aspect-5/2 min-h-70 w-full md:order-2 md:aspect-auto md:min-h-0"
                fallbackClassName="bg-[radial-gradient(ellipse_65%_70%_at_65%_55%,rgba(92,62,28,.55),rgba(40,28,14,.2)_55%,transparent_80%)]"
              >
                {/* fade into the card surface: upward on mobile, leftward on md+ */}
                <div className="from-card absolute inset-x-0 bottom-0 h-[60%] bg-linear-to-t to-transparent md:hidden" />
                <div className="from-card absolute inset-y-0 left-0 hidden w-1/2 bg-linear-to-r to-transparent md:block" />
              </SideImage>

              <motion.div
                variants={listVariants}
                initial="enter"
                animate="center"
                className="flex min-w-0 flex-col items-start justify-center gap-4 p-6 sm:p-10 md:order-1"
              >
                <motion.p
                  variants={itemVariants}
                  className="text-muted-foreground text-sm font-medium tracking-[0.2em] uppercase"
                >
                  Богино асуулга
                </motion.p>
                <motion.h2
                  variants={itemVariants}
                  className="font-serif text-2xl font-semibold tracking-tight text-balance wrap-break-word sm:text-3xl"
                >
                  Үнэрээ ол
                </motion.h2>
                <motion.p
                  variants={itemVariants}
                  className="text-muted-foreground"
                >
                  Аль үнэрийг сонгохоо мэдэхгүй байна уу? Хэдхэн хөгжилтэй
                  асуултад хариулаад өөрт тань хамгийн сайн тохирох үнэртнүүдийг
                  олоорой.
                </motion.p>
                <motion.p
                  variants={itemVariants}
                  className="text-muted-foreground text-sm font-medium"
                >
                  {TOTAL_STEPS} асуулт · 30 секунд
                </motion.p>
                <motion.div variants={itemVariants}>
                  <Button onClick={() => setPhase("quiz")} className="mt-2">
                    Эхэлцгээе <ArrowRight className="size-4" />
                  </Button>
                </motion.div>
              </motion.div>
            </motion.div>
          )}

          {phase === "quiz" && (
            <motion.div
              key="quiz"
              variants={phaseVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="relative min-h-75 p-6 sm:p-10"
            >
              <div className="mb-6 flex items-center justify-between">
                <motion.button
                  type="button"
                  onClick={back}
                  whileHover={{ x: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm transition-colors"
                >
                  <ArrowLeft className="size-4" /> Өмнөх
                </motion.button>
                <div className="mx-4 flex-1 space-y-1.5" aria-hidden>
                  <p className="text-muted-foreground text-center text-xs">
                    Асуулт{" "}
                    <span className="text-foreground font-semibold">
                      {step + 1}
                    </span>{" "}
                    / {TOTAL_STEPS}
                  </p>
                  <div className="bg-border mx-auto h-1 max-w-48 overflow-hidden rounded-full">
                    <motion.div
                      className="bg-foreground h-full rounded-full"
                      initial={false}
                      animate={{
                        width: `${((step + 1) / TOTAL_STEPS) * 100}%`,
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 260,
                        damping: 30,
                      }}
                    />
                  </div>
                </div>
              </div>

              <AnimatePresence mode="wait" custom={dir} initial={false}>
                <motion.div
                  key={step}
                  custom={dir}
                  variants={stepVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.25, ease: "easeOut" }}
                >
                  {question === null ? (
                    <QuestionBlock
                      title={GENDER_QUESTION.title}
                      columns={GENDER_QUESTION.options.length}
                    >
                      {GENDER_QUESTION.options.map((o) => (
                        <OptionTile
                          key={o.value}
                          emoji={o.emoji}
                          image={o.image}
                          label={o.label}
                          selected={gender === o.value}
                          onClick={() => pickGender(o.value)}
                        />
                      ))}
                    </QuestionBlock>
                  ) : (
                    <QuestionBlock
                      title={question.title}
                      columns={question.options.length}
                    >
                      {question.options.map((o) => (
                        <OptionTile
                          key={o.id}
                          emoji={o.emoji}
                          image={o.image}
                          label={o.label}
                          selected={picks[question.id] === o.id}
                          onClick={() => pickOption(question.id, o.id)}
                        />
                      ))}
                    </QuestionBlock>
                  )}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          )}

          {phase === "loading" && (
            <motion.div
              key="loading"
              variants={phaseVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="relative p-6 sm:p-10"
            >
              <motion.p
                animate={{ opacity: [1, 0.55, 1] }}
                transition={{
                  duration: 1.6,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="text-muted-foreground mb-6 font-serif text-xl"
              >
                Танд тохирох үнэрийг хайж байна…
              </motion.p>
              <div className="flex gap-4 overflow-hidden">
                {Array.from({ length: 4 }).map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08, duration: 0.3 }}
                    className="w-[44%] shrink-0 sm:w-[31%] lg:w-[23.5%]"
                  >
                    <Skeleton className="aspect-3/4 rounded-xl" />
                    <Skeleton className="mt-3 h-4 w-3/4" />
                    <Skeleton className="mt-2 h-4 w-1/2" />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {phase === "results" && result && (
            <motion.div
              key="results"
              variants={phaseVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="relative p-6 sm:p-10"
            >
              <div className="mb-6">
                <motion.h3
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl"
                >
                  Танд тохирох үнэртнүүд
                </motion.h3>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.35 }}
                  className="text-muted-foreground mt-1 text-sm"
                >
                  {result.fallback
                    ? "Яг таарсан үнэр олдсонгүй тул хамгийн эрэлттэй үнэртнүүдийг санал болгож байна."
                    : "Таны хариултад үндэслэн сонголоо."}
                </motion.p>
                {!result.fallback && (
                  <ProfileChips picks={picks} families={families} />
                )}
              </div>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.4, ease: "easeOut" }}
              >
                {result.items.length > 0 ? (
                  <ProductCarousel products={result.items} />
                ) : (
                  <p className="text-muted-foreground py-8 text-center text-sm">
                    Одоогоор санал болгох үнэртэн олдсонгүй.
                  </p>
                )}
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.3 }}
                className="mt-6 flex flex-wrap items-center gap-3"
              >
                <Button variant="outline" onClick={restart}>
                  <RotateCcw className="size-4" /> Дахин эхлэх
                </Button>
                <Link
                  href={catalogHref(gender, picks)}
                  className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm font-medium transition-colors hover:underline"
                >
                  Бүгдийг каталогоос харах <ArrowRight className="size-4" />
                </Link>
              </motion.div>
            </motion.div>
          )}

          {phase === "error" && (
            <motion.div
              key="error"
              variants={phaseVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="relative flex flex-col items-start gap-4 p-6 sm:p-10"
            >
              <p className="text-muted-foreground">
                Уучлаарай, алдаа гарлаа. Дахин оролдоно уу.
              </p>
              <Button variant="outline" onClick={() => submit(gender, picks)}>
                Дахин оролдох
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </MotionConfig>
  );
}

/** «Таны профайл» chips — top-2 families, top season, top intensity (3b). */
function ProfileChips({
  picks,
  families,
}: {
  picks: Record<string, string>;
  families: { slug: string; label: string }[];
}) {
  const profile = buildProfile(Object.values(picks));
  const familyLabel = Object.fromEntries(
    families.map((f) => [f.slug, f.label]),
  );
  const chips = [
    ...topKeys(profile.families, 2).map((slug) => familyLabel[slug] ?? slug),
    ...topKeys(profile.seasons, 1).map((s) => SEASON_LABEL[s] ?? s),
    ...topKeys(profile.intensity, 1).map((i) => INTENSITY_LABEL[i] ?? i),
  ];
  if (chips.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {chips.map((c, i) => (
        <motion.span
          key={c}
          initial={{ opacity: 0, scale: 0.85, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{
            delay: 0.15 + i * 0.06,
            type: "spring",
            stiffness: 420,
            damping: 26,
          }}
          className="border-border bg-card rounded-full border px-3 py-1 text-xs font-medium"
        >
          {c}
        </motion.span>
      ))}
    </div>
  );
}

function QuestionBlock({
  title,
  columns,
  children,
}: {
  title: string;
  /** Option count — 3-option questions get a 3-column desktop grid. */
  columns: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-6 text-center font-serif text-xl font-semibold tracking-tight sm:text-2xl">
        {title}
      </h3>
      {/* Capped width keeps the photo tiles compact and centered under the
          title, with no dead space on one side for 3-option questions. */}
      <motion.div
        variants={listVariants}
        initial="enter"
        animate="center"
        className={cn(
          "mx-auto grid grid-cols-2 gap-3",
          columns === 3
            ? "max-w-180 sm:grid-cols-3"
            : "max-w-240 sm:grid-cols-4",
        )}
      >
        {children}
      </motion.div>
    </div>
  );
}

function OptionTile({
  emoji,
  image,
  label,
  selected,
  onClick,
}: {
  emoji: string;
  image?: string;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  // Fall back to the emoji tile while the option's artwork doesn't exist yet
  // (3a — images are generated separately from prompts/quiz-options.md).
  const [imgFailed, setImgFailed] = React.useState(false);

  if (image && !imgFailed) {
    return (
      <motion.button
        type="button"
        onClick={onClick}
        variants={itemVariants}
        whileHover={{ y: -4 }}
        whileTap={{ scale: 0.96 }}
        // The pulse restates the "center" pose so a tile re-mounted already
        // selected (going back a step) still lands fully visible.
        animate={
          selected ? { opacity: 1, y: 0, scale: [1, 1.04, 1] } : "center"
        }
        transition={{ duration: 0.3, ease: "easeOut" }}
        className={cn(
          "group relative aspect-3/4 rounded-xl text-left",
        )}
      >
        {/* clip-path (not border-radius + overflow) does the corner clipping:
            Chromium's rounded-clip antialiasing on a composited image layer
            leaks a white hairline along the curve; a clip-path inset mask
            doesn't. It lives on this inner span (not the button) so the hover
            shadow and selected outline aren't clipped away with it.
            The 1px clip inset trims the image's outermost pixel row: with the
            tile animating scale (entrance/pulse/tap), fractional rasterization
            can leave a bright half-pixel of the image peeking past the top or
            bottom edge on light-edged artwork (beach sand, cream skies) — the
            "white hairline". Cutting that row off hides it for good; the 1px
            gap left behind shows the card surface and is invisible. */}
        {/* bg-card + translateZ(0) + backface-visibility: the span gets its
            own precisely-rasterized GPU layer, and any sub-pixel gap at its
            edge shows the card color instead of white. */}
        <span className="bg-card absolute inset-0 overflow-hidden rounded-xl backface-hidden [clip-path:inset(1px_round_calc(var(--radius-xl)-1px))] transform-[translateZ(0)]">
          <Image
            src={image}
            alt=""
            fill
            sizes="(max-width: 640px) 50vw, 190px"
            // The transparent outline nudges the engine into cleaner edge
            // anti-aliasing while the ancestor scales.
            className="object-cover [outline:1px_solid_transparent]"
            onError={() => setImgFailed(true)}
          />
          {/* -bottom-px: overlap the clip edge so subpixel rounding never
              exposes a bright image row beneath the gradient. */}
          <span
            className="absolute inset-x-0 -bottom-px h-[60%] bg-linear-to-t from-black/90 via-black/40 to-transparent"
            aria-hidden
          />
          <span
            className={cn(
              "absolute inset-x-0 bottom-0 p-3.5 pr-3 text-[15px] leading-snug font-medium text-white",
              selected && "font-semibold",
            )}
          >
            {label}
          </span>
        </span>
      </motion.button>
    );
  }

  // Same card shape as the image tile, so the grid stays uniform while some
  // options still wait for their artwork.
  return (
    <motion.button
      type="button"
      onClick={onClick}
      variants={itemVariants}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.96 }}
      animate={selected ? { opacity: 1, y: 0, scale: [1, 1.04, 1] } : "center"}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "from-accent to-card relative flex aspect-3/4 flex-col overflow-hidden rounded-xl bg-linear-to-b text-left",
        selected && "outline-foreground outline outline-2 outline-offset-2",
      )}
    >
      <span
        className="flex flex-1 items-center justify-center text-4xl opacity-80 sm:text-5xl"
        aria-hidden
      >
        {emoji}
      </span>
      <span
        className={cn(
          "px-3 pb-3 text-sm/snug  font-medium",
          selected && "font-semibold",
        )}
      >
        {label}
      </span>
    </motion.button>
  );
}

/**
 * Deep-link into /catalog with the answers' strongest signals — the same param
 * names parseFilters reads (intensity has no catalog param, so it is omitted).
 */
function catalogHref(
  gender: GenderPick,
  picks: Record<string, string>,
): string {
  const profile = buildProfile(Object.values(picks));
  const params = new URLSearchParams();
  if (gender !== "any") params.set("gender", gender);

  const families = Object.entries(profile.families)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([slug]) => slug);
  if (families.length) params.set("family", families.join(","));

  const [season] = Object.entries(profile.seasons).sort(
    (a, b) => (b[1] ?? 0) - (a[1] ?? 0),
  );
  if (season) params.set("season", season[0]);

  const qs = params.toString();
  return qs ? `/catalog?${qs}` : "/catalog";
}
