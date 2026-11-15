"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChecklistItem, StepStatus } from "./studio-checklist";
import { STUDIO_STEP_LABEL, type StudioStep } from "./studio-model";

const STATUS_LABEL: Record<StepStatus, string> = {
  done: "бэлэн",
  todo: "хийгээгүй",
  attention: "анхаарах зүйлтэй",
};

/**
 * Студийн алхмууд (studio-ux.md D2, §4.2): дугаартай, хүрээгүй. Бэлэн алхам
 * — ✓, алдаатай алхам — улаан цэг, анхааруулгатай — шар цэг (hover дээр
 * шалтгаан), одоогийнх — цул дугуй. Утсан дээр зөвхөн
 * дугуйнууд + одоогийн алхмын нэр. Сонгогдсон алхамд `transition-colors`
 * байхгүй (CLAUDE.md).
 */
export function StudioStepper({
  steps,
  current,
  statusOf,
  issuesOf,
  locked,
  onSelect,
}: {
  steps: readonly StudioStep[];
  current: StudioStep;
  statusOf: (step: StudioStep) => StepStatus;
  /** Алхмын алдаа / анхааруулга — цэгийн өнгө, hover-ын тайлбар. */
  issuesOf: (step: StudioStep) => ChecklistItem[];
  /** Мөр хараахан үүсээгүй — ①-ээс бусад алхам идэвхгүй. */
  locked: boolean;
  onSelect: (step: StudioStep) => void;
}) {
  return (
    <nav aria-label="Алхмууд">
      <ol className="flex items-center gap-2 md:gap-3">
        {steps.map((step, i) => {
          const selected = step === current;
          const status = statusOf(step);
          const issues = issuesOf(step);
          const severe = issues.some((x) => x.level === "error");
          return (
            <li
              key={step}
              className={cn(
                "flex items-center gap-2 md:gap-3",
                i < steps.length - 1 && "flex-1",
              )}
            >
              <button
                type="button"
                disabled={locked && !selected}
                aria-current={selected ? "step" : undefined}
                title={
                  issues.length
                    ? issues.map((x) => `• ${x.text}`).join("\n")
                    : undefined
                }
                onClick={() => onSelect(step)}
                className="group flex shrink-0 items-center gap-2.5 rounded-full py-1 pr-2 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <StepDot
                  n={i + 1}
                  status={status}
                  selected={selected}
                  severe={severe}
                />
                <span
                  className={cn(
                    "hidden text-sm whitespace-nowrap lg:inline",
                    selected
                      ? "text-foreground font-semibold"
                      : "text-muted-foreground group-hover:text-foreground",
                  )}
                >
                  {STUDIO_STEP_LABEL[step]}
                </span>
                <span className="sr-only lg:hidden">
                  {STUDIO_STEP_LABEL[step]}
                </span>
                <span className="sr-only">
                  {selected ? " — одоо" : ` — ${STATUS_LABEL[status]}`}
                  {issues.length > 0 &&
                    `: ${issues.map((x) => x.text).join("; ")}`}
                </span>
              </button>
              {i < steps.length - 1 && (
                <span
                  aria-hidden
                  className="bg-secondary h-0.5 min-w-4 flex-1 rounded-full"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function StepDot({
  n,
  status,
  selected,
  severe,
}: {
  n: number;
  status: StepStatus;
  selected: boolean;
  /** Засахгүй бол нийтлэгдэхгүй алдаа — улаан цэг (анхааруулга — шар). */
  severe: boolean;
}) {
  const base =
    "relative inline-flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums";
  if (selected) {
    return <span className={cn(base, "bg-cta text-cta-foreground")}>{n}</span>;
  }
  if (status === "done") {
    return (
      <span className={cn(base, "bg-secondary text-foreground")}>
        <Check className="size-4" strokeWidth={2.5} />
      </span>
    );
  }
  return (
    <span
      className={cn(
        base,
        "bg-secondary text-muted-foreground group-hover:text-foreground",
      )}
    >
      {n}
      {status === "attention" && (
        <span
          className={cn(
            "ring-background absolute -top-0.5 -right-0.5 size-2.5 rounded-full ring-2",
            severe ? "bg-destructive" : "bg-warning",
          )}
        />
      )}
    </span>
  );
}
