import { numAblative } from "@/lib/mn-grammar";
import type { ExtraReadinessCode } from "./types";

/**
 * SQL-ийн алдааны кодыг (0147 `raise exception 'CODE[:detail]'`) админд
 * ойлгомжтой монгол өгүүлбэр болгоно. Нэг газар — route бүр эндээс.
 */
export const READINESS_MESSAGE: Record<ExtraReadinessCode, string> = {
  NO_VARIANT: "Идэвхтэй хувилбар алга байна",
  PRICE_MISSING: "Үнэ оруулаагүй хувилбар байна",
  VIAL_NOT_COUNTED:
    "Тоо оруулаагүй сав сонгогдсон байна. Эхлээд Савны нөөцөд тоо оруулна уу",
  VIAL_FLAG_OFF: "Савны тоон нөөц (vial_inventory) хаалттай байна",
  LEFTOVER_SOLD: "Энэ шил зарагдсан тул дахин нийтлэх боломжгүй",
};

/**
 * `extras_save` / `extras_set_status`-ийн алдаа. Танигдаагүй код бол null —
 * дуудагч ерөнхий «Хадгалж чадсангүй» гэнэ.
 */
export function extrasErrorMessage(raw: string | undefined): string | null {
  if (!raw) return null;
  const stock = /LEFTOVER_STOCK:(\d+)/.exec(raw);
  if (stock) {
    const ml = Number(stock[1]);
    return ml > 0
      ? `Энэ үнэртний нөөцөд ${ml}ml л байна. ${numAblative(ml)} их ml оруулах боломжгүй.`
      : "Энэ үнэртний нөөцөд түгжих ml үлдээгүй байна.";
  }
  if (raw.includes("LEFTOVER_IN_ORDER"))
    return "Энэ шил захиалгад орсон тул одоо засах боломжгүй.";
  if (raw.includes("LEFTOVER_SOLD"))
    return "Энэ шил зарагдсан тул засах боломжгүй.";
  if (raw.includes("LEFTOVER_INVALID"))
    return "Үнэртэн, үлдсэн ба бүтэн савны хэмжээг зөв оруулна уу.";
  if (raw.includes("VIAL_NOT_COUNTED"))
    return "Эхлээд Савны нөөцөд тоо оруулна уу.";
  if (raw.includes("VIAL_INVALID")) return "Сонгосон сав олдсонгүй.";
  if (raw.includes("FEATURE_DISABLED:vial_inventory"))
    return "Савны тоон нөөц хаалттай тул грамын сав нэмэх боломжгүй.";
  if (raw.includes("FEATURE_DISABLED:extras_shop"))
    return "Нэмэлт бараа хаалттай тул үлдэгдэлтэй шилийг нийтлэх боломжгүй.";
  if (raw.includes("extra_variants_label_uq"))
    return "Ижил нэртэй хувилбар байна.";
  if (raw.includes("extra_variants_vial_uq") || raw.includes("VIAL_DUPLICATE"))
    return "Нэг савыг хоёр удаа сонгосон байна.";
  if (raw.includes("CATEGORY_NOT_FOUND")) return "Ангилал олдсонгүй.";
  if (raw.includes("EXTRA_MODE_REQUIRED") || raw.includes("EXTRA_MODE_INVALID"))
    return "Барааны төрлөө (үлдэгдэлтэй эсвэл бүтэн шил) сонгоно уу.";
  if (raw.includes("VIAL_NOT_SELLABLE"))
    return "1ml, 2ml савыг дангаар зарахгүй — зөвхөн 5, 10, 20ml.";
  if (raw.includes("INITIAL_STOCK_REQUIRES_PURCHASE"))
    return "Тоог хадгалсны дараа «Нөөц нөхөх»-өөр авсан үнийн хамт оруулна уу.";
  if (raw.includes("INITIAL_PURCHASE_NEW_ONLY"))
    return "Хадгалсан хувилбарын нөөцийг «Нөөц нөхөх»-өөр оруулна уу.";
  if (raw.includes("PURCHASE_DATE_FUTURE"))
    return "Авсан өдөр ирээдүйд байж болохгүй.";
  if (raw.includes("PURCHASE_DATE_CLOSED"))
    return "Өнгөрсөн сарын тайлан хаагдсан тул энэ сарын өдөр оруулна уу.";
  if (raw.includes("PURCHASE_QTY_INVALID"))
    return "Ширхгийг 1-ээс 100,000 хооронд оруулна уу.";
  if (raw.includes("PURCHASE_COST_INVALID"))
    return "Нэгж авсан үнийг 0-ээс 10,000,000₮ хооронд оруулна уу.";
  if (raw.includes("STOCK_NOT_COUNTED"))
    return "Эхлээд савны эхний тооллогыг оруулна уу.";
  if (raw.includes("NOT_FOUND")) return "Бараа олдсонгүй. Хуудсаа сэргээнэ үү.";
  return null;
}
