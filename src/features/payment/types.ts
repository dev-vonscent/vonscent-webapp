import type { QpayDeeplink } from "@/lib/payments/qpay-types";
import type { PaymentMethod } from "@/db/types";

export type { QpayDeeplink };

/** Everything `/pay/[token]` renders, resolved server-side from the token. */
export interface PaymentView {
  orderNo: string;
  total: number;
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
