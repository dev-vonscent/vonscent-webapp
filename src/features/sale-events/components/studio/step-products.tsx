"use client";

import * as React from "react";
import { InfoTip } from "@/components/shared/info-tip";
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
      {conflicts.length > 0 && (
        <p
          className="bg-destructive/10 text-destructive rounded-lg px-4 py-2.5 text-sm text-pretty"
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
        summary={
          <p className="flex items-center gap-1.5 text-sm">
            <span className="font-medium tabular-nums">
              {itemsSummary(draft.items)}
            </span>
            <InfoTip label="Үнэ хэрхэн бодогдох вэ">
              Хувь нь үндсэн үнээс бодогдож, 100₮-д тоймлоно. Сонгосон бараа бүр
              дор хаяж нэг хэмжээнд хямдрах ёстой.
            </InfoTip>
          </p>
        }
        onChange={(items) => studio.patch({ items })}
      />
    </div>
  );
}
