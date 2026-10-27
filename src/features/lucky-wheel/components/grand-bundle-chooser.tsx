"use client";

import * as React from "react";
import Image from "next/image";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import { toast } from "@/lib/toast";
import { CHOOSE_REFUSAL, useChooseBundle } from "../use-wheel";
import type { BundleGender, GrandBundleOption } from "../types";

const GENDER_LABEL: Record<BundleGender, string> = {
  male: "Эрэгтэй",
  female: "Эмэгтэй",
};

/**
 * The two bundles of the grand prize, side by side — pick one. A bundle that
 * cannot be poured at 2ml right now is shown but disabled («Түр дууссан»), so
 * the customer sees what exists rather than a single lonely card.
 */
export function GrandBundleChooser({
  spinId,
  options,
  selected,
  onChosen,
  tone = "stage",
  className,
}: {
  spinId: string;
  options: GrandBundleOption[];
  /** The gender already picked, if any — shown as chosen, still changeable. */
  selected?: BundleGender | null;
  onChosen?: (option: GrandBundleOption) => void;
  /** `gold` = on the grand prize's gold card: dark ink throughout. */
  tone?: "stage" | "gold";
  className?: string;
}) {
  const choose = useChooseBundle();
  const gold = tone === "gold";
  const [pending, setPending] = React.useState<BundleGender | null>(null);

  if (options.length === 0) {
    return (
      <p className={cn("text-muted-foreground text-sm", className)}>
        Багцын сонголт удахгүй нээгдэнэ. Шагнал тань хадгалагдсан байгаа.
      </p>
    );
  }

  const pick = (option: GrandBundleOption) => {
    if (!option.available || choose.isPending) return;
    setPending(option.gender);
    choose.mutate(
      { spinId, gender: option.gender },
      {
        onSuccess: () => onChosen?.(option),
        onError: (err) =>
          toast.error(
            CHOOSE_REFUSAL[err.message] ??
              "Сонголт хадгалагдсангүй. Дахин оролдоно уу.",
          ),
        onSettled: () => setPending(null),
      },
    );
  };

  return (
    <div
      role="radiogroup"
      aria-label="Гранд шагналын багц"
      className={cn("grid gap-3 sm:grid-cols-2", className)}
    >
      {options.map((o) => {
        const isSelected = selected === o.gender;
        return (
          <button
            key={o.gender}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={!o.available || choose.isPending}
            onClick={() => pick(o)}
            className={cn(
              "relative flex flex-col gap-3 rounded-2xl p-4 text-left transition-colors",
              gold
                ? "bg-wheel-ink-dark/8 hover:bg-wheel-ink-dark/14 text-wheel-ink-dark"
                : "bg-foreground/6 hover:bg-foreground/10",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
            style={
              isSelected
                ? {
                    boxShadow: `inset 0 0 0 2px var(${gold ? "--wheel-ink-dark" : "--wheel-gold"})`,
                  }
                : undefined
            }
          >
            <span className="flex items-center gap-3">
              <span
                className={cn(
                  "relative size-12 shrink-0 overflow-hidden rounded-xl",
                  gold ? "bg-wheel-ink-dark/10" : "bg-foreground/8",
                )}
              >
                {o.image && (
                  <Image
                    src={o.image}
                    alt=""
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block text-[0.65rem] font-bold tracking-[0.2em] uppercase",
                    gold ? "text-wheel-ink-dark/60" : "text-wheel-accent",
                  )}
                >
                  {GENDER_LABEL[o.gender]}
                </span>
                <span className="block truncate font-bold">{o.name}</span>
              </span>
              {pending === o.gender ? (
                <Loader2 className="size-5 shrink-0 animate-spin" />
              ) : (
                isSelected && (
                  <span
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-full",
                      gold
                        ? "bg-wheel-ink-dark text-wheel-gold"
                        : "bg-wheel-gold text-wheel-ink-dark",
                    )}
                  >
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                )
              )}
            </span>
            <ul
              className={cn(
                "space-y-0.5 text-xs",
                gold ? "text-wheel-ink-dark/70" : "text-muted-foreground",
              )}
            >
              {o.members.map((m) => (
                <li key={`${m.brand}-${m.name}`} className="truncate">
                  {m.brand ? `${m.brand} — ` : ""}
                  {m.name} · 2мл
                </li>
              ))}
            </ul>
            <span className="text-xs font-semibold">
              {o.available
                ? o.value > 0 && `${formatPrice(o.value)}-ийн үнэ цэнэтэй`
                : "Түр дууссан"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
