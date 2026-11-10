import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getStaffUser } from "@/lib/auth/guard";
import { formatDateTime, formatPrice } from "@/lib/format";
import { getAdminGiftCard } from "@/features/gift-cards/admin-api";
import { getGiftCardByToken } from "@/features/gift-cards/server";
import { GiftCardFace } from "@/features/gift-cards/components/gift-card-face";
import { GiftCardAdminActions } from "@/features/gift-cards/components/admin/gift-card-admin-actions";
import { GIFT_STATUS_LABEL } from "@/features/gift-cards/lib";

export const dynamic = "force-dynamic";
export const metadata = { title: "Бэлгийн карт" };

const EVENT_LABEL: Record<string, string> = {
  issued: "Төлбөр орж идэвхжсэн",
  sent: "Хүлээн авагч руу илгээсэн",
  send_failed: "Илгээлт амжилтгүй",
  resent: "Дахин илгээсэн",
  email_changed: "Имэйл өөрчилсөн",
  redeemed: "Оноо болгосон",
  expired: "Хугацаа дууссан",
  extended: "Хугацаа сунгасан",
  voided: "Хүчингүй болгосон",
  reminded: "Сануулга",
  buyer_notified: "Худалдан авагчид мэдэгдсэн",
};

function eventDetail(kind: string, data: Record<string, unknown>): string {
  if (kind === "extended") {
    return `${String(data.reason ?? "")} → ${data.to ? formatDateTime(String(data.to)) : ""}`;
  }
  if (kind === "email_changed") return `${String(data.from ?? "—")} → ${String(data.to ?? "")}`;
  if (kind === "redeemed") return `${Number(data.points ?? 0).toLocaleString("mn-MN")} V point`;
  if (kind === "reminded") {
    const k = { unused: "ашиглаагүй", expiry_30: "30 хоног", expiry_7: "7 хоног" }[
      String(data.kind) as "unused"
    ];
    return `${k ?? ""}${data.ok === false ? " (амжилтгүй)" : ""}`;
  }
  if (typeof data.to === "string") return data.to;
  return "";
}

export default async function AdminGiftCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isFeatureEnabled("gift_cards"))) notFound();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/u.test(id)) notFound();
  const [card, staff] = await Promise.all([getAdminGiftCard(id), getStaffUser()]);
  if (!card) notFound();
  const face = await getGiftCardByToken(card.token, null);

  const rows: [string, React.ReactNode][] = [
    ["Төлөв", GIFT_STATUS_LABEL[card.status]],
    ["Дүн", formatPrice(card.amount)],
    ["Загвар", card.designTitle],
    ["Захиалга", <Link key="o" href={`/admin/orders/${card.orderId}`} className="underline">{card.orderNo}</Link>],
    ["Худалдан авагч", `${card.buyerName ?? "—"} ${card.buyerPhone ?? ""}`],
    ["Хэнд / хэнээс", `${card.recipientName} / ${card.fromName}`],
    ["Имэйл", card.recipientEmail ?? "Өөрөө өгнө"],
    ["Товлосон", card.sendAt ? formatDateTime(card.sendAt) : "—"],
    ["Илгээсэн", card.sentAt ? formatDateTime(card.sentAt) : card.lastSendError ? "Амжилтгүй" : "—"],
    ["Хугацаа", card.expiresAt ? formatDateTime(card.expiresAt) : "—"],
    [
      "Оноо болгосон",
      card.redeemedAt
        ? `${formatDateTime(card.redeemedAt)} · ${card.redeemedByName ?? ""} ${card.redeemedByPhone ?? ""} · ${(card.points ?? 0).toLocaleString("mn-MN")} V point`
        : "—",
    ],
  ];

  return (
    <div className="space-y-6">
      <Link
        href="/admin/gift-cards"
        className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline"
      >
        <ArrowLeft className="size-4" /> Бэлгийн карт
      </Link>
      <PageHeader
        title={card.code}
        actions={
          <GiftCardAdminActions
            cardId={card.id}
            status={card.status}
            recipientEmail={card.recipientEmail}
            canExtend={staff?.role === "super_admin"}
          />
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="space-y-3">
          {face && <GiftCardFace design={face.design} text={face} />}
          {card.message && (
            <p className="text-muted-foreground text-sm">«{card.message}»</p>
          )}
        </div>
        <dl className="bg-card divide-border divide-y rounded-xl px-4">
          {rows.map(([label, value]) => (
            <div key={label} className="flex gap-4 py-2.5 text-sm">
              <dt className="text-muted-foreground w-36 shrink-0">{label}</dt>
              <dd className="min-w-0">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <section className="space-y-2">
        <h2 className="font-semibold">Түүх</h2>
        <ol className="bg-card divide-border divide-y rounded-xl px-4">
          {card.events.map((e) => (
            <li key={e.id} className="flex flex-wrap gap-x-4 py-2.5 text-sm">
              <span className="text-muted-foreground w-40 shrink-0 tabular-nums">
                {formatDateTime(e.createdAt)}
              </span>
              <span className="font-medium">{EVENT_LABEL[e.kind] ?? e.kind}</span>
              <span className="text-muted-foreground">{eventDetail(e.kind, e.data)}</span>
              {e.actorName && <span className="text-muted-foreground ml-auto">{e.actorName}</span>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
