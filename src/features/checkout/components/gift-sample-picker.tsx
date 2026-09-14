"use client";

import * as React from "react";
import Image from "next/image";
import { Gift } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import { toast } from "@/lib/toast";
import { useGiftPool } from "@/features/gifts/use-gift-pool";

/**
 * Бэлгийн 1мл дээж сонгох хэсэг. Эрх нь купоны дараах барааны дүнгийн
 * 200,000₮ тутамд 1, эсвэл preset 5/10/20мл багцын баталгаа — ихийг нь
 * (`src/lib/gift.ts`). Сонголт зөвхөн админы бэлгийн сангаас гарна: сан
 * хоосон / унтраалттай бол энэ хэсэг бүхэлдээ харагдахгүй. Сервер бүх
 * сонголтыг дахин шалгадаг тул энэ нь зөвхөн харагдац.
 *
 * Хоёр зүйл энд зориуд хийгдсэн:
 *
 * 1. **Эрх 0 байхад ч хэсэг нь алга болохгүй.** Өмнө нь купон хэрэглээд дүн
 *    босгоос доош унахад бүхэл хэсэг нь чимээгүй хаягддаг байсан — хэрэглэгч
 *    юу алдсанаа ойлгох ямар ч арга байгаагүй. Одоо босго хүртэл хэдэн төгрөг
 *    дутуу байгааг хэлнэ; сан унтраалттай үед л бүрэн нуугдана.
 * 2. **Эрх хасагдахыг чангаар мэдэгдэнэ.** Сонгосон дээжийг дуугүй устгах нь
 *    хамгийн таагүй — «бэлэг» гэж нэрлэсэн зүйлээ хэлэлгүй буцааж авч байгаа
 *    хэрэг.
 */
export function GiftSamplePicker({
  allowance,
  goodsAfterDiscount,
  value,
  onChange,
}: {
  /** How many samples this order may pick. */
  allowance: number;
  /** Купоны дараах барааны дүн — босго хүртэл хэд дутахыг үүнээс бодно. */
  goodsAfterDiscount: number;
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const pool = useGiftPool();
  const options = pool?.enabled ? pool.products : [];
  const threshold = pool?.threshold ?? 0;

  // Эрх хумигдвал (купон нэмэгдсэн, бараа хасагдсан) илүү сонголтыг хаяна —
  // эс тэгвэл сервер рүү хэтэрсэн хүсэлт явна. Хаясан бол ЯАГААД гэдгийг нь
  // хэлнэ: хэрэглэгч энэ мөчид сагсандаа биш, купон дээрээ анхаарлаа тавьсан
  // байдаг тул хуудасны доод талын өөрчлөлтийг хардаггүй.
  React.useEffect(() => {
    if (value.length <= allowance) return;
    const dropped = value.length - allowance;
    onChange(value.slice(0, allowance));
    toast(
      allowance > 0
        ? `Бэлгийн эрх ${allowance} болж буурсан тул ${dropped} дээж хасагдлаа.`
        : "Купоны дараах дүн босгоос доош орсон тул бэлгийн дээж хасагдлаа.",
      "Бэлгийн сонголт өөрчлөгдлөө",
    );
  }, [allowance, value, onChange]);

  // Сан унтраалттай / хоосон үед л бүрэн нуугдана — энэ тохиолдолд «бэлэг»
  // гэдэг ойлголт тэр захиалгад огт байхгүй.
  if (options.length === 0) return null;

  /** Дараагийн эрх хүртэл дутуу дүн (босго ажиллаж байгаа үед л утгатай). */
  const toNext =
    threshold > 0
      ? threshold - (goodsAfterDiscount % threshold || 0)
      : 0;

  function toggle(id: string) {
    if (value.includes(id)) {
      onChange(value.filter((x) => x !== id));
    } else if (value.length < allowance) {
      onChange([...value, id]);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Gift className="text-gold-strong size-5" />
          Бэлгийн 1мл дээж
        </h2>

        {allowance > 0 ? (
          <p className="text-muted-foreground text-sm">
            {formatPrice(threshold)} тутамд 1, бэлэн 5/10/20мл багц бүрээс 1 — та{" "}
            <strong className="text-foreground">{allowance}</strong> ширхэг
            сонгох эрхтэй ({value.length} сонгосон).
          </p>
        ) : (
          /* Эрхгүй ч хэсэг нь үлддэг: хэдэн төгрөг дутуу байгааг хэлэх нь
             «алга болсон» хэсгээс хамаагүй ойлгомжтой, бас бодит санал. */
          <p className="text-muted-foreground text-sm">
            Барааны дүн {formatPrice(threshold)} хүрвэл 1мл дээж бэлгэнд
            сонгоно. Одоо{" "}
            <strong className="text-foreground">
              {formatPrice(goodsAfterDiscount)}
            </strong>{" "}
            — <strong className="text-foreground">{formatPrice(toNext)}</strong>{" "}
            дутуу байна. Бэлэн 5/10/20мл багц бүр ч нэг дээжийн эрх өгдөг.
          </p>
        )}

        {allowance > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {options.map((o) => {
              const selected = value.includes(o.id);
              const full = !selected && value.length >= allowance;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => toggle(o.id)}
                  disabled={full}
                  aria-pressed={selected}
                  className={cn(
                    // Хүрээ энэ системд тунгалаг тул сонгоогүй хавтан огт
                    // хилгүй, дарагддаггүй зураг мэт харагддаг байв.
                    "bg-secondary rounded-lg p-2 text-left text-xs transition-all",
                    selected
                      ? "ring-gold-strong ring-2"
                      : full
                        ? "opacity-40"
                        : "hover:bg-accent",
                  )}
                >
                  <div className="bg-muted relative mb-2 aspect-square w-full overflow-hidden rounded-md">
                    {o.image && (
                      <Image
                        src={o.image}
                        alt={o.name}
                        fill
                        sizes="120px"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <p className="text-muted-foreground uppercase">{o.brand}</p>
                  <p className="font-medium">{o.name}</p>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
