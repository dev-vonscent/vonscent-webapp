import { Check, ShoppingCart } from "lucide-react";
import { formatPrice } from "@/lib/format";

/** «Сагсанд нэмэх» товчны текст: тоо ≥ 2 үед нийт дүн товч дотор. */
export function addToCartText(qty: number, unitPrice: number): string {
  return qty >= 2
    ? `Сагсанд нэмэх · ${formatPrice(unitPrice * qty)}`
    : "Сагсанд нэмэх";
}

/**
 * «Сагсанд нэмэх» товчны агуулга — барааны дэлгэрэнгүй ба quick-add хоёул.
 * Тоо ≥ 2 үед төлөх нийт дүн (integer ₮, `unitPrice × qty` — сагс,
 * төлбөрийн хуудасны мөртэй ижил) товч дотор: «Сагсанд нэмэх · 70,000₮».
 * Тусдаа «2 ш × 35,000₮ = 70,000₮» мөр хасагдсан. «Захиалах»-д дүн нэмэхгүй.
 */
export function AddToCartLabel({
  qty,
  unitPrice,
  added,
}: {
  qty: number;
  unitPrice: number;
  added: boolean;
}) {
  if (added) {
    return (
      <>
        <Check className="size-4" /> Нэмэгдлээ
      </>
    );
  }
  return (
    <>
      <ShoppingCart className="size-4" />
      <span className="tabular-nums">{addToCartText(qty, unitPrice)}</span>
    </>
  );
}
