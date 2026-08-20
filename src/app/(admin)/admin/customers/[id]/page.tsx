import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getCustomerDetail } from "@/features/admin/api";
import { formatPrice, formatDate } from "@/lib/format";
import { ORDER_STATUS_LABEL } from "@/lib/constants";
import { CustomerControl } from "@/features/admin/components/customer-control";

export default async function AdminCustomerDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getCustomerDetail(id);
  if (!detail) notFound();
  const { profile, orders, ledger } = detail;
  const spent = orders
    .filter((o) => o.payment_status === "paid")
    .reduce((s, o) => s + o.total, 0);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/customers"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Хэрэглэгчид
      </Link>

      <div className="flex items-center gap-3">
        <h1 className="font-serif text-2xl font-semibold">
          {profile.full_name || "Нэргүй"}
        </h1>
        {profile.is_blocked && <Badge variant="sale">Хориглосон</Badge>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <Card>
            <CardContent className="grid grid-cols-3 gap-4 p-5 text-center">
              <Stat label="Захиалга" value={String(orders.length)} />
              <Stat label="Нийт зарцуулсан" value={formatPrice(spent)} />
              <Stat label="V point" value={String(profile.loyalty_points)} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-1 p-5 text-sm">
              <h2 className="mb-2 font-medium">Холбоо барих</h2>
              <p className="text-muted-foreground">
                Утас: {profile.phone || "—"}
                {profile.phone_verified ? " (баталгаажсан)" : ""}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <h2 className="mb-3 font-medium">Захиалгын түүх</h2>
              {orders.length === 0 ? (
                <p className="text-muted-foreground text-sm">Захиалга алга.</p>
              ) : (
                <ul className="divide-border divide-y text-sm">
                  {orders.map((o) => (
                    <li
                      key={o.id}
                      className="flex items-center justify-between py-2"
                    >
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="hover:text-primary font-mono"
                      >
                        {o.order_no}
                      </Link>
                      <span className="text-muted-foreground">
                        {formatDate(o.created_at)}
                      </span>
                      <Badge variant="secondary">
                        {ORDER_STATUS_LABEL[o.status]}
                      </Badge>
                      <span className="font-medium">
                        {formatPrice(o.total)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {ledger.length > 0 && (
            <Card>
              <CardContent className="p-5">
                <h2 className="mb-3 font-medium">V point гүйлгээ</h2>
                <ul className="divide-border divide-y text-sm">
                  {ledger.map((l) => (
                    <li
                      key={l.id}
                      className="flex items-center justify-between py-2"
                    >
                      <span className="text-muted-foreground">
                        {l.reason === "earn" ? "Хуримтлал" : "Зарцуулалт"} ·{" "}
                        {formatDate(l.created_at)}
                      </span>
                      <span
                        className={
                          l.delta >= 0 ? "text-success" : "text-destructive"
                        }
                      >
                        {l.delta >= 0 ? "+" : ""}
                        {l.delta}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        <Card>
          <CardContent className="space-y-3 p-5">
            <h2 className="font-medium">Удирдах</h2>
            <CustomerControl
              customerId={profile.id}
              role={profile.role}
              loyaltyPoints={profile.loyalty_points}
              isBlocked={profile.is_blocked}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-serif text-xl font-semibold">{value}</p>
      <p className="text-muted-foreground text-xs">{label}</p>
    </div>
  );
}
