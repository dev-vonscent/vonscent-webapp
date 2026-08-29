import { Badge } from "@/components/ui/badge";
import {
  stockState,
  STOCK_STATE_LABEL,
} from "@/features/admin/lib/stock-state";

/**
 * The one place the shop's stock states are named and coloured.
 *
 * «Нуусан» and «Бага» used to share `variant="secondary"` — the same neutral
 * pill for opposite meanings — and the products table and the inventory table
 * each carried their own copy of the branching, so they drifted apart. Low
 * stock is a warning, and the operator's whole job on these screens is spotting
 * it in a scroll.
 */
export function StockBadge({
  availableMl,
  lowStockMl,
  isActive = true,
  soldOut = false,
}: {
  availableMl: number;
  lowStockMl: number;
  /** Products can be hidden from the shop independently of stock. */
  isActive?: boolean;
  soldOut?: boolean;
}) {
  // Hidden outranks stock: a product nobody can see has no stock story to
  // tell, and «Дууссан» on an unlisted product sends the operator restocking
  // something the shop is not selling.
  if (!isActive) return <Badge variant="secondary">Нуусан</Badge>;
  const state = stockState(availableMl, lowStockMl, soldOut);
  const label = STOCK_STATE_LABEL[state];
  if (state === "soldout") return <Badge variant="sale">{label}</Badge>;
  if (state === "low")
    return <Badge className="bg-warning/15 text-warning">{label}</Badge>;
  return <Badge variant="new">{label}</Badge>;
}
