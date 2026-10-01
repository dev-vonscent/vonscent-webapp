import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  financeLines,
  type ReportFinance,
} from "@/features/admin/lib/report-finance";

/**
 * Цэвэр борлуулалт → ашгийн задаргаа. Тайлан ба хэвлэх хуудас хоёр ижил
 * мөрүүдийг харуулна (`financeLines`).
 */
export function FinanceBreakdown({
  finance,
  caption,
}: {
  finance: ReportFinance;
  caption: string;
}) {
  return (
    <div className="space-y-3">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <tbody>
          {financeLines(finance).map((line) => (
            <tr
              key={line.label}
              className={cn(line.total && "border-border border-t")}
            >
              <th
                scope="row"
                className={cn(
                  "py-1.5 text-left",
                  line.total
                    ? "font-medium"
                    : "text-muted-foreground font-normal",
                )}
              >
                {line.label}
              </th>
              <td
                className={cn(
                  "py-1.5 text-right tabular-nums",
                  line.total && "font-semibold",
                  line.total && line.amount < 0 && "text-destructive",
                )}
              >
                {line.amount < 0 && !line.total
                  ? `−${formatPrice(-line.amount)}`
                  : formatPrice(line.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="text-muted-foreground space-y-1 text-xs">
        <li>
          Хүргэлтийн төлбөр {formatPrice(finance.shipping)} — хүргэлтийн
          компанид тэр чигээр нь төлөгддөг тул тооцоонд ороогүй.
        </li>
        <li>
          Буцаалтыг буцаасан өдрөөр нь хасна, өнгөрсөн сарын тоо өөрчлөгдөхгүй.
        </li>
        {finance.pendingRefundOrders > 0 && (
          <li>
            Цуцлагдсан боловч мөнгө нь буцаагдаагүй{" "}
            {finance.pendingRefundOrders} захиалга (
            {formatPrice(finance.pendingRefundAmount)}) борлуулалтад тоологдсон
            хэвээр — буцаалт хийсэн өдөр хасагдана.
          </li>
        )}
      </ul>
    </div>
  );
}
