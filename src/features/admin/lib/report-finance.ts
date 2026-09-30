/**
 * Тайлангийн мөнгөний тоо (0111_report_finance) ба түүний задаргаа.
 *
 * Бүх тоог SQL бодно — энд зөвхөн мөр, шошго, тэмдгийг нэг газар тогтооно,
 * ингэснээр дэлгэц, хэвлэх хуудас хоёр нэг задаргаа харуулна.
 *
 *   Барааны нийт дүн − Купон − V-point − Буцаалт = Цэвэр борлуулалт
 *   Цэвэр борлуулалт − QPay шимтгэл + Буцаалтын шимтгэл − Бараа = Ашиг
 *
 * Хүргэлт нь дамжин өнгөрөх мөнгө (клиент хүргэлтийн компанид тэр чигээр
 * нь төлдөг) — аль ч тоонд орохгүй, зөвхөн мэдээлэл болж харагдана.
 */

export interface ReportFinance {
  /** Барааны дүн, купоноос өмнө (sale/багцын үнэ орсон). */
  goods: number;
  coupon: number;
  points: number;
  /** Мужид БУЦААГДСАН захиалгын цэвэр барааны дүн. */
  refunds: number;
  /** goods − coupon − points − refunds. Хөгжүүлэгчийн хөлсний суурь. */
  netSales: number;
  /** Хэрэглэгчийн төлсөн хүргэлт — дамжин өнгөрнө. */
  shipping: number;
  qpayFee: number;
  /** Буцаалтаас суутгаж, дэлгүүрт үлдсэн шимтгэл. */
  refundFee: number;
  /** Эх сав + restock-ийн худалдан авалт. */
  purchases: number;
  profit: number;
  saleOrders: number;
  refundOrders: number;
  /** Цуцлагдсан боловч мөнгө нь хараахан буцаагдаагүй. */
  pendingRefundOrders: number;
  pendingRefundAmount: number;
}

export const EMPTY_FINANCE: ReportFinance = {
  goods: 0,
  coupon: 0,
  points: 0,
  refunds: 0,
  netSales: 0,
  shipping: 0,
  qpayFee: 0,
  refundFee: 0,
  purchases: 0,
  profit: 0,
  saleOrders: 0,
  refundOrders: 0,
  pendingRefundOrders: 0,
  pendingRefundAmount: 0,
};

/** `admin_report_finance`-ийн мөр. PostgREST bigint-ийг number-оор өгнө. */
export interface FinanceRow {
  goods: number;
  coupon: number;
  points: number;
  refunds: number;
  net_sales: number;
  shipping: number;
  qpay_fee: number;
  refund_fee: number;
  purchases: number;
  profit: number;
  sale_orders: number;
  refund_orders: number;
  pending_refund_orders: number;
  pending_refund_amount: number;
}

export function financeFromRow(r: FinanceRow): ReportFinance {
  return {
    goods: Number(r.goods),
    coupon: Number(r.coupon),
    points: Number(r.points),
    refunds: Number(r.refunds),
    netSales: Number(r.net_sales),
    shipping: Number(r.shipping),
    qpayFee: Number(r.qpay_fee),
    refundFee: Number(r.refund_fee),
    purchases: Number(r.purchases),
    profit: Number(r.profit),
    saleOrders: Number(r.sale_orders),
    refundOrders: Number(r.refund_orders),
    pendingRefundOrders: Number(r.pending_refund_orders),
    pendingRefundAmount: Number(r.pending_refund_amount),
  };
}

export interface FinanceLine {
  label: string;
  /** Тэмдэгтэй дүн: хасагдах мөр сөрөг. */
  amount: number;
  /** Дэд дүн (Цэвэр борлуулалт, Ашиг). */
  total?: boolean;
}

/** Ашгийн задаргаа — дээрээс доош нэмэхэд `total` мөр бүр гарна. */
export function financeLines(f: ReportFinance): FinanceLine[] {
  return [
    { label: "Барааны нийт дүн", amount: f.goods },
    { label: "Купон", amount: -f.coupon },
    { label: "V-point", amount: -f.points },
    { label: "Буцаалт", amount: -f.refunds },
    { label: "Цэвэр борлуулалт", amount: f.netSales, total: true },
    { label: "QPay шимтгэл", amount: -f.qpayFee },
    { label: "Буцаалтаас суутгасан шимтгэл", amount: f.refundFee },
    { label: "Бараа худалдан авалт", amount: -f.purchases },
    { label: "Ашиг", amount: f.profit, total: true },
  ];
}
