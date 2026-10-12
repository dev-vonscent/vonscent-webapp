import { CalendarClock, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import type { ProductDetail } from "@/lib/types";

/**
 * «Тун удахгүй» барааны (0125) худалдан авах хэсгийн орлох.
 *
 * `ProductPurchase`-ийг салаалуулахгүй тусдаа: тэнд бүх зүйл «одоо авч
 * болох уу» гэсэн асуулттай (тоо ширхэг, сагс, доод зурвас, хүргэлтийн
 * амлалт). Энд тэр асуулт огт байхгүй — үнэ, хэмжээ нь мэдээлэл төдий.
 * Зарахгүй хэмжээний үнийг харуулахгүй (ProductPurchase-тай ижил дүрэм).
 */
export function ComingSoonPurchase({ product }: { product: ProductDetail }) {
  const sizes = product.variants.filter((v) => v.isActive);

  return (
    <div className="space-y-6">
      {sizes.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Ирэх хэмжээ ба үнэ</p>
          <ul className="grid grid-cols-4 gap-2">
            {sizes.map((v) => (
              <li
                key={v.id}
                className="bg-secondary flex min-h-11 min-w-0 flex-col items-center justify-center rounded-lg px-1 py-2"
              >
                <span className="text-sm font-semibold">{v.ml}ml</span>
                <span className="text-muted-foreground text-xs">
                  {formatPrice(v.price)}
                </span>
                {v.basePrice > v.price && (
                  <span className="text-muted-foreground text-[10px] line-through">
                    {formatPrice(v.basePrice)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3">
        <div className="bg-secondary space-y-1 rounded-lg px-4 py-3">
          <p className="flex items-center gap-2 font-medium">
            <CalendarClock className="text-gold-strong size-4 shrink-0" />
            Тун удахгүй ирнэ
          </p>
          <p className="text-muted-foreground text-sm">
            {product.comingSoonNote
              ? `${product.comingSoonNote} худалдаанд гарна. `
              : "Бид энэ усыг удахгүй авчирна. "}
            Ирмэгц энэ хуудаснаас шууд захиалах боломжтой болно.
          </p>
        </div>

        <Button size="lg" className="w-full" disabled>
          Захиалга удахгүй нээгдэнэ
        </Button>

        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Heart className="size-3.5 shrink-0" aria-hidden />
          Хүслийн жагсаалтдаа хадгалвал ирэхэд нь амархан олно.
        </p>
      </div>
    </div>
  );
}
