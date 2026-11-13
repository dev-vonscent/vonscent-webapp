"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/shared/loading-button";
import { useFeatureFlag } from "@/components/feature-flags";
import { UB_TIMEZONE } from "@/lib/time";
import type { SaleEventAdminRow, SaleEventProduct } from "../../types";
import { PhaseBadge } from "../phase-badge";
import { StepBanner } from "./step-banner";
import { StepBasics } from "./step-basics";
import { StepCatalog } from "./step-catalog";
import { StepProducts } from "./step-products";
import { StepReview } from "./step-review";
import {
  openingStep,
  stepStatus,
  type StudioBanner,
} from "./studio-checklist";
import {
  PUBLISH_LABEL,
  REVIEW_HINT_PUBLISHED,
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
  banner,
  initialStep,
  now,
}: {
  row: SaleEventAdminRow | null;
  copyOf?: SaleEventAdminRow | null;
  products: SaleEventProduct[];
  banner: StudioBanner | null;
  initialStep?: string;
  now: number;
}) {
  const router = useRouter();
  const bannerEnabled = useFeatureFlag("hero_admin");
  const studio = useEventStudio({ row, copyOf, banner, bannerEnabled, now });
  const { draft, phase, mode, checklist, busy, dirty } = studio;
  const steps = React.useMemo(() => visibleSteps(bannerEnabled), [bannerEnabled]);
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

  return (
    <div className="space-y-6">
      {studio.confirmDialog}

      <header className="bg-card field-edge sticky top-16 z-30 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg px-4 py-3 lg:top-2">
        <Link
          href={LIST_HREF}
          onClick={(e) => {
            if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
            e.preventDefault();
            void leave();
          }}
          className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" />
          Арга хэмжээ
        </Link>
        <div className="flex min-w-0 flex-1 basis-48 items-center gap-2">
          <h1 className="truncate font-serif text-xl font-semibold">
            {draft.name.trim() || "Шинэ арга хэмжээ"}
          </h1>
          {phase && <PhaseBadge phase={phase} />}
        </div>
        <SaveState studio={studio} />
        {mode === "auto" && (
          <LoadingButton
            type="button"
            size="sm"
            loading={busy === "publish"}
            disabled={busy !== null}
            onClick={() => (step === "review" ? void studio.publish() : go("review"))}
          >
            {PUBLISH_LABEL[action]}
          </LoadingButton>
        )}
        {mode === "manual" && (
          <LoadingButton
            type="button"
            size="sm"
            loading={busy === "save"}
            disabled={!dirty || busy !== null}
            onClick={() => void studio.saveManual()}
          >
            Хадгалах
          </LoadingButton>
        )}
        {mode === "locked" && studio.id && (
          <Button asChild size="sm">
            <Link href={`${LIST_HREF}/new?copy=${studio.id}`}>
              <Copy />
              Хуулж шинээр эхлүүлэх
            </Link>
          </Button>
        )}
      </header>

      <StudioStepper
        steps={steps}
        current={step}
        statusOf={(s) => stepStatus(s, checklist, phase)}
        locked={mode === "create"}
        onSelect={go}
      />

      {mode === "locked" && (
        <p className="border-border bg-muted text-muted-foreground rounded-md border px-3 py-2 text-sm">
          Энэ арга хэмжээ дууссан тул засагдахгүй. Дахин явуулах бол «Хуулж
          шинээр эхлүүлэх»-ээр шинэ ноорог үүсгэнэ үү.
        </p>
      )}
      {mode === "create" && copyOf && (
        <p className="border-border bg-muted text-muted-foreground rounded-md border px-3 py-2 text-sm">
          «{copyOf.name}»-аас бараа, хувь, каталогийн текст хуулагдлаа. Огноогоо
          сонгоод үргэлжлүүлнэ үү.
        </p>
      )}

      <section
        aria-labelledby="studio-step-title"
        className="bg-card space-y-6 rounded-xl p-4 sm:p-6"
      >
        <div className="space-y-1">
          <h2 id="studio-step-title" className="font-serif text-xl font-semibold">
            {STUDIO_STEP_LABEL[step]}
          </h2>
          <p className="text-muted-foreground text-sm">
            {step === "review" && mode !== "auto" && mode !== "create"
              ? REVIEW_HINT_PUBLISHED
              : STUDIO_STEP_HINT[step]}
          </p>
        </div>

        {step === "review" ? (
          <StepReview studio={studio} onGo={go} onLeave={() => void leave()} />
        ) : (
          // Дууссан арга хэмжээ уншихаар нээгдэнэ — бүх талбар идэвхгүй (F1).
          <fieldset disabled={mode === "locked"} className="min-w-0">
            {step === "basics" && <StepBasics studio={studio} />}
            {step === "products" && (
              <StepProducts studio={studio} products={products} />
            )}
            {step === "catalog" && <StepCatalog studio={studio} />}
            {step === "banner" && <StepBanner studio={studio} />}
          </fieldset>
        )}
      </section>

      <div className="flex items-center justify-between gap-3">
        {prev ? (
          <Button type="button" variant="ghost" onClick={() => go(prev)}>
            <ArrowLeft />
            Өмнөх
          </Button>
        ) : (
          <span />
        )}
        {mode === "create" ? (
          <LoadingButton
            type="button"
            loading={busy === "create"}
            onClick={() => void studio.create()}
          >
            Үргэлжлүүлэх
            <ArrowRight />
          </LoadingButton>
        ) : (
          next && (
            <Button type="button" variant="secondary" onClick={() => go(next)}>
              Үргэлжлүүлэх
              <ArrowRight />
            </Button>
          )
        )}
      </div>

      {mode === "manual" && dirty && (
        <div
          role="region"
          aria-label="Хадгалаагүй өөрчлөлт"
          className="bg-card field-edge shadow-lift sticky bottom-4 z-30 flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3"
        >
          <p className="text-sm font-medium">
            Хадгалаагүй өөрчлөлт
            {phase === "live" && (
              <span className="text-muted-foreground font-normal">
                {" "}
                · хадгалмагц дэлгүүрт шууд нөлөөлнө
              </span>
            )}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy !== null}
              onClick={studio.revert}
            >
              Болих
            </Button>
            <LoadingButton
              type="button"
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
      className={`${tone} text-sm tabular-nums`}
      role="status"
      aria-live="polite"
      title={status.kind === "error" ? status.message : undefined}
    >
      {text}
    </p>
  );
}
