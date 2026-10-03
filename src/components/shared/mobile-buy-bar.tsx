"use client";

import * as React from "react";
import { Check, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useClaimBottomBar } from "@/components/shared/bottom-nav-store";

/**
 * Хуудсан доторх CTA-г дээш гүйлгэж *өнгөрсөн* эсэх — зүгээр «харагдахгүй»
 * биш. Утсан дээр зураг эхэнд тул хуудас нээгдэх үед CTA дэлгэцийн ДООР
 * байдаг; «харагдахгүй» гэсэн нөхцөл нь зурвасыг орох даруйд гаргаж, доод
 * цэстэй давхцуулдаг байв.
 */
export function useScrolledPast<T extends Element>(
  ref: React.RefObject<T | null>,
) {
  const [past, setPast] = React.useState(false);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) =>
      setPast(!entry.isIntersecting && entry.boundingClientRect.bottom <= 0),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return past;
}

/**
 * Гар утасны наалдсан «Захиалах» зурвас — бараа, багц хоёр хуудас ижил
 * зурвасыг хуваалцана, ингэснээр зан төлөв нь дахин зөрөхгүй.
 *
 * Доод цэсийн байрыг эзэлнэ (`useClaimBottomBar`), тиймээс түүний хэлбэрийг
 * авна: Glass Trio (/85 + blur + lift) бүхий хөвөгч капсул. Үргэлж mount
 * хийгдсэн байж гулсаж орж гарна — нөхцөлөөр mount хийвэл цэс доошоо гулсаж
 * байх зуур зурвас нэг дор гарч ирээд хоёр капсул давхцдаг байв. `delay-150`
 * нь цэс гарах зайг өгнө.
 */
export function MobileBuyBar({
  show,
  label,
  price,
  added,
  onAdd,
  onBuyNow,
}: {
  show: boolean;
  label: string;
  price: string;
  added: boolean;
  onAdd: () => void;
  onBuyNow: () => void;
}) {
  useClaimBottomBar(show);

  return (
    <div
      className={cn(
        "pb-safe pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 transition-transform duration-300 ease-out motion-reduce:transition-none md:hidden",
        show ? "delay-150" : "translate-y-[140%]",
      )}
      inert={!show}
    >
      <div className="bg-secondary/85 shadow-lift pointer-events-auto mb-3 flex w-full items-center gap-3 rounded-full py-2 pr-2 pl-4 backdrop-blur">
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground truncate text-[11px]">{label}</p>
          <p className="font-serif text-base/tight font-semibold tabular-nums">
            {price}
          </p>
        </div>
        {/* Энэ өргөнд зөвхөн дүрс — шошго нь «Захиалах»-ыг жижиг утсан дээр
            зурваснаас шахаж гаргана. */}
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 rounded-full"
          onClick={onAdd}
          aria-label="Сагсанд нэмэх"
        >
          {added ? (
            <Check className="size-4" />
          ) : (
            <ShoppingCart className="size-4" />
          )}
        </Button>
        <Button
          onClick={onBuyNow}
          className="bg-cta text-cta-foreground hover:bg-cta/90 shrink-0 rounded-full"
        >
          Захиалах
        </Button>
      </div>
    </div>
  );
}
