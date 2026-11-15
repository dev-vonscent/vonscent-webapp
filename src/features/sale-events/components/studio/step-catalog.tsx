"use client";

import * as React from "react";
import {
  SALE_EVENT_DEFAULT_BADGE,
  SALE_EVENT_TICKER_DEFAULT,
  SALE_EVENT_TICKER_LABEL,
  SALE_EVENT_TICKER_THEMES,
  type SaleEventTickerTheme,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { SaleEventProduct } from "../../types";
import { CatalogPreview, PreviewMarker } from "./catalog-preview";
import { previewCards, previewDuration } from "./catalog-preview-model";
import type { StudioStep } from "./studio-model";
import type { EventStudio } from "./use-event-studio";

/** Харагдац дээрх дугаартай цэгүүдийн тайлбар (§5.3). */
const LEGEND = [
  "Дээд зурвасын гарчиг — хоосон бол арга хэмжээний нэр",
  "Тоолуур — секунд тутам гүйнэ; дарж асаах / унтраах",
  "Шүүлтүүрийн товч — арга хэмжээний нэр",
  `Барааны картын тэмдэг — хоосон бол хямдарсан бараанд «${SALE_EVENT_DEFAULT_BADGE}»`,
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
    <div className="space-y-6">
      <TickerThemePicker
        value={draft.tickerTheme ?? SALE_EVENT_TICKER_DEFAULT}
        disabled={mode === "locked"}
        onChange={(tickerTheme) => studio.patch({ tickerTheme })}
      />
      <div className="space-y-3">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.15em] uppercase">
          Каталог · урьдчилсан харагдац
        </p>
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
      </div>
      {fieldErrors.map((message) => (
        <p
          key={message}
          className="bg-destructive/10 text-destructive rounded-xl px-4 py-3 text-sm"
          role="alert"
        >
          {message}
        </p>
      ))}
      <div className="space-y-3">
        <p className="text-sm font-medium">Дугаартай хэсэг дээр дарж засна</p>
        <ol className="text-muted-foreground grid gap-x-8 gap-y-2.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {LEGEND.map((text, i) => (
            <li key={text} className="flex items-start gap-2.5">
              <span className="flex h-lh items-center">
                <PreviewMarker n={i + 1} />
              </span>
              <span className="text-pretty">{text}</span>
            </li>
          ))}
        </ol>
        <p className="text-muted-foreground/80 text-xs text-pretty">
          Дээд зурвас сайтын бүх хуудасны хамгийн дээр гүйж, дарахад энэ арга
          хэмжээний бараа руу орно. Тоолуур нь эхлэх мөчид ингэж харагдана.
          Утсан дээр шүүлтүүрийн товч «Шүүлтүүр» цэсэд байна.
        </p>
      </div>
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
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <p id="ticker-theme-label" className="text-sm font-medium">
        Дээд зурвасын өнгө
      </p>
      <div
        role="radiogroup"
        aria-labelledby="ticker-theme-label"
        className="flex flex-wrap gap-2"
      >
        {SALE_EVENT_TICKER_THEMES.map((t) => {
          const selected = t === value;
          return (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              data-ticker={t}
              onClick={() => onChange(t)}
              className={cn(
                "bg-announce text-announce-foreground font-condensed inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold tracking-wide uppercase outline-offset-2 disabled:opacity-50",
                selected ? "outline-foreground outline-2" : "hover:opacity-90",
              )}
            >
              <span>Aa</span>
              <span
                aria-hidden
                className="bg-announce-accent size-2 rounded-full"
              />
              <span className="font-sans text-xs font-medium tracking-normal normal-case">
                {SALE_EVENT_TICKER_LABEL[t]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
