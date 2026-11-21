import type { SaleRow } from "@/lib/orders/price-breakdown";
import type { QpayDeeplink } from "@/lib/payments/qpay-types";
import type { PaymentMethod } from "@/db/types";

export type { QpayDeeplink };

/** One line of the order being paid for, as stored on `order_items`. */
export interface PaymentLine {
  /** Барааны id — Purchase event-ийн `content_ids`. Бараа устсан бол null. */
  productId: string | null;
  name: string;
  brand: string;
  /** Декантын хэмжээ; нэмэлт барааны мөрөнд null (0146). */
  ml: number | null;
  /** Нэмэлт бараа бол хувилбарын нэр («Хар»); үнэртэнд null. */
  variantLabel: string | null;
  isExtra: boolean;
  qty: number;
  /** Төлсөн дүн — багцын гишүүнд хямдарсан. */
  lineTotal: number;
  /**
   * Үндсэн дүн (`lineBase`: хямдралтай дан мөрөнд base_price, бусад нь
   * list_price × qty). Тоймд ЭНЭ нь харагдана — нийлбэр «Нийт үндсэн үнэ».
   */
  baseTotal: number;
  /** 1мл бэлгийн дээж (0₮ мөр). */
  isSample: boolean;
  /** Бэлэг — сарын 1ml дээж эсвэл хүрдний шагнал (0₮). */
  isGift: boolean;
  /** Багцын нэр, багцын гишүүн мөр бол. */
  collectionName: string | null;
  image: string | null;
}

/**
 * Тоймын нэг мөр — «Миний захиалга»-тай ижил `buildOrderLines`-ийн дараалал
 * ба бүлэглэлт: дан (ml ↑) → нэмэлт → багц (ml ↑) → бэлэг.
 */
export type PaymentEntry =
  | { kind: "item"; key: string; line: PaymentLine }
  | {
      kind: "bundle";
      key: string;
      /** «NIGHT OUT багц», «Миний багц». */
      title: string;
      ml: number;
      qty: number;
      /** Гишүүдийн үндсэн үнийн нийлбэр. */
      baseTotal: number;
      /** Хүрдний шагнал болсон багц. */
      isGift: boolean;
      /** Багцын зураг, эс бөгөөс эхний гишүүнийх. */
      image: string | null;
      members: { brand: string; name: string }[];
    };

/** Everything `/pay/[token]` renders, resolved server-side from the token. */
export interface PaymentView {
  orderNo: string;
  total: number;
  /**
   * Төлж байгаа зүйлээ харуулах мөрүүд ба дүнгийн бүтэц. Хаяг, холбоо барих
   * мэдээлэл энд байхгүй хэвээр (линк дамжиж болно) — харин юуны төлөө
   * хэдэн төгрөг гэдгийг төлөгч хүн харах ёстой.
   */
  lines: PaymentLine[];
  /** Тоймд харагдах мөрүүд (бүлэглэсэн, эрэмбэлсэн). */
  entries: PaymentEntry[];
  /**
   * Захиалах мөчид ороогүй бэлгийн дээж (0149) — сангаас тул reload хийсэн ч
   * ижил. Нэр нь «Брэнд Нэр».
   */
  omittedGifts: { name: string; reason: "threshold" | "vial" | "stock" }[];
  subtotal: number;
  /** Багцын хямдралын өмнөх барааны дүн. Хуучин захиалгад null (0097). */
  grossSubtotal: number | null;
  /** Арга хэмжээ / хямдралын мөрүүд (0189). Хуучин захиалгад null. */
  saleBreakdown?: SaleRow[] | null;
  /** Хэрэглэсэн купоны код — тооцооны мөрийн шошгонд гарна. */
  couponCode: string | null;
  /** Хувийн купоны хувь (0199) — «Купон (10%)». */
  couponPct?: number | null;
  shippingFee: number;
  discount: number;
  loyaltyUsed: number;
  /**
   * Энэ захиалгаас хуримтлагдах V point. Зочны захиалгад 0 — оноо зөвхөн
   * бүртгэлтэй хэрэглэгчид олгогдоно (`mark_order_paid`).
   */
  pointsEarned: number;
  /**
   * Хүргэгдсэний дараа худалдаж авсан усандаа сэтгэгдэл бичвэл ус бүрт олгох
   * оноо (0117). Зочны захиалга болон урамшуулал унтарсан үед 0.
   */
  reviewPoints: number;
  paymentMethod: PaymentMethod;
  paid: boolean;
  /** Захиалга цуцлагдсан (нөөцийн хугацаа дууссан эсвэл гараар). */
  cancelled: boolean;
  /**
   * Бүртгэлтэй хэрэглэгчийн, сагсны хуулбартай захиалга — «Дараа захиалах»
   * товч гарна. Бусад үед (зочин, хуучин захиалга) зөвхөн «Устгах» (0124).
   */
  canSaveForLater: boolean;
  /** "yyyy-MM-dd" (UB) — chosen at checkout. */
  deliverOn: string | null;
  /**
   * Бэлгийн картын захиалга (0179) — хүргэлтгүй. Төлсний дараах дэлгэц,
   * хүргэх өдрийн мөр үүгээр солигдоно. Энгийн захиалгад null.
   */
  giftCard: {
    recipientName: string;
    recipientEmail: string | null;
    /** Товлосон илгээлт — ирээдүйн цаг бол «…-д илгээгдэнэ». */
    sendAt: string | null;
  } | null;
  invoice: {
    invoiceId: string;
    /**
     * What the QR asks for. Equals `total` for a customer; smaller only for a
     * staff test order under QPAY_TEST_AMOUNT.
     */
    amount: number;
    qrText: string;
    qrImage: string | null;
    shortUrl: string | null;
    deeplinks: QpayDeeplink[];
  } | null;
  /** True when the invoice is locally simulated (no QPay credentials). */
  mock: boolean;
}
