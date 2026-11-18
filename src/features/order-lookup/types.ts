import type { SaleRow } from "@/lib/orders/price-breakdown";
import type { PaymentEntry, PaymentLine } from "@/features/payment/types";
import type { OrderStatus } from "@/lib/constants";
import type { PaymentStatusValue } from "@/lib/constants";

/**
 * `/order/[token]` -ийн харагдац.
 *
 * `/pay/[token]`-тай ижил нууцлалын дүрэм: линк дамжиж болох тул хүлээн
 * авагчийн нэр, утас, хаяг ЭНД БАЙХГҮЙ. Захиалгын мөр, дүн, төлөв нь
 * захиалагчийн өөрийнх нь мэдэх ёстой зүйл тул үлдэнэ.
 */
export interface OrderStatusView {
  orderNo: string;
  status: OrderStatus;
  paymentStatus: PaymentStatusValue;
  createdAt: string;
  deliverOn: string | null;
  lines: PaymentLine[];
  /** Харагдах мөрүүд — `/pay/[token]`-тай ижил (`paymentLines`). */
  entries: PaymentEntry[];
  subtotal: number;
  /** Багцын хямдралын өмнөх барааны дүн (0097). Хуучин захиалгад null. */
  grossSubtotal: number | null;
  /** Арга хэмжээ / хямдралын мөрүүд (0189). Хуучин захиалгад null. */
  saleBreakdown?: SaleRow[] | null;
  couponCode: string | null;
  shippingFee: number;
  discount: number;
  loyaltyUsed: number;
  total: number;
  /** Төлбөрийн хуудас руу орох токен — төлөх боломжтой үед л. */
  payToken: string | null;
  /** Төлбөр хүлээгдэж байгаа эсэх (төлөх товч гаргах эсэх). */
  awaitingPayment: boolean;
  history: { status: OrderStatus; note: string | null; createdAt: string }[];
}
