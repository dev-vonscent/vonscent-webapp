import type { Variant } from "@/lib/types";

/**
 * «Энэ хэмжээг өнөөдөр худалдаж авч болох уу» — НЭГ дүрэм.
 *
 * SQL тал дээрх `variant_sellable()` (0095)-ийн толь. Гурван бие даасан
 * шалтгаан байна:
 *
 *   isActive     — админ ЭНЭ бараанд тэр хэмжээг зарахгүй гэж тогтоосон;
 *   bottleLocked — тухайн ӨНГӨНИЙ (хүйс) хоосон сав дууссан (0095);
 *   inStock      — эх савны үлдэгдэл тэр хэмжээг гүйцээхгүй.
 *
 * Гурвыг дуудагч бүрт `&&`-ээр холбовол хаа нэгтээ мартагдана — сагс, багц,
 * checkout, хайлт дөрөв нь тус тусдаа шалгадаг байсан нь яг тийм эрсдэл.
 *
 * `server-only` БИШ: seed, тест, клиентийн компонент ч ижил дүрмээр явна.
 */
export function variantAvailability(v: {
  isActive: boolean;
  inStock: boolean;
  bottleLocked: boolean;
}): Pick<Variant, "sellable" | "unavailableReason"> {
  const sellable = v.isActive && v.inStock && !v.bottleLocked;
  return {
    sellable,
    // Дараалал санаатай: админ зориуд хаасан бол бусад шалтгаан хэрэглэгчид
    // хамаагүй; савны түгжээ нь ТҮР зуурынх тул үлдэгдлээс өмнө хэлнэ.
    unavailableReason: sellable
      ? null
      : !v.isActive
        ? "inactive"
        : v.bottleLocked
          ? "bottle"
          : "stock",
  };
}

/**
 * «Энэ хэмжээгээр ХЭДЭН ширхэг цутгаж болох вэ».
 *
 * `variantAvailability()` нь НЭГ ширхэгийн асуулт (зарах уу, үгүй юу) —
 * үлдэгдэл 15ml байхад 10ml зарагдана. Харин хэдэн ширхэг гэдгийг тэр
 * хэлдэггүй байсан тул тоо ширхэгийн сонголт хаана ч хязгаарлагдахгүй,
 * 10ml×2 = 20ml сагсанд ороод checkout дээр л унадаг байв.
 *
 * `remainingMl` нь ЭНЭ хэрэглэгчийн сагсанд аль хэдийн орсон ml-ийг ХАССАН
 * үлдэгдэл байх ёстой (`cartMlFor`, src/features/cart/budget.ts) — эс бөгөөс
 * нэг барааны олон мөр (10ml + 5ml) тус тусдаа зөв харагдаад нийлбэр нь
 * хэтэрнэ.
 *
 * `Infinity` дамжуулбал хязгаарлахгүй: сүлжээ унасан, үлдэгдэл мэдэгдэхгүй
 * үед сагсыг буруу түгжихээс сервер талын шалгалт руу оруулах нь дээр
 * (`use-cart-availability.ts`-ийн философитой ижил).
 */
export function maxUnits(v: {
  ml: number;
  sellable: boolean;
  remainingMl: number;
}): number {
  if (!v.sellable || v.ml <= 0 || Number.isNaN(v.remainingMl)) return 0;
  return Math.max(0, Math.floor(v.remainingMl / v.ml));
}
