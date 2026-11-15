"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, ArrowRight, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/shared/loading-button";
import { useFeatureFlag } from "@/components/feature-flags";
import { UB_TIMEZONE } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { HeroAdminRow, HeroEventOption } from "@/features/heroes/types";
import type { SaleEventAdminRow, SaleEventProduct } from "../../types";
import { PhaseBadge } from "../phase-badge";
import { StepBanner } from "./step-banner";
import { StepBasics } from "./step-basics";
import { StepCatalog } from "./step-catalog";
import { StepProducts } from "./step-products";
import { StepReview } from "./step-review";
import { openingStep, stepStatus } from "./studio-checklist";
import {
  PUBLISH_LABEL,
  REVIEW_HINT_PUBLISHED,
  STUDIO_CTA,
  STUDIO_STEP_HINT,
  STUDIO_STEP_LABEL,
  parseStep,
  publishAction,
  visibleSteps,
  type StudioStep,
} from "./studio-model";
import { StudioStepper } from "./studio-stepper";
import { useEventStudio, type EventStudio } from "./use-event-studio";

const LIST_HREF = "/admin/sale-events";

/**
 * Арга хэмжээний студи (docs/campaigns/studio-ux.md §4.2): нэг арга хэмжээг
 * нэг бүтэн хуудсанд, алхмаар. Хүрээ нь толгой (төлөв + хадгалалтын байдал +
 * гол үйлдэл), stepper, алхмын агуулга, доод чиглүүлэгч. Бизнес логик
 * `useEventStudio` ба цэвэр функцүүдэд.
 */
