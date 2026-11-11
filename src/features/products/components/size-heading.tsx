import { SPRAYS_PER_ML } from "@/lib/constants";

/**
 * «Хэмжээ сонгох» гарчиг + баруун талд нь сонгосон хэмжээний ≈ шүршилт.
 * Хэмжээний картын ДОТОР биш: карт бүр аль хэдийн 3 мөртэй (үнэ, хуучин
 * үнэ, ₮/ml) тул гарчгийн мөрийн хоосон зайг ашиглана. Барааны хуудас ба
 * quick-add хоёул ашиглана.
 */
export function SizeHeading({ ml }: { ml: number | null | undefined }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <p className="text-sm font-medium">Хэмжээ сонгох</p>
      {ml != null && (
        <p
          className="text-muted-foreground text-xs tabular-nums"
          aria-live="polite"
        >
          {ml}ml ≈ {ml * SPRAYS_PER_ML} шүршилт
        </p>
      )}
    </div>
  );
}
