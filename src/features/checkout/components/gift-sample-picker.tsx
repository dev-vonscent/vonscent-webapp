"use client";

import * as React from "react";
import Image from "next/image";
import { Check, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import { toast } from "@/lib/toast";
import { GIFT_MAX_SAMPLES, GIFT_PER_PRODUCT_LIMIT } from "@/lib/constants";
import { giftAllowanceFor } from "@/lib/gift";
import { useGiftPool } from "@/features/gifts/use-gift-pool";
import { CheckoutSection } from "./checkout-section";

/**
 * Бэлгийн 1мл дээж сонгох хэсэг. Эрх нь купоны дараах барааны дүнгийн
 * 200,000₮ тутамд 1, хамгийн ихдээ `GIFT_MAX_SAMPLES` (`src/lib/gift.ts`).
 * Сонголт зөвхөн админы бэлгийн сангаас гарна: сан хоосон / унтраалттай бол
 * энэ хэсэг бүхэлдээ харагдахгүй. Сервер бүх сонголтыг дахин шалгадаг тул энэ
 * нь зөвхөн харагдац.
 *
 * Гурван зүйл энд зориуд хийгдсэн:
 *
 * 1. **Эрх 0 байхад ч хэсэг нь алга болохгүй.** Өмнө нь купон хэрэглээд дүн
 *    босгоос доош унахад бүхэл хэсэг нь чимээгүй хаягддаг байсан — хэрэглэгч
 *    юу алдсанаа ойлгох ямар ч арга байгаагүй. Одоо босго хүртэл хэдэн төгрөг
 *    дутуу байгааг хэлнэ; сан унтраалттай үед л бүрэн нуугдана.
 * 2. **Эрх хасагдахыг чангаар мэдэгдэнэ.** Сонгосон дээжийг дуугүй устгах нь
 *    хамгийн таагүй — «бэлэг» гэж нэрлэсэн зүйлээ хэлэлгүй буцааж авч байгаа
 *    хэрэг.
 * 3. **Нэг усыг `GIFT_PER_PRODUCT_LIMIT` хүртэл авч болно.** Сан 4 устай
 *    байхад 1М₮-ийн захиалга 5 эрх өгдөг — toggle үед сүүлчийн эрх нь
 *    мухардаж, тайлбаргүй үрэгддэг байв. `value` нь давхардал агуулсан
 *    ЖАГСААЛТ (олонлог биш). Нэг эрхтэй үед (хамгийн элбэг) radio.
 * 4. **Хавтас дарах = сонгох / болих; 2 дахь ширхэг нь зөвхөн «+» товчоор.**
 *    Өмнө нь сонгосон хавтсыг дахин дарахад 2 дахь ширхэг НЭМЭГДДЭГ байсан:
 *    сонголтоо болих гэж дарсан хэрэглэгчийн 7 ус «8/8» гэж тоологдоод 8 дахь
 *    усыг сонгох боломжгүй болдог байв (клиент, 2026-09 UG).
 *
 * Энэ нь сар бүрийн 1мл БЭЛГИЙН дээж — 2ml хэмжээний сонголттой хамаагүй.
 */
export function GiftSamplePicker({
  allowance,
  goodsAfterDiscount,
  value,
  onChange,
  step,
}: {
  /** Хуудасны алхмын дугаар. */
  step: number;
  /**
   * Бодитоор сонгож болох тоо — дүнгээс олсон эрхийг сангийн багтаамжаар
   * хумьсан (`giftSlotsFor`). Хуудас нь сангаа мэддэг тул тэндээс ирнэ.
   */
  allowance: number;
  /** Купоны дараах барааны дүн — босго хүртэл хэд дутахыг үүнээс бодно. */
  goodsAfterDiscount: number;
  /** Сонгосон дээжүүд — нэг ус давтагдаж болно. */
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

  /** Дүнгээс олсон эрх — сангийн багтаамжид хумигдахаас өмнөх тоо. */
  const earned = giftAllowanceFor(goodsAfterDiscount);
  const cappedByPool = allowance < earned;
  const atMax = earned >= GIFT_MAX_SAMPLES;
  /** Дараагийн эрх хүртэл дутуу дүн (босго ажиллаж байгаа үед л утгатай). */
  const toNext =
    threshold > 0 ? threshold - (goodsAfterDiscount % threshold || 0) : 0;

  const counts = new Map<string, number>();
  for (const id of value) counts.set(id, (counts.get(id) ?? 0) + 1);
  const left = allowance - value.length;

  function add(id: string) {
    onChange([...value, id]);
  }

  function remove(id: string) {
    const i = value.lastIndexOf(id);
    if (i < 0) return;
    onChange([...value.slice(0, i), ...value.slice(i + 1)]);
  }

  const single = allowance === 1;
  const ml = pool?.sampleMl ?? 1;
  /**
   * Текст В (клиент, 2026-09 UG) — мөр бүр нөхцөлтэй: эрхгүй үед «0мл эрхтэй»,
   * тагт хүрсэн үед «дахиад нэмбэл» гэж худал амлахгүй.
   */
  const summary = [
    allowance > 0
      ? `Та бэлэгт ${allowance * ml}мл үнэртэн сонгох эрхтэй байна.`
      : null,
    allowance > 1 && GIFT_PER_PRODUCT_LIMIT > 1
      ? `Нэг үнэртнээс дээд тал нь ${GIFT_PER_PRODUCT_LIMIT} ширхэг сонгох боломжтой.`
      : null,
    cappedByPool
      ? "Бэлгийн сангийн багтаамжаар хязгаарлагдсан."
      : atMax
        ? `Нэг захиалгад хамгийн ихдээ ${GIFT_MAX_SAMPLES * ml}мл.`
        : `Дахиад ${formatPrice(toNext)}-ийн бараа нэмснээр ${ml}мл бэлэг нэмэгдэнэ.`,
    "Купон ашигласан тохиолдолд хямдарсан дүнгээс бодогдоно.",
  ].filter((line): line is string => Boolean(line));

  function pick(id: string) {
    const count = counts.get(id) ?? 0;
    // Нэг эрхтэй үед radio: өөрийг дарвал сонголт солигдоно, сонгосноо дахин
    // дарвал болино.
    if (single) {
      onChange(count > 0 ? [] : [id]);
      return;
    }
    // Сонгосон хавтас нь toggle: дахин дарвал тэр усны бүх ширхгийг болино.
    if (count > 0) {
      onChange(value.filter((v) => v !== id));
      return;
    }
    if (left > 0) add(id);
  }

  return (
    <CheckoutSection
      step={step}
      title={`Бэлэг /Захиалгын үнийн дүнгийн ${formatPrice(threshold)} тутамд ${ml}мл/`}
      aside={
        allowance > 0 ? (
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
            {value.length}/{allowance} сонгосон
          </span>
        ) : undefined
      }
    >
      <div className="text-muted-foreground -mt-2 space-y-0.5 text-sm">
        {summary.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>

      {/* Том 4 карт (~800px) нэг ширхэг сонгохын тулд хуудасны хамгийн том
          блок болдог байв. Одоо ~120px өндөр хэвтээ мөр; ус нэмэгдвэл
          хажуу тийш гүйнэ (themed scrollbar нь `html`-ээс удамшина). */}
      {allowance > 0 && (
        <div
          role={single ? "radiogroup" : "group"}
          aria-label="Бэлгийн дээж сонгох"
          className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pt-1 pb-2 sm:-mx-6 sm:px-6"
        >
          {options.map((o) => {
            const count = counts.get(o.id) ?? 0;
            const canAdd = left > 0 && count < GIFT_PER_PRODUCT_LIMIT;
            const disabled = !single && count === 0 && left <= 0;
            return (
              <div key={o.id} className="relative w-20 shrink-0 snap-start">
                <button
                  type="button"
                  onClick={() => pick(o.id)}
                  disabled={disabled}
                  {...(single
                    ? { role: "radio", "aria-checked": count > 0 }
                    : { "aria-pressed": count > 0 })}
                  aria-label={
                    single
                      ? `${o.brand} ${o.name}`
                      : `${o.brand} ${o.name} — ${count > 0 ? `${count} ширхэг, сонголтоо болих` : "сонгох"}`
                  }
                  className="block w-full text-left disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span
                    className={cn(
                      "bg-muted relative block size-20 overflow-hidden rounded-lg ring-2 ring-transparent transition-all",
                      count > 0 && "ring-gold-strong",
                    )}
                  >
                    {o.image && (
                      <Image
                        src={o.image}
                        alt=""
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    )}
                    {count > 0 && (
                      <span className="bg-gold-strong text-background absolute right-1 bottom-1 flex size-5 items-center justify-center rounded-full text-[11px] font-semibold">
                        {single ? (
                          <Check className="size-3" strokeWidth={3} />
                        ) : (
                          count
                        )}
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground mt-1.5 block truncate text-[11px] uppercase">
                    {o.brand}
                  </span>
                  <span className="block truncate text-xs font-medium">
                    {o.name}
                  </span>
                </button>
                {/* Нэг уснаас 2 дахийг нь авах ЦОРЫН ГАНЦ зам — хавтас дарах нь
                    зөвхөн сонгох / болих (дээрх №4). */}
                {!single && count > 0 && canAdd && (
                  <button
                    type="button"
                    onClick={() => add(o.id)}
                    aria-label={`${o.name} — нэгээр нэмэх`}
                    className="bg-card text-foreground absolute top-1 right-1 flex size-6 items-center justify-center rounded-full shadow-sm before:absolute before:size-8 before:content-['']"
                  >
                    <Plus className="size-3.5" />
                  </button>
                )}
                {/* Олон эрхтэй үед: нэгээр хасна. */}
                {!single && count > 0 && (
                  <button
                    type="button"
                    onClick={() => remove(o.id)}
                    aria-label={`${o.name} — нэгээр хасах`}
                    className="bg-card text-foreground absolute top-1 left-1 flex size-6 items-center justify-center rounded-full shadow-sm before:absolute before:size-8 before:content-['']"
                  >
                    <Minus className="size-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </CheckoutSection>
  );
}
