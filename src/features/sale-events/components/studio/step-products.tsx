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
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-medium tabular-nums">
          {itemsSummary(draft.items)}
        </p>
        <p className="text-muted-foreground text-sm text-pretty">
          Хувь бичээгүй бараа үнээрээ үлдэж, зөвхөн энэ арга хэмжээний
          жагсаалтад орно.
        </p>
      </div>
      {conflicts.length > 0 && (
        <p className="text-destructive text-sm" role="alert">
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
