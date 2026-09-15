"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/format";

/**
 * V point-оо ХЭДИЙГ нь зарцуулахаа хэрэглэгч өөрөө шийддэг талбар.
 *
 * Өмнө нь энэ нь «V point ашиглах (1,240)» гэсэн ганц чагт байсан: чагтлахад
 * боломжит бүх оноо нэг дор шатдаг байв. Оноо нь хуримтлагдах утгатай зүйл —
 * 1,240 оноотой хүн 45,000₮-ийн захиалга дээр бүгдийг нь цутгамааргүй, дараа
 * илүү том захиалга дээрээ хэрэглэхээр үлдээмээр байдаг. Чагт түүнд «бүгд
 * эсвэл юу ч үгүй» гэснээс өөр сонголт өгдөггүй байв.
 *
 * Оролт нь ТӨГРӨГӨӨР: хэрэглэгчийн шийдэж буй зүйл «хэдэн оноо» биш, «нийт
 * дүнгээс хэд хасагдах» юм. Оноо → төгрөгийн ханш (`redeemRate`) нь админы
 * тохиргоо тул онооны тоог доод мөрөнд тусад нь хэлнэ.
 *
 * Хэлбэрээрээ купоны талбарын ах дүү: хоёулаа «дүнг хямдруулах хэрэгсэл»
 * бөгөөд захиалгын тоймын тооцооны мөрүүдийн ДЭЭР, нэг баганад зэрэгцэж
 * суудаг. Ялгаа нь — купон бол атом (кодоо хийгээд болов), оноо бол тохируулга
 * тул оролт нь хэрэглэсний дараа ч нуугдахгүй: 500₮-оо 300₮ болгож засах нь
 * нэг дор хийгддэг байх ёстой.
 *
 * Хязгаарыг сервер дахин барина (`place_order`) — энд байгаа `max` нь зөвхөн
 * харагдах дүнг зөв байлгах, хэрэглэгчийг мухардуулахгүй байх үүрэгтэй.
 */
export function LoyaltyField({
  value,
  onChange,
  max,
  balance,
  redeemRate,
}: {
  /** Одоо хэрэглэхээр тохируулсан дүн (₮) — эцэг нь `max`-д хумьсан байна. */
  value: number;
  onChange: (value: number) => void;
  /** Энэ захиалгад оноогоор төлж болох дээд дүн (₮). */
  max: number;
  /** Дансны боломжит оноо (ширхэг). */
  balance: number;
  /** 1 оноо = хэдэн ₮. */
  redeemRate: number;
}) {
  // Бичиж байх зуур таслал нэмэхгүй: «10,00» гэж бичиж байхад курсор үсэрдэг.
  // Оролт нь цэвэр орон, харин бүтэн дүнг доод мөр хэлнэ.
  const [text, setText] = React.useState(value > 0 ? String(value) : "");
  const [clamped, setClamped] = React.useState(false);

  // Сагс, купон өөрчлөгдөж дээд хязгаар буурахад эцэг нь утгыг хумина —
  // оролт түүнийг дагах ёстой, эс тэгвээс хэрэглэгч хэрэглэгдээгүй тоо уншина.
  React.useEffect(() => {
    setText((prev) => {
      const current = Number(prev.replace(/\D/g, "")) || 0;
      return current === value ? prev : value > 0 ? String(value) : "";
    });
  }, [value]);

  function commit(raw: string) {
    const digits = raw.replace(/\D/g, "");
    setText(digits);
    const next = Math.min(Number(digits) || 0, max);
    setClamped(digits !== "" && Number(digits) > max);
    onChange(next);
  }

  const applied = value > 0;
  const pointsSpent = applied ? Math.ceil(value / redeemRate) : 0;
  const mn = (n: number) => n.toLocaleString("mn-MN");

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-muted-foreground text-xs font-medium">
          V point ашиглах
        </span>
        <span className="text-muted-foreground text-xs tabular-nums">
          {mn(balance)} оноо
        </span>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            value={text}
            onChange={(e) => commit(e.target.value)}
            inputMode="numeric"
            placeholder="0"
            aria-label="Оноогоор төлөх дүн (₮)"
            // Баруун зэрэгцүүлсэн нь орон нь «₮»-ийн хажууд очиж, нэг бүтэн
            // дүн болж уншигдана — зүүн захад наалдсан тоо тэмдэгтээсээ
            // тасарч, хоёр өөр зүйл мэт харагддаг.
            className="h-10 pr-7 text-right tabular-nums md:h-9"
          />
          <span
            aria-hidden
            className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm"
          >
            ₮
          </span>
        </div>
        <Button
          type="button"
          variant={applied ? "secondary" : "default"}
          size="sm"
          className="h-10 shrink-0 md:h-9"
          onClick={() => commit(applied ? "" : String(max))}
        >
          {applied ? "Болих" : "Бүгдийг"}
        </Button>
      </div>

      {/* Нэг мөр, гурван ажил: хэтэрсэн бол хязгаараа хэлнэ, хэрэглэсэн бол
          хэдэн оноо явж хэд үлдэхийг хэлнэ, аль нь ч биш бол юу хийж болохыг
          хэлнэ. */}
      <p aria-live="polite" className="text-muted-foreground text-xs">
        {clamped
          ? `Энэ захиалгад хамгийн ихдээ ${formatPrice(max)} ашиглана.`
          : applied
            ? `${mn(pointsSpent)} оноо зарцуулж, ${mn(
                Math.max(balance - pointsSpent, 0),
              )} үлдэнэ.`
            : `Хамгийн ихдээ ${formatPrice(max)} — хүргэлтийн төлбөрт ороогүй.`}
      </p>
    </div>
  );
}
