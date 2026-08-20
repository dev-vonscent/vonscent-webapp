import { notFound } from "next/navigation";
import { getOrderDetail } from "@/features/admin/api";
import { formatPrice, formatDate } from "@/lib/format";
import { PrintButton } from "@/features/admin/components/print-button";

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getOrderDetail(id);
  if (!detail) notFound();
  const { order, items } = detail;

  return (
    <div className="mx-auto max-w-2xl space-y-6 bg-white p-2 text-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-serif text-2xl font-semibold">vonscent</p>
          <p className="text-muted-foreground">Нэхэмжлэх / Invoice</p>
        </div>
        <div className="text-right">
          <p className="font-mono font-semibold">{order.order_no}</p>
          <p className="text-muted-foreground">
            {formatDate(order.created_at)}
          </p>
        </div>
      </div>

      <div className="border-border border-y py-3">
        <p className="font-medium">{order.contact_name}</p>
        <p className="text-muted-foreground">{order.contact_phone}</p>
        <p className="text-muted-foreground">
          {order.ship_city}
          {order.ship_district ? `, ${order.ship_district}` : ""},{" "}
          {order.ship_detail}
        </p>
      </div>

      <table className="w-full">
        <thead className="border-border text-muted-foreground border-b text-left text-xs">
          <tr>
            <th className="py-2">Бараа</th>
            <th className="py-2 text-center">Тоо</th>
            <th className="py-2 text-right">Үнэ</th>
            <th className="py-2 text-right">Дүн</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id} className="border-border/60 border-b">
              <td className="py-2">
                {i.brand} {i.product_name} ({i.ml}ml)
              </td>
              <td className="py-2 text-center">{i.qty}</td>
              <td className="py-2 text-right">{formatPrice(i.unit_price)}</td>
              <td className="py-2 text-right">{formatPrice(i.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto w-56 space-y-1">
        <Row label="Дэд дүн" value={formatPrice(order.subtotal)} />
        {order.discount > 0 && (
          <Row label="Хямдрал" value={`−${formatPrice(order.discount)}`} />
        )}
        {order.loyalty_used > 0 && (
          <Row label="Loyalty" value={`−${formatPrice(order.loyalty_used)}`} />
        )}
        <Row label="Хүргэлт" value={formatPrice(order.shipping_fee)} />
        <div className="border-border flex justify-between border-t pt-1 font-semibold">
          <span>Нийт</span>
          <span>{formatPrice(order.total)}</span>
        </div>
      </div>

      <PrintButton />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-muted-foreground flex justify-between">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
