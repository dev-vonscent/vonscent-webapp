"use client";

import { AlertCircle, Check, ChevronDown, Circle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { StepStatus } from "./studio-checklist";
import { STUDIO_STEP_LABEL, type StudioStep } from "./studio-model";

const STATUS_LABEL: Record<StepStatus, string> = {
  done: "бэлэн",
  todo: "хийгээгүй",
  attention: "анхаарах зүйлтэй",
};

function StatusIcon({ status }: { status: StepStatus }) {
  if (status === "done") return <Check className="text-success size-4" />;
  if (status === "attention") {
    return <AlertCircle className="text-warning size-4" />;
  }
  return <Circle className="text-muted-foreground size-4" />;
}

/**
 * Студийн алхмууд (studio-ux.md D2, §4.2). Өргөн дэлгэцэд мөр, утсан дээр
 * «3 / 5 · Каталогт харагдах» + жагсаалт. Алхам нь URL-д `replaceState`-ээр
 * бичигддэг (серверийн render өдөөхгүй); сонгогдсон алхамд `transition-colors`
 * байхгүй (CLAUDE.md).
 */
export function StudioStepper({
  steps,
  current,
  statusOf,
  locked,
  onSelect,
}: {
  steps: readonly StudioStep[];
  current: StudioStep;
  statusOf: (step: StudioStep) => StepStatus;
  /** Мөр хараахан үүсээгүй — ①-ээс бусад алхам идэвхгүй. */
  locked: boolean;
  onSelect: (step: StudioStep) => void;
}) {
  const index = steps.indexOf(current);
  return (
    <nav aria-label="Алхмууд">
      <ol className="hidden items-center gap-1 md:flex">
        {steps.map((step, i) => {
          const selected = step === current;
          const status = statusOf(step);
          return (
            <li key={step} className="flex min-w-0 flex-1 items-center gap-1 last:flex-none">
              <button
                type="button"
                disabled={locked && !selected}
                aria-current={selected ? "step" : undefined}
                onClick={() => onSelect(step)}
                className={cn(
                  "inline-flex min-w-0 items-center gap-2 rounded-full px-3 py-2 text-sm font-medium whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50",
                  selected
                    ? "bg-cta text-cta-foreground [&_svg]:text-cta-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                {selected ? (
                  <span
                    aria-hidden
                    className="bg-cta-foreground size-2 shrink-0 rounded-full"
                  />
                ) : (
                  <StatusIcon status={status} />
                )}
                <span className="truncate">{STUDIO_STEP_LABEL[step]}</span>
                <span className="sr-only">
                  {selected ? " — одоо" : ` — ${STATUS_LABEL[status]}`}
                </span>
              </button>
              {i < steps.length - 1 && (
                <span aria-hidden className="bg-border h-px min-w-3 flex-1" />
              )}
            </li>
          );
        })}
      </ol>

      <div className="md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="bg-card field-edge flex h-11 w-full items-center justify-between gap-2 rounded-md px-3 text-sm font-medium"
            >
              <span className="min-w-0 truncate">
                <span className="text-muted-foreground tabular-nums">
                  {index + 1} / {steps.length} ·{" "}
                </span>
                {STUDIO_STEP_LABEL[current]}
              </span>
              <ChevronDown className="text-muted-foreground size-4 shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width)">
            {steps.map((step, i) => (
              <DropdownMenuItem
                key={step}
                disabled={locked && step !== current}
                aria-current={step === current ? "step" : undefined}
                onSelect={() => onSelect(step)}
                className={cn(step === current && "font-semibold")}
              >
                <StatusIcon status={statusOf(step)} />
                <span className="tabular-nums">{i + 1}.</span>
                {STUDIO_STEP_LABEL[step]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
