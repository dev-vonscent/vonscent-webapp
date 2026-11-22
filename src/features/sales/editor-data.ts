import "server-only";
import { isoEndToDay, isoToDay } from "@/features/admin/lib/date-range";
import {
  UNNAMED_SALE_ID,
  UNNAMED_SALE_NAME,
  busyProducts,
  commonPeriod,
  derivePcts,
  isUnnamed,
  memberIds,
  periodPhase,
  type SaleProductRow,
  type SaleRecord,
} from "./lib";
import type { SaleEditorInitial } from "./components/sale-editor";

/**
 * Засах / үүсгэх хуудасны анхны утга. `id` олдохгүй бол null (→ 404).
 * «Нэргүй»: хуучин мөрүүдээс бараа, нийтлэг хугацаа, хувийг (sale_price-аас)
 * сэргээнэ.
 */
export function editorInitial(
  id: string | null,
  sales: SaleRecord[],
  products: SaleProductRow[],
  now: number,
): { initial: SaleEditorInitial; busy: Record<string, string> } | null {
  const busy = (currentId: string | null) =>
    Object.fromEntries(busyProducts(products, sales, currentId, now));

  if (id == null) {
    return {
      initial: {
        id: null,
        name: "",
        pcts: {},
        startsOn: "",
        endsOn: "",
        productIds: [],
        phase: null,
      },
      busy: busy(null),
    };
  }

  if (id === UNNAMED_SALE_ID) {
    const ids = memberIds(products, UNNAMED_SALE_ID, now);
    if (ids.length === 0) return null;
    const rows = products
      .flatMap((p) => p.variants)
      .filter((v) => isUnnamed(v, now));
    const period = commonPeriod(rows);
    return {
      initial: {
        id,
        name: UNNAMED_SALE_NAME,
        pcts: derivePcts(rows),
        startsOn: isoToDay(period.startsAt),
        endsOn: isoEndToDay(period.endsAt),
        productIds: ids,
        phase: periodPhase(period.startsAt, period.endsAt, now),
      },
      busy: busy(UNNAMED_SALE_ID),
    };
  }

  const sale = sales.find((s) => s.id === id);
  if (!sale) return null;
  return {
    initial: {
      id,
      name: sale.name,
      pcts: sale.pcts,
      startsOn: isoToDay(sale.startsAt),
      endsOn: isoEndToDay(sale.endsAt),
      productIds: memberIds(products, id, now),
      phase: periodPhase(sale.startsAt, sale.endsAt, now),
    },
    busy: busy(id),
  };
}
