"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
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

export function ScentQuiz() {
  const [phase, setPhase] = React.useState<Phase>("intro");
  const [step, setStep] = React.useState(0);
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

  function skip() {
    const question = QUIZ_QUESTIONS[step - 1];
    const next = { ...picks };
    if (question) delete next[question.id];
    setPicks(next);
    if (step + 1 < TOTAL_STEPS) setStep(step + 1);
    else void submit(gender, next);
  }

  function back() {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    if (step === 0) setPhase("intro");
    else setStep(step - 1);
  }

  function restart() {
    setPicks({});
    setGender("any");
    setResult(null);
    setStep(0);
    setPhase("quiz");
  }

  const question = step > 0 ? QUIZ_QUESTIONS[step - 1] : null;

  return (
    <div className="border-border bg-card relative overflow-hidden rounded-2xl border">
      {phase === "intro" && (
        <div className="relative grid md:grid-cols-[1fr_320px]">
          {/* Side imagery (5c) — bleeds to the card edge and fades into the
              bg-card surface; a warm CSS glow stands in until
              public/quiz-side.png is generated (prompts/quiz-options.md). */}
          <SideImage
            src="/quiz-side.png"
            sizes="(max-width: 768px) 100vw, 320px"
            className="relative aspect-[5/2] min-h-[280px] w-full md:order-2 md:aspect-auto md:min-h-0"
            fallbackClassName="bg-[radial-gradient(ellipse_65%_70%_at_65%_55%,rgba(92,62,28,.55),rgba(40,28,14,.2)_55%,transparent_80%)]"
          >
            {/* fade into the card surface: upward on mobile, leftward on md+ */}
            <div className="from-card absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t to-transparent md:hidden" />
            <div className="from-card absolute inset-y-0 left-0 hidden w-1/2 bg-gradient-to-r to-transparent md:block" />
          </SideImage>

          <div className="flex flex-col items-start justify-center gap-4 p-6 sm:p-10 md:order-1">
            <p className="text-muted-foreground text-sm font-medium tracking-[0.2em] uppercase">
              Богино асуулга
            </p>
            <h2 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
              Үнэрээ ол
            </h2>
            <p className="text-muted-foreground">
              Аль үнэрийг сонгохоо мэдэхгүй байна уу? Хэдхэн хөгжилтэй асуултад
              хариулаад өөрт тань хамгийн сайн тохирох үнэртнүүдийг олоорой.
            </p>
            <p className="text-muted-foreground text-sm font-medium">
              {TOTAL_STEPS} асуулт · 30 секунд
            </p>
            <Button onClick={() => setPhase("quiz")} className="mt-2">
              Эхэлцгээе <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {phase === "quiz" && (
        <div className="relative min-h-[300px] p-6 sm:p-10">
          <div className="mb-6 flex items-center justify-between">
            <button
              type="button"
              onClick={back}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm transition-colors"
            >
              <ArrowLeft className="size-4" /> Өмнөх
            </button>
            <div className="flex items-center gap-1.5" aria-hidden>
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === step
                      ? "bg-gold-strong w-6"
                      : i < step
                        ? "bg-gold-strong/50 w-1.5"
                        : "bg-border w-1.5",
                  )}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={skip}
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              Алгасах
            </button>
          </div>

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
        </div>
      )}

      {phase === "loading" && (
        <div className="relative p-6 sm:p-10">
          <p className="text-muted-foreground mb-6 font-serif text-xl">
            Танд тохирох үнэрийг хайж байна…
          </p>
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-[44%] shrink-0 sm:w-[31%] lg:w-[23.5%]">
                <Skeleton className="aspect-[3/4] rounded-xl" />
                <Skeleton className="mt-3 h-4 w-3/4" />
                <Skeleton className="mt-2 h-4 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      )}

      {phase === "results" && result && (
        <div className="relative p-6 sm:p-10">
          <h3 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">
            Танд тохирох үнэртнүүд
          </h3>
          <p className="text-muted-foreground mt-1 mb-6 text-sm">
            {result.fallback
              ? "Яг таарсан үнэр олдсонгүй тул хамгийн эрэлттэй үнэртнүүдийг санал болгож байна."
              : "Таны хариултад үндэслэн сонголоо."}
          </p>
          {result.items.length > 0 ? (
            <ProductCarousel products={result.items} />
          ) : (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Одоогоор санал болгох үнэртэн олдсонгүй.
            </p>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={restart}>
              <RotateCcw className="size-4" /> Дахин эхлэх
            </Button>
            <Link
              href={catalogHref(gender, picks)}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm font-medium transition-colors hover:underline"
            >
              Бүгдийг каталогоос харах <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      )}

      {phase === "error" && (
        <div className="relative flex flex-col items-start gap-4 p-6 sm:p-10">
          <p className="text-muted-foreground">
            Уучлаарай, алдаа гарлаа. Дахин оролдоно уу.
          </p>
          <Button variant="outline" onClick={() => submit(gender, picks)}>
            Дахин оролдох
          </Button>
        </div>
      )}
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
      <h3 className="mb-6 font-serif text-xl font-semibold tracking-tight sm:text-2xl">
        {title}
      </h3>
      <div
        className={cn(
          "grid grid-cols-2 gap-3",
          columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-4",
        )}
      >
        {children}
      </div>
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
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "group hover:shadow-soft relative aspect-[3/4] overflow-hidden rounded-xl text-left transition-all hover:-translate-y-0.5",
          selected && "ring-foreground ring-2 ring-inset",
        )}
      >
        <Image
          src={image}
          alt=""
          fill
          sizes="(max-width: 640px) 50vw, 220px"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          onError={() => setImgFailed(true)}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 to-transparent"
          aria-hidden
        />
        <span
          className={cn(
            "absolute inset-x-0 bottom-0 p-3 text-sm leading-snug font-medium text-white",
            selected && "font-semibold",
          )}
        >
          {label}
        </span>
      </button>
    );
  }

  // Same card shape as the image tile, so the grid stays uniform while some
  // options still wait for their artwork.
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "hover:shadow-soft relative flex aspect-[3/4] flex-col overflow-hidden rounded-xl bg-gradient-to-b from-accent to-card text-left transition-all hover:-translate-y-0.5",
        selected && "ring-foreground ring-2 ring-inset",
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
          "px-3 pb-3 text-sm leading-snug font-medium",
          selected && "font-semibold",
        )}
      >
        {label}
      </span>
    </button>
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
