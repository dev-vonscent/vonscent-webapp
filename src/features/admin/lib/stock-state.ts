/**
 * The one definition of «Хэвийн / Бага / Дууссан».
 *
 * These three words were computed in four places — the badge, the products
 * filter, the stock chart and the print sheet — and two of them disagreed: the
 * reports folded sold-out products into «бага», so a product with 0ml appeared
 * as merely low there and as sold out everywhere else. The rule is a business
 * rule (it decides what the operator restocks today), so it lives once.
 *
 * The measure is always **боломжит** ml — `on_hand_ml − reserved_ml` — not what
 * is physically in the bottle. Ml already promised to a placed order cannot be
 * sold again, so counting them would mean advertising stock the shop does not
 * have.
 */
export type StockState = "ok" | "low" | "soldout";

export const STOCK_STATE_LABEL: Record<StockState, string> = {
  ok: "Хэвийн",
  low: "Бага",
  soldout: "Дууссан",
};

/**
 * Энэ дүрэм SQL-д ХОЁР удаа давтагдсан: `admin_product_page()` (0060, барааны
 * жагсаалтын үлдэгдлийн шүүлт) ба `admin_stock_overview()` (0065, самбар /
 * тайлан / хэвлэх). Хоёул ЗӨВХӨН доорх хоёр аргументтай хэлбэрийг тусгадаг —
 * `is_sold_out`-ыг уншдаггүй.
 *
 * Тэр нь зөрүү биш: админы дэлгэцүүд ч түүнийг дамжуулдаггүй
 * (`ADMIN_PRODUCT_SELECT` нь `is_sold_out`-ыг сонгодог ч үгүй, `StockBadge`-д
 * ч өгдөггүй). Гурав дахь аргументыг ЗӨВХӨН дэлгүүрийн тал хэрэглэдэг
 * (`mapProduct()`-ийн `inStock`). Хэрэв админд ч уншуулах бол SQL-ийн хоёр
 * функцийг ЗЭРЭГ шинэчлэх ёстой, үгүй бол жагсаалтын шүүлт ба тэмдэг зөрнө.
 */
export function stockState(
  availableMl: number,
  lowStockMl: number,
  /** `inventory.is_sold_out`, when the caller has it — the DB's own verdict. */
  soldOut = false,
): StockState {
  if (soldOut || availableMl <= 0) return "soldout";
  // Inclusive: a product sitting exactly on its threshold is already low, or
  // the alert would only fire after the shop had gone past it.
  if (availableMl <= lowStockMl) return "low";
  return "ok";
}
