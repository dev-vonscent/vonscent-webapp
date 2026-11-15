"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, ArrowRight, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/shared/loading-button";
import { Tooltip } from "@/components/shared/tooltip";
import { toast } from "@/lib/toast";
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
import { hasBlocking, openingStep, stepStatus } from "./studio-checklist";
import {
  PUBLISH_LABEL,
  REVIEW_HINT_PUBLISHED,
  STUDIO_CTA,
  STUDIO_STEP_HINT,
  STUDIO_STEP_LABEL,
  parseStep,
  productsStepBlock,
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
  const { draft, phase, mode, checklist, busy, dirty, published } = studio;
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

  // Шинэ ноорог: ②-т хувьгүй / буруу хувьтай бараа байвал цааш явахгүй
  // (сонгосон бараа бүр хямдрах ёстой). Нийтэлсэн арга хэмжээг Zod хамгаална.
  const productsBlock =
    mode === "auto" && step === "products"
      ? productsStepBlock(draft.items)
      : null;

  function go(to: StudioStep) {
    if (to === step || mode === "create") return;
    if (productsBlock && steps.indexOf(to) > steps.indexOf(step)) {
      toast.error(productsBlock, "Цааш явах боломжгүй");
      return;
    }
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
    <p className="bg-secondary text-muted-foreground rounded-lg px-4 py-2.5 text-sm text-pretty">
      {text}
    </p>
  );

  const isReview = step === "review";
  const publishBlocked = isReview && hasBlocking(checklist);

  return (
    // Студид талбарын хүрээ байхгүй — дүүргэлтээр л ялгана (алдаатай үед улаан хэвээр).
    <div className="mx-auto max-w-5xl space-y-2 pb-6 [--input-edge:transparent]">
      {studio.confirmDialog}

      {/* Нэг нягт толгой: буцах · нэр · төлөв · хадгалалт, доор нь stepper.
          Хэмнэл: дээд ирмэг → толгой → stepper → алхмын гарчиг — бүгд 16px
          (`main`-ийн py-8-ыг -mt-8-аар нөхнө). Дэвсгэр нь админы
          `main`-ийнхтэй ижил (white/navy: `--admin-page`). */}
      <header className="before:bg-muted/30 sticky top-16 isolate z-30 -mx-4 -mt-8 space-y-4 bg-(--admin-page,var(--background)) px-4 pt-4 pb-2 before:absolute before:inset-0 before:-z-10 in-[.navy]:before:hidden in-[.white]:before:hidden lg:top-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Link
            href={LIST_HREF}
            aria-label="Арга хэмжээний жагсаалт руу буцах"
            onClick={(e) => {
              if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey)
                return;
              e.preventDefault();
              void leave();
            }}
            className="bg-secondary text-muted-foreground hover:text-foreground inline-flex size-9 shrink-0 items-center justify-center rounded-full"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="flex min-w-0 flex-1 basis-48 flex-wrap items-center gap-x-2.5 gap-y-0.5">
            <h1 className="truncate text-lg font-semibold tracking-tight">
              {draft.name.trim() || "Шинэ арга хэмжээ"}
            </h1>
            {phase && <PhaseBadge phase={phase} />}
            <SaveState studio={studio} />
          </div>
          {mode === "locked" && studio.id && (
            <Button asChild size="sm" className={STUDIO_CTA}>
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

      <section aria-labelledby="studio-step-title" className="space-y-5">
        <div className="space-y-1">
          <h2
            id="studio-step-title"
            className="text-xl font-semibold tracking-tight text-balance"
          >
            <span className="sr-only">
              Алхам {stepNo} / {steps.length}:{" "}
            </span>
            {STUDIO_STEP_LABEL[step]}
          </h2>
          <p className="text-muted-foreground max-w-2xl text-sm text-pretty">
            {isReview && mode !== "auto" && mode !== "create"
              ? REVIEW_HINT_PUBLISHED
              : STUDIO_STEP_HINT[step]}
          </p>
        </div>

        {stepIssues.length > 0 && (
          <ul role="list" className="space-y-1">
            {stepIssues.map((x) => (
              <li
                key={x.text}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium",
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

        {isReview ? (
          <StepReview
            studio={studio}
            products={products}
            heroes={heroes}
            heroEvents={heroEvents}
            onGo={go}
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

      {/* Доод action bar — алхам солих, хадгалах, нийтлэх нэг газар, үргэлж
          харагдана. Нийтэлсний дараах амжилтын карт өөрөө холбоостой. */}
      {!(isReview && published) && (
        <nav
          aria-label="Алхам солих"
          className="bg-card/85 shadow-lift sticky bottom-4 z-30 mt-8! flex flex-wrap items-center gap-2 rounded-2xl p-2 backdrop-blur"
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
              <span className="hidden sm:inline">Өмнөх</span>
            </Button>
          ) : null}

          <p
            role="status"
            className={cn(
              "min-w-0 flex-1 px-2 text-sm text-pretty",
              productsBlock || publishBlocked
                ? "text-destructive"
                : "text-muted-foreground",
            )}
          >
            {productsBlock ??
              (mode === "manual" && dirty ? (
                <>
                  <span className="text-foreground font-medium">
                    Хадгалаагүй өөрчлөлт
                  </span>
                  {phase === "live" && " · хадгалмагц дэлгүүрт шууд нөлөөлнө"}
                </>
              ) : publishBlocked && mode === "auto" ? (
                "Нийтлэхийн өмнө улаан мөрүүдийг засна уу."
              ) : (
                <span className="tabular-nums">
                  {stepNo} / {steps.length}
                </span>
              ))}
          </p>

          {mode === "manual" && dirty && (
            <>
              <Button
                type="button"
                variant="ghost"
                disabled={busy !== null}
                onClick={studio.revert}
              >
                Болих
              </Button>
              <LoadingButton
                type="button"
                className={STUDIO_CTA}
                loading={busy === "save"}
                disabled={busy !== null}
                onClick={() => void studio.saveManual()}
              >
                Хадгалах
              </LoadingButton>
            </>
          )}

          {mode === "create" && (
            <LoadingButton
              type="button"
              className={STUDIO_CTA}
              loading={busy === "create"}
              onClick={() => void studio.create()}
            >
              Үргэлжлүүлэх
              <ArrowRight />
            </LoadingButton>
          )}

          {mode === "auto" && isReview && (
            <>
              <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => void leave()}
              >
                Ноорог хэвээр үлдээх
              </Button>
              <LoadingButton
                type="button"
                className={STUDIO_CTA}
                loading={busy === "publish"}
                disabled={publishBlocked || busy !== null}
                onClick={() => void studio.publish()}
              >
                {PUBLISH_LABEL[action]}
              </LoadingButton>
            </>
          )}

          {mode !== "create" && next && (
            <Button
              type="button"
              variant={
                mode === "auto" && !productsBlock ? "default" : "secondary"
              }
              className={cn(
                "min-w-0 shrink",
                mode === "auto" && !productsBlock && STUDIO_CTA,
              )}
              disabled={productsBlock !== null}
              aria-label={`Дараах: ${STUDIO_STEP_LABEL[next]}`}
              onClick={() => go(next)}
            >
              <span className="truncate">{STUDIO_STEP_LABEL[next]}</span>
              <ArrowRight />
            </Button>
          )}
        </nav>
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
  const line = (
    <p
      className={`${tone} text-xs tabular-nums`}
      role="status"
      aria-live="polite"
    >
      {text}
    </p>
  );
  return status.kind === "error" ? (
    <Tooltip content={status.message} align="start">
      {line}
    </Tooltip>
  ) : (
    line
  );
}
