"use client";

import * as React from "react";
import type { SaleEventProduct } from "../../types";
import { EventItemsSection } from "../event-items-section";
import { itemsSummary } from "./studio-model";
import type { EventStudio } from "./use-event-studio";

/**
 * ② Бараа, хямдрал (studio-ux.md §5.2) — `EventItemsSection`-ий логик
 * хэвээр, бүтэн өргөнд. Давхцсан барааг улаанаар тэмдэглэнэ.
 */
export function StepProducts({
  studio,
  products,
}: {
  studio: EventStudio;
  products: SaleEventProduct[];
}) {
  const { draft, conflicts, errors } = studio;
  const byId = React.useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );
  const conflictIds = React.useMemo(
    () => new Set(conflicts.map((c) => c.productId)),
    [conflicts],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="bg-secondary rounded-full px-3.5 py-1.5 text-sm font-medium tabular-nums">
          {itemsSummary(draft.items)}
        </span>
        <span className="text-muted-foreground text-sm text-pretty">
          Хувь бичээгүй бараа үнээрээ үлдэнэ. Хувь нь үндсэн үнээс, 100₮-д
          дугуйрна.
        </span>
      </div>
      {conflicts.length > 0 && (
        <p
          className="bg-destructive/10 text-destructive rounded-xl px-4 py-3 text-sm text-pretty"
          role="alert"
        >
          Улаанаар тэмдэглэсэн бараа хугацаа давхацсан өөр арга хэмжээнд байна —
          хасах эсвэл хугацааг өөрчилнө үү.
        </p>
      )}
      <EventItemsSection
        items={draft.items}
        products={products}
        byId={byId}
        conflictIds={conflictIds}
        error={errors.items}
        onChange={(items) => studio.patch({ items })}
      />
    </div>
  );
}
