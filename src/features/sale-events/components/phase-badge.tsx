import { Badge } from "@/components/ui/badge";
import { SALE_EVENT_PHASE_LABEL } from "../lib";
import type { SaleEventPhase } from "../types";

const VARIANT: Record<
  Exclude<SaleEventPhase, "live">,
  "secondary" | "outline" | "gold"
> = {
  scheduled: "gold",
  ended: "secondary",
  draft: "outline",
};

/**
 * Арга хэмжээний төлөв: Ноорог / Товлосон / Идэвхтэй / Дууссан. «Идэвхтэй» нь
 * ногоон (`--live`, globals.css) + цэг — дэлгүүрт яг одоо үйлчилж байгааг
 * жагсаалтаас нэг харцаар.
 */
export function PhaseBadge({ phase }: { phase: SaleEventPhase }) {
  if (phase === "live") {
    return (
      <Badge className="bg-live/15 text-live gap-1.5 border-transparent">
        <span aria-hidden className="bg-live size-1.5 rounded-full" />
        {SALE_EVENT_PHASE_LABEL.live}
      </Badge>
    );
  }
  return (
    <Badge variant={VARIANT[phase]}>{SALE_EVENT_PHASE_LABEL[phase]}</Badge>
  );
}
