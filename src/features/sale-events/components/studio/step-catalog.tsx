"use client";

import * as React from "react";
import {
  SALE_EVENT_DEFAULT_BADGE,
  SALE_EVENT_TICKER_DEFAULT,
  SALE_EVENT_TICKER_LABEL,
  SALE_EVENT_TICKER_THEMES,
  type SaleEventTickerTheme,
} from "@/lib/constants";
import { Tooltip } from "@/components/shared/tooltip";
import { cn } from "@/lib/utils";
import type { SaleEventProduct } from "../../types";
import { CatalogPreview, PreviewMarker } from "./catalog-preview";
import { previewCards, previewDuration } from "./catalog-preview-model";
import type { StudioStep } from "./studio-model";
import type { EventStudio } from "./use-event-studio";

/** Харагдац дээрх дугаартай цэгүүд — богино нэр + tooltip (§5.3). */
const LEGEND: { label: string; tip: string }[] = [
  { label: "Зурвасын гарчиг", tip: "Хоосон бол арга хэмжээний нэр гарна." },
  {
    label: "Тоолуур",
    tip: "Дарж харуулах / нуух. Дэлгүүрт секунд тутам гүйнэ.",
  },
  {
    label: "Шүүлтүүрийн нэр",
    tip: "Арга хэмжээний нэр. Утсан дээр «Шүүлтүүр» цэсэд.",
  },
  {
    label: "Картын тэмдэг",
    tip: `Хоосон бол хямдарсан бараанд «${SALE_EVENT_DEFAULT_BADGE}».`,
  },
];

/**
 * ③ Каталогт харагдах (studio-ux.md §5.3, D4): каталогийн жишээ харагдац
 * дээр текстээ газар дээр нь засна — тусдаа input байхгүй.
 */
export function StepCatalog({
  studio,
  products,
  onGo,
}: {
  studio: EventStudio;
  products: SaleEventProduct[];
  onGo: (step: StudioStep) => void;
}) {
  const { draft, errors, mode } = studio;
  const byId = React.useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );
  const cards = React.useMemo(
    () => previewCards(draft.items, byId),
    [draft.items, byId],
  );
  const fieldErrors = [errors.name, errors.headline, errors.badgeLabel].filter(
    Boolean,
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <ol
          aria-label="Засах хэсгүүд"
          className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm"
        >
          {LEGEND.map((x, i) => (
            <li key={x.label}>
              <Tooltip content={x.tip} align={i === 0 ? "start" : "center"}>
                <span
                  tabIndex={0}
                  className="text-muted-foreground hover:text-foreground inline-flex cursor-default items-center gap-1.5 rounded-full"
                >
                  <PreviewMarker n={i + 1} />
                  {x.label}
                </span>
              </Tooltip>
            </li>
          ))}
        </ol>
        <TickerThemePicker
          value={draft.tickerTheme ?? SALE_EVENT_TICKER_DEFAULT}
          disabled={mode === "locked"}
          onChange={(tickerTheme) => studio.patch({ tickerTheme })}
        />
      </div>

      <CatalogPreview
        tickerTheme={draft.tickerTheme ?? SALE_EVENT_TICKER_DEFAULT}
        name={draft.name}
        headline={draft.headline}
        badgeLabel={draft.badgeLabel}
        showCountdown={draft.showCountdown}
        countdownMs={previewDuration(draft.startsOn, draft.endsOn)}
        cards={cards}
        nameInvalid={!draft.name.trim() || Boolean(errors.name)}
        disabled={mode === "locked"}
        onName={studio.setName}
        onHeadline={(headline) => studio.patch({ headline })}
        onBadgeLabel={(badgeLabel) => studio.patch({ badgeLabel })}
        onShowCountdown={(showCountdown) => studio.patch({ showCountdown })}
        onPickProducts={() => onGo("products")}
      />

      {fieldErrors.map((message) => (
        <p
          key={message}
          className="bg-destructive/10 text-destructive rounded-lg px-4 py-2.5 text-sm"
          role="alert"
        >
          {message}
        </p>
      ))}
    </div>
  );
}

/**
 * Дээд гүйдэг зурвасын өнгө — бэлэн хослолууд (`[data-ticker]`, globals.css).
 * Дээж бүр тэр өнгөөрөө: дэвсгэр + «Aa» (гарчиг) + цэг (тоолуур).
 */
function TickerThemePicker({
  value,
  disabled,
  onChange,
}: {
  value: SaleEventTickerTheme;
  disabled?: boolean;
  onChange: (theme: SaleEventTickerTheme) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <p id="ticker-theme-label" className="text-muted-foreground text-sm">
        Зурвасын өнгө
      </p>
      <div
        role="radiogroup"
        aria-labelledby="ticker-theme-label"
        className="flex flex-wrap gap-1.5"
      >
        {SALE_EVENT_TICKER_THEMES.map((t) => {
          const selected = t === value;
          return (
            <Tooltip key={t} content={SALE_EVENT_TICKER_LABEL[t]} align="end">
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={SALE_EVENT_TICKER_LABEL[t]}
                disabled={disabled}
                data-ticker={t}
                onClick={() => onChange(t)}
                className={cn(
                  "bg-announce text-announce-foreground font-condensed relative inline-flex size-8 items-center justify-center rounded-full text-xs font-semibold outline-offset-2 disabled:opacity-50",
                  selected
                    ? "outline-foreground outline-2"
                    : "hover:opacity-90",
                )}
              >
                Aa
                <span
                  aria-hidden
                  className="bg-announce-accent ring-announce absolute top-0.5 right-0.5 size-2 rounded-full ring-2"
                />
              </button>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
