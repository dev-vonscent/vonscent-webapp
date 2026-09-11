import type { QpayDeeplink } from "@/lib/payments/qpay-types";
import type { PaymentMethod } from "@/db/types";

export type { QpayDeeplink };

/** One line of the order being paid for, as stored on `order_items`. */
export interface PaymentLine {
  name: string;
  brand: string;
  ml: number;
  qty: number;
  lineTotal: number;
  /** 1мл бэлгийн дээж (0₮ мөр). */
  isSample: boolean;
  /** Багцын нэр, багцын гишүүн мөр бол. */
  collectionName: string | null;
  image: string | null;
}

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
  subtotal: number;
  shippingFee: number;
  discount: number;
  loyaltyUsed: number;
  paymentMethod: PaymentMethod;
  paid: boolean;
  /** Захиалга цуцлагдсан (нөөцийн хугацаа дууссан эсвэл гараар). */
  cancelled: boolean;
  /** "yyyy-MM-dd" (UB) — chosen at checkout. */
  deliverOn: string | null;
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