export function EventStudio({
  row,
  copyOf = null,
  products,
  bannerRow = null,
  copyBanner = null,
  bannerOthers = 0,
  heroes = [],
  heroEvents = [],
  aiConfigured = false,
  initialStep,
  now,
}: {
  row: SaleEventAdminRow | null;
  copyOf?: SaleEventAdminRow | null;
  products: SaleEventProduct[];
  /** Энэ арга хэмжээний баннер (`heroes.sale_event_id`). */
  bannerRow?: HeroAdminRow | null;
  /** `?copy=` — хуулж буй арга хэмжээний баннер. */
  copyBanner?: HeroAdminRow | null;
  /** Хуучин өгөгдөлд энэ арга хэмжээнд холбоотой бусад баннер. */
  bannerOthers?: number;
  /** Бусад баннер, арга хэмжээ — ⑤-д «дуусахад аль баннер гарах» (heroAt). */
  heroes?: HeroAdminRow[];
  heroEvents?: HeroEventOption[];
  /** AI зураг үүсгэх тохиргоотой эсэх (сервер). */
  aiConfigured?: boolean;
  initialStep?: string;
  now: number;
}) {
  const router = useRouter();
  const bannerEnabled = useFeatureFlag("hero_admin");
  const studio = useEventStudio({
    row,
    copyOf,
    bannerRow,
    copyBanner,
    bannerEnabled,
    now,
  });
  const { draft, phase, mode, checklist, busy, dirty } = studio;
  const steps = React.useMemo(
    () => visibleSteps(bannerEnabled),
    [bannerEnabled],
  );
  const [step, setStep] = React.useState<StudioStep>(() =>
    openingStep({
      requested: parseStep(initialStep, steps),
      phase,
      items: checklist,
      steps,
    }),
  );
  const index = steps.indexOf(step);
  const prev = steps[index - 1];
  const next = steps[index + 1];

  function go(to: StudioStep) {
    if (to === step || mode === "create") return;
    // Ноорог: алхам солих бүрт хадгална (D7).
    if (mode === "auto") void studio.autosave();
    setStep(to);
    // Серверийн render өдөөхгүй — зөвхөн URL (D2).
    window.history.replaceState(null, "", `?step=${to}`);
    window.scrollTo({ top: 0 });
  }

  async function leave() {
    if (await studio.confirmLeave()) router.push(LIST_HREF);
  }

  const action = publishAction(draft.startsOn, studio.today);

  const stepNo = index + 1;
  // Алхмын алдаа / анхааруулга (checklist-ээс) — цэг, алхмын дээд мөр.
  // Дууссан (зөвхөн уншигдах) арга хэмжээнд засах зүйл гэж байхгүй.
  const issuesOf = (s: StudioStep) =>
    phase === null || mode === "locked"
      ? []
      : checklist.filter(
          (i) => i.step === s && (i.level === "error" || i.level === "warn"),
        );
  const stepIssues = step === "review" ? [] : issuesOf(step);
  const note = (text: React.ReactNode) => (
    <p className="bg-secondary text-muted-foreground rounded-xl px-4 py-3 text-sm text-pretty">
      {text}
    </p>
  );

  return (
    // Студид талбарын хүрээ байхгүй — дүүргэлтээр л ялгана (алдаатай үед улаан хэвээр).
    <div className="mx-auto max-w-5xl space-y-10 pb-16 [--input-edge:transparent]">
      {studio.confirmDialog}

      {/* Дэвсгэр нь админы `main`-ийнхтэй ижил — тусдаа хайрцаг шиг харагдахгүй.
          white/navy: цул `--admin-page` (globals.css); бусад theme: background +
          `bg-muted/30` давхарга (main-ийнх шиг). */}
      <header className="sticky top-16 isolate z-30 -mx-4 space-y-6 bg-(--admin-page,var(--background)) px-4 pt-2 pb-4 before:absolute before:inset-0 before:-z-10 before:bg-muted/30 in-[.navy]:before:hidden in-[.white]:before:hidden lg:top-0 lg:pt-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <Link
            href={LIST_HREF}
            aria-label="Арга хэмжээний жагсаалт руу буцах"
            onClick={(e) => {
              if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey)
                return;
              e.preventDefault();
              void leave();
            }}
            className="bg-secondary text-muted-foreground hover:text-foreground inline-flex size-10 shrink-0 items-center justify-center rounded-full"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0 flex-1 basis-48">
            <div className="flex min-w-0 items-center gap-2.5">
              <h1 className="truncate font-serif text-2xl font-semibold tracking-tight">
                {draft.name.trim() || "Шинэ арга хэмжээ"}
              </h1>
              {phase && <PhaseBadge phase={phase} />}
            </div>
            <SaveState studio={studio} />
          </div>
          {mode === "auto" && (
            <LoadingButton
              type="button"
              className={STUDIO_CTA}
              loading={busy === "publish"}
              disabled={busy !== null}
              onClick={() =>
                step === "review" ? void studio.publish() : go("review")
              }
            >
              {PUBLISH_LABEL[action]}
            </LoadingButton>
          )}
          {mode === "manual" && (
            <LoadingButton
              type="button"
              className={STUDIO_CTA}
              loading={busy === "save"}
              disabled={!dirty || busy !== null}
              onClick={() => void studio.saveManual()}
            >
              Хадгалах
            </LoadingButton>
          )}
          {mode === "locked" && studio.id && (
            <Button asChild className={STUDIO_CTA}>
              <Link href={`${LIST_HREF}/new?copy=${studio.id}`}>
                <Copy />
                Хуулж шинээр эхлүүлэх
              </Link>
            </Button>
          )}
        </div>

        <StudioStepper
          steps={steps}
          current={step}
          statusOf={(s) =>
            mode === "locked" ? "done" : stepStatus(s, checklist, phase)
          }
          issuesOf={issuesOf}
          locked={mode === "create"}
          onSelect={go}
        />
      </header>

      {mode === "locked" &&
        note(
          "Энэ арга хэмжээ дууссан тул засагдахгүй. Дахин явуулах бол «Хуулж шинээр эхлүүлэх»-ээр шинэ ноорог үүсгэнэ үү.",
        )}
      {mode === "create" &&
        copyOf &&
        note(
          <>
            «{copyOf.name}»-аас бараа, хувь, каталогийн текст
            {copyBanner && bannerEnabled ? ", нүүрний баннер" : ""} хуулагдлаа.
            Огноогоо сонгоод үргэлжлүүлнэ үү.
          </>,
        )}

      <section aria-labelledby="studio-step-title" className="space-y-8">
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs font-medium tracking-[0.15em] uppercase tabular-nums">
            Алхам {stepNo} / {steps.length}
          </p>
          <h2
            id="studio-step-title"
            className="font-serif text-3xl font-semibold tracking-tight text-balance"
          >
            {STUDIO_STEP_LABEL[step]}
          </h2>
          <p className="text-muted-foreground max-w-2xl text-pretty">
            {step === "review" && mode !== "auto" && mode !== "create"
              ? REVIEW_HINT_PUBLISHED
              : STUDIO_STEP_HINT[step]}
          </p>
        </div>

        {stepIssues.length > 0 && (
          <ul role="list" className="space-y-1.5">
            {stepIssues.map((x) => (
              <li
                key={x.text}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium",
                  x.level === "error"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-warning/10 text-warning",
                )}
              >
                <AlertCircle className="size-4 shrink-0" aria-hidden />
                {x.text}
              </li>
            ))}
          </ul>
        )}

        {step === "review" ? (
          <StepReview
            studio={studio}
            heroes={heroes}
            heroEvents={heroEvents}
            onGo={go}
            onLeave={() => void leave()}
          />
        ) : (
          // Дууссан арга хэмжээ уншихаар нээгдэнэ — бүх талбар идэвхгүй (F1).
          <fieldset disabled={mode === "locked"} className="min-w-0">
            {step === "basics" && <StepBasics studio={studio} />}
            {step === "products" && (
              <StepProducts studio={studio} products={products} />
            )}
            {step === "catalog" && (
              <StepCatalog studio={studio} products={products} onGo={go} />
            )}
            {step === "banner" && (
              <StepBanner
                studio={studio}
                products={products}
                others={bannerOthers}
                aiConfigured={aiConfigured}
              />
            )}
          </fieldset>
        )}
      </section>

      {(prev || next || mode === "create") && (
        <nav
          aria-label="Алхам солих"
          className="flex items-center justify-between gap-3 pt-4"
        >
          {prev ? (
            <Button
              type="button"
              variant="ghost"
              className="min-w-0 shrink px-3"
              aria-label={`Өмнөх: ${STUDIO_STEP_LABEL[prev]}`}
              onClick={() => go(prev)}
            >
              <ArrowLeft />
              <span className="hidden sm:inline">
                {STUDIO_STEP_LABEL[prev]}
              </span>
              <span className="sm:hidden">Өмнөх</span>
            </Button>
          ) : (
            <span />
          )}
          {mode === "create" ? (
            <LoadingButton
              type="button"
              size="lg"
              className={STUDIO_CTA}
              loading={busy === "create"}
              onClick={() => void studio.create()}
            >
              Үргэлжлүүлэх
              <ArrowRight />
            </LoadingButton>
          ) : (
            next && (
              <Button
                type="button"
                size="lg"
                className={cn(STUDIO_CTA, "min-w-0 shrink px-5 sm:px-8")}
                onClick={() => go(next)}
              >
                <span className="text-cta-foreground/70 hidden font-normal sm:inline">
                  Дараах:
                </span>
                {STUDIO_STEP_LABEL[next]}
                <ArrowRight />
              </Button>
            )
          )}
        </nav>
      )}

      {mode === "manual" && dirty && (
        <div
          role="region"
          aria-label="Хадгалаагүй өөрчлөлт"
          className="bg-foreground text-background shadow-lift sticky bottom-4 z-30 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-3"
        >
          <p className="text-sm font-medium">
            Хадгалаагүй өөрчлөлт
            {phase === "live" && (
              <span className="font-normal opacity-70">
                {" "}
                · хадгалмагц дэлгүүрт шууд нөлөөлнө
              </span>
            )}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              className="hover:bg-background/10 hover:text-background"
              disabled={busy !== null}
              onClick={studio.revert}
            >
              Болих
            </Button>
            <LoadingButton
              type="button"
              variant="secondary"
              loading={busy === "save"}
              disabled={busy !== null}
              onClick={() => void studio.saveManual()}
            >
              Хадгалах
            </LoadingButton>
          </div>
        </div>
      )}
    </div>
  );
}

