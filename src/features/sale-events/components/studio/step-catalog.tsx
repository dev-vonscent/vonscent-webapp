"use client";

import * as React from "react";
import { SALE_EVENT_DEFAULT_BADGE } from "@/lib/constants";
import type { SaleEventProduct } from "../../types";
import { CatalogPreview, PreviewMarker } from "./catalog-preview";
import { previewCards, previewCountdown } from "./catalog-preview-model";
import type { StudioStep } from "./studio-model";
import type { EventStudio } from "./use-event-studio";

/** Харагдац дээрх дугаартай цэгүүдийн тайлбар (§5.3). */
const LEGEND = [
  "Шүүлтүүрийн товч — арга хэмжээний нэр",
  "Гарчиг — хоосон бол нэр харагдана",
  "Тайлбар — заавал биш",
  "Тоолуур — дарж асаах / унтраах",
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
  const fieldErrors = [
    errors.name,
    errors.headline,
    errors.description,
    errors.badgeLabel,
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <p className="text-sm font-medium">
        Каталогт ингэж харагдана
        <span className="text-muted-foreground font-normal">
          {" "}
          · текст дээр дарж засна
        </span>
      </p>
      <CatalogPreview
        name={draft.name}
        headline={draft.headline}
        description={draft.description}
        badgeLabel={draft.badgeLabel}
        showCountdown={draft.showCountdown}
        countdownText={previewCountdown(draft.startsOn, draft.endsOn)}
        cards={cards}
        nameInvalid={!draft.name.trim() || Boolean(errors.name)}
        disabled={mode === "locked"}
        onName={studio.setName}
        onHeadline={(headline) => studio.patch({ headline })}
        onDescription={(description) => studio.patch({ description })}
        onBadgeLabel={(badgeLabel) => studio.patch({ badgeLabel })}
        onShowCountdown={(showCountdown) => studio.patch({ showCountdown })}
        onPickProducts={() => onGo("products")}
      />
      {fieldErrors.map((message) => (
        <p key={message} className="text-destructive text-sm" role="alert">
          {message}
        </p>
      ))}
      <ol className="text-muted-foreground grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {LEGEND.map((text, i) => (
          <li key={text} className="flex items-start gap-2">
            <span className="flex h-lh items-center">
              <PreviewMarker n={i + 1} />
            </span>
            <span className="text-pretty">{text}</span>
          </li>
        ))}
      </ol>
      <p className="text-muted-foreground text-sm text-pretty">
        Тоолуур нь арга хэмжээ эхлэх мөчид ингэж харагдана. Утсан дээр
        шүүлтүүрийн товч «Шүүлтүүр» цэсэд байна.
      </p>
    </div>
  );
}
