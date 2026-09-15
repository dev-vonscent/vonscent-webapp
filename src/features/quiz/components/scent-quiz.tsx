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
import { rateLimitMessage } from "@/lib/rate-limit-client";
import { GENDER_QUESTION, QUIZ_QUESTIONS } from "../questions";
import type { QuizOption } from "../questions";

/**
 * "Үнэрээ ол" — the home page scent quiz. Runs entirely on the client so the
 * ISR home page stays cacheable; matching happens in POST /api/quiz once the
 * last question is answered.
 */

type Phase = "intro" | "quiz" | "loading" | "results" | "error";
type GenderPick = "male" | "female" | "any";

const TOTAL_STEPS = 1 + QUIZ_QUESTIONS.length;

/**
 * Answers survive a trip to a product page and back.
 *
 * The widget is client state on an ISR home page, so opening a recommendation
 * and pressing back used to remount it at the intro — the visitor's six
 * answers gone for the sake of one look at a bottle, which is the single most
 * likely thing they do next. sessionStorage (not localStorage) scopes that
 * memory to the tab: coming back tomorrow should be a fresh quiz, not last
 * week's answers.
 *
 * Only the ANSWERS are stored. The matches themselves are re-fetched on
 * restore, because prices, stock and the catalogue itself move.
 */
const ANSWERS_KEY = "vonscent:quiz-answers";

interface StoredAnswers {
  gender: GenderPick;
  picks: Record<string, string>;
}

/** Storage throws in private modes and can hold anything — never trust it. */
function readStoredAnswers(): StoredAnswers | null {
  try {
    const raw = sessionStorage.getItem(ANSWERS_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const { gender, picks } = parsed as Partial<StoredAnswers>;
    if (gender !== "male" && gender !== "female" && gender !== "any")
      return null;
    if (!picks || typeof picks !== "object") return null;
    // Only a COMPLETE set restores: a half-finished quiz has no results to
    // return to, and dropping someone mid-run is worse than starting over.
    const answered = QUIZ_QUESTIONS.filter(
      (q) => typeof picks[q.id] === "string",
    );
    if (answered.length !== QUIZ_QUESTIONS.length) return null;
    return { gender, picks };
  } catch {
    return null;
  }
}

function writeStoredAnswers(answers: StoredAnswers): void {
  try {
    sessionStorage.setItem(ANSWERS_KEY, JSON.stringify(answers));
  } catch {
    // Storage full or blocked — the quiz simply won't survive the round trip.
  }
}

function clearStoredAnswers(): void {
  try {
    sessionStorage.removeItem(ANSWERS_KEY);
  } catch {
    // ignore
  }
}

/**
 * Every tile URL a step will show, gender variants included.
 *
 * `step` 0 is the gender question; 1..n are QUIZ_QUESTIONS in order — the same
 * numbering the widget's own `step` state uses.
 */
function stepImages(step: number, gender: GenderPick): string[] {
  if (step === 0)
    return GENDER_QUESTION.options.map((o) => o.image).filter(Boolean);
  const question = QUIZ_QUESTIONS[step - 1];
  if (!question) return [];
  return question.options
    .map((o) => tileImage(o, gender))
    .filter((src): src is string => Boolean(src));
}

/** One definition, so the preloader and the tile ask for the same file. */
const TILE_SIZES = "(max-width: 640px) 50vw, 190px";

/**
 * Warms the browser cache for the step after this one.
 *
 * The tiles are full-bleed photographs, so on a first visit each question used
 * to sit blank for a second or two while its four images downloaded — a pause
 * the visitor spends staring at empty cards right after making a choice. One
 * step of lookahead hides it: answering takes longer than the fetch.
 *
 * It mounts real <Image> elements rather than assigning to `new Image().src`,
 * because the tiles are served through the Next image optimizer — a raw
 * `/quiz/x.webp` fetch would warm a URL the tile never requests and download
 * everything twice. Same `sizes`, same srcset, same chosen candidate.
 *
 * `fetchPriority="low"` keeps the lookahead behind the step actually on
 * screen: these are for a question the visitor has not reached yet, so they
 * must never compete for bandwidth with the tiles being looked at.
 */
function TilePreloader({ sources }: { sources: string[] }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute size-px overflow-hidden opacity-0"
    >
      {sources.map((src) => (
        <Image
          key={src}
          src={src}
          alt=""
          width={1}
          height={1}
          sizes={TILE_SIZES}
          loading="eager"
          fetchPriority="low"
        />
      ))}
    </span>
  );
}

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