function clock(at: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: UB_TIMEZONE,
  }).format(new Date(at));
}

/** Толгойн хадгалалтын байдал — үргэлж харагдана (D7). */
function SaveState({ studio }: { studio: EventStudio }) {
  const { mode, status, dirty } = studio;
  if (mode === "locked") return null;

  let text: React.ReactNode;
  let tone = "text-muted-foreground";
  if (mode === "create") {
    text = "Хараахан хадгалагдаагүй";
  } else if (status.kind === "saving") {
    text = "Хадгалж байна…";
  } else if (status.kind === "error") {
    tone = "text-destructive";
    text = (
      <>
        Хадгалагдсангүй —{" "}
        <button
          type="button"
          className="underline underline-offset-4"
          onClick={() =>
            void (mode === "auto" ? studio.autosave() : studio.saveManual())
          }
        >
          дахин оролдох
        </button>
      </>
    );
  } else if (status.kind === "invalid" && dirty) {
    tone = "text-destructive";
    text = `Хадгалагдаагүй — ${status.message}`;
  } else if (dirty) {
    text = "Хадгалаагүй өөрчлөлт";
  } else if (status.kind === "saved") {
    text = `Хадгалагдлаа · ${clock(status.at)}`;
  } else {
    text = "Хадгалагдсан";
  }
  return (
    <p
      className={`${tone} mt-0.5 text-sm tabular-nums`}
      role="status"
      aria-live="polite"
      title={status.kind === "error" ? status.message : undefined}
    >
      {text}
    </p>
  );
}
