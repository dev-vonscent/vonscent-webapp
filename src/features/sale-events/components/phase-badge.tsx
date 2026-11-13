import { Badge } from "@/components/ui/badge";
import { SALE_EVENT_PHASE_LABEL } from "../lib";
import type { SaleEventPhase } from "../types";

const VARIANT: Record<SaleEventPhase, "new" | "secondary" | "outline" | "gold"> =
  {
    live: "new",
    scheduled: "gold",
    ended: "secondary",
    draft: "outline",
  };

/** Арга хэмжээний төлөв: Ноорог / Товлосон / Явж байна / Дууссан. */
export function PhaseBadge({ phase }: { phase: SaleEventPhase }) {
  return <Badge variant={VARIANT[phase]}>{SALE_EVENT_PHASE_LABEL[phase]}</Badge>;
}