export function ScentQuiz() {
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
  /**
   * Алдааны тайлбар. Ихэвчлэн null — тэр үед ерөнхий «алдаа гарлаа» гарна.
   * Хүсэлтийн хязгаарт (429) хүрэхэд сервер хэдэн секундын дараа гэдгийг
   * хэлдэг тул түүнийг нь дамжуулна: «Дахин оролдох» товч тэр хооронд
   * дахиад л бүтэхгүй учраас товчийг ч нуухад хэрэглэнэ.
   */
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
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
      setErrorMsg(null);
      writeStoredAnswers({ gender: finalGender, picks: finalPicks });
      try {
        const res = await fetch("/api/quiz", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gender: finalGender,
            picks: Object.values(finalPicks),
          }),
        });
        const limited = await rateLimitMessage(res);
        if (limited) {
          setErrorMsg(limited);
          setPhase("error");
          return;
        }
        if (!res.ok) throw new Error("quiz_failed");
        setResult(await res.json());
        setPhase("results");
      } catch {
        setPhase("error");
      }
    },
    [],
  );

  // Back from a product page: pick the answers up and ask for fresh matches.
  React.useEffect(() => {
    const stored = readStoredAnswers();
    if (!stored) return;
    setGender(stored.gender);
    setPicks(stored.picks);
    setStep(TOTAL_STEPS - 1);
    void submit(stored.gender, stored.picks);
    // Runs once on mount; `submit` is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    clearStoredAnswers();
    setPicks({});
    setGender("any");
    setResult(null);
    setStep(0);
    setDir(1);
    setPhase("quiz");
  }

  /**
   * Artwork for the step after the visible one. The intro warms the gender
   * tiles; every question warms the next. Nothing is preloaded once the quiz
   * is over.
   */
  const preloadSources = React.useMemo(() => {
    if (phase === "intro") return stepImages(0, gender);
    if (phase === "quiz") return stepImages(step + 1, gender);
    return [];
  }, [phase, step, gender]);

  const question = step > 0 ? QUIZ_QUESTIONS[step - 1] : null;

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="force-black border-border bg-card relative overflow-hidden rounded-2xl border"
      >
        <TilePreloader sources={preloadSources} />
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
                  public/quiz-side.webp is generated (prompts/quiz-options.md). */}
              <SideImage
                src="/quiz-side.webp"
                sizes="(max-width: 768px) 100vw, 320px"
                className="relative aspect-5/2 min-h-70 w-full md:order-2 md:aspect-auto md:min-h-0"
                fallbackClassName="bg-[radial-gradient(ellipse_65%_70%_at_65%_55%,rgba(92,62,28,.55),rgba(40,28,14,.2)_55%,transparent_80%)]"
              >
                {/* fade into the card surface — md+ only; on mobile the image keeps
                    its full-bleed edge (a vertical fade washed it out in light mode) */}
                <div className="from-card absolute inset-y-0 left-0 hidden w-1/2 bg-linear-to-r to-transparent md:block" />
              </SideImage>

              <motion.div
                variants={listVariants}
                initial="enter"
                animate="center"
                className="flex min-w-0 flex-col items-start justify-center gap-4 p-6 sm:p-10 md:order-1"
              >
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
                  Ямар үнэртэй ус сонгохоо мэдэхгүй байна уу? Хэдхэн асуултад
                  хариулаад тохирох үнэртнүүдээ олоорой.
                </motion.p>
                <motion.p
                  variants={itemVariants}
                  className="text-muted-foreground text-sm font-medium"
                >
                  {TOTAL_STEPS} асуулт · 30 секунд
                </motion.p>
                <motion.div variants={itemVariants}>
                  <Button onClick={() => setPhase("quiz")} className="mt-2">
                    Эхлэх <ArrowRight className="size-4" />
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
                          image={tileImage(o, gender)}
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
                {/* The old "see them all in the catalogue" link deep-linked
                    into hard filters (top families + top season), which is a
                    different question from the weighted match this rail shows
                    — the two lists disagreed. The rail is the whole answer
                    now, and the answers survive a trip to a product page.
                    A plain catalogue link survives only where the quiz has no
                    answer of its own to express: a fallback rail or an empty
                    one would otherwise leave "Дахин эхлэх" as the only way
                    out. It carries no filters, so nothing can disagree. */}
                <Button variant="outline" onClick={restart}>
                  <RotateCcw className="size-4" /> Дахин эхлэх
                </Button>
                {(result.fallback || result.items.length === 0) && (
                  <Link
                    href="/catalog"
                    className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm font-medium transition-colors hover:underline"
                  >
                    Каталогоос үзэх <ArrowRight className="size-4" />
                  </Link>
                )}
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
                {errorMsg ?? "Уучлаарай, алдаа гарлаа. Дахин оролдоно уу."}
              </p>
              {!errorMsg && (
                <Button variant="outline" onClick={() => submit(gender, picks)}>
                  Дахин оролдох
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </MotionConfig>
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

/**
 * Artwork for a tile: options shot in both genders follow the visitor's first
 * answer, so the «Өрөөнд орж ирэнгүүт анзаарагдана» card doesn't show a
 * model of the other gender. «Unisex» gets the female cut (questions.ts).
 */
function tileImage(o: QuizOption, gender: GenderPick): string | undefined {
  if (!o.imagesByGender) return o.image;
  return gender === "male" ? o.imagesByGender.male : o.imagesByGender.female;
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
  // A tile whose photograph hasn't arrived shows the card surface pulsing
  // rather than an empty hole: on a first visit the four images of a step land
  // together, and blank cards read as "nothing happened" right after a tap.
  const [imgLoaded, setImgLoaded] = React.useState(false);

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
        className={cn("group relative aspect-3/4 rounded-xl text-left")}
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
        <span className="bg-card absolute inset-0 transform-[translateZ(0)] overflow-hidden rounded-xl [clip-path:inset(1px_round_calc(var(--radius-xl)-1px))] backface-hidden">
          {/* Sits under the photo and fades out with it, so a cached image
              (going back a step) never flashes a placeholder. */}
          <span
            aria-hidden
            className={cn(
              "bg-muted absolute inset-0 transition-opacity duration-300",
              imgLoaded ? "opacity-0" : "animate-pulse opacity-100",
            )}
          />
          <Image
            src={image}
            alt=""
            fill
            sizes={TILE_SIZES}
            // The transparent outline nudges the engine into cleaner edge
            // anti-aliasing while the ancestor scales.
            className={cn(
              "object-cover transition-opacity duration-300 [outline:1px_solid_transparent]",
              imgLoaded ? "opacity-100" : "opacity-0",
            )}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgFailed(true)}
          />
          {/* Scrim, not a plain two-stop gradient: text over a photograph is
              the most common contrast failure there is (NN/g), and the tiles
              run over sand, cream sky and snow. The extra stops approximate an
              ease-out ramp — a linear one bands visibly across a 60% tall box
              and gives up its density too early, right where the label sits.
              -bottom-px: overlap the clip edge so subpixel rounding never
              exposes a bright image row beneath the scrim. */}
          <span
            className="absolute inset-x-0 -bottom-px h-[62%] bg-[linear-gradient(to_top,rgb(0_0_0/0.92)_0%,rgb(0_0_0/0.85)_22%,rgb(0_0_0/0.6)_45%,rgb(0_0_0/0.3)_68%,rgb(0_0_0/0.1)_85%,transparent_100%)]"
            aria-hidden
          />
          <span
            className={cn(
              // The shadow is the second line of defence: it keeps the label
              // readable even where a bright subject reaches the bottom edge.
              "absolute inset-x-0 bottom-0 p-3.5 pr-3 text-[15px] leading-snug font-semibold text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.55)]",
              selected && "[text-shadow:0_1px_4px_rgb(0_0_0/0.7)]",
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
          "px-3 pb-3 text-sm/snug font-medium",
          selected && "font-semibold",
        )}
      >
        {label}
      </span>
    </motion.button>
  );
}

