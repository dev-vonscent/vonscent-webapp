import Link from "next/link";
import { notFound } from "next/navigation";
import { CreditCard, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterChip } from "@/features/admin/components/filter-chip";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { formatDate, formatPrice } from "@/lib/format";
import {
  ADMIN_GIFT_STATUSES,
  getAdminGiftCardStats,
  getAdminGiftCards,
} from "@/features/gift-cards/admin-api";
import { GIFT_STATUS_LABEL, formatGiftAmount } from "@/features/gift-cards/lib";
import type { GiftCardStatus } from "@/db/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Бэлгийн карт" };

function isStatus(v: string | undefined): v is GiftCardStatus {
  return (ADMIN_GIFT_STATUSES as readonly string[]).includes(v ?? "");
}

/**
 * Админ → Маркетинг → Бэлгийн карт (gift-cards-plan §5.1). Туг хаалттай бол
 * 404. Жагсаалт, хайлт; дэлгэрэнгүй хуудсанд дахин илгээх.
 */
export default async function AdminGiftCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  if (!(await isFeatureEnabled("gift_cards"))) notFound();
  const { status: rawStatus, q } = await searchParams;
  const status = isStatus(rawStatus) ? rawStatus : null;
  const [cards, stats] = await Promise.all([
    getAdminGiftCards({ status, q }),
    getAdminGiftCardStats(),
  ]);
  const qs = (s: GiftCardStatus | null) => {
    const p = new URLSearchParams();
    if (s) p.set("status", s);
    if (q) p.set("q", q);
    const str = p.toString();
    return `/admin/gift-cards${str ? `?${str}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Бэлгийн карт"
        count={cards.length}
        description={
          <>
            Ашиглагдаагүй үлдэгдэл:{" "}
            <strong className="text-foreground tabular-nums">
              {formatPrice(stats.outstanding)}
            </strong>{" "}
            ({stats.counts.active} карт). Энэ нь карт эзэмшигчид кодоо
            оруулахад олгох оноо — тайланд «мэдээлэл» болж харагдана.
          </>
        }
        actions={
          <Button asChild variant="secondary">
            <Link href="/admin/gift-cards/designs">
              <Palette className="size-4" /> Загвар
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <FilterChip label="Бүгд" href={qs(null)} active={status === null} />
        {ADMIN_GIFT_STATUSES.map((s) => (
          <FilterChip
            key={s}
            label={`${GIFT_STATUS_LABEL[s]} · ${stats.counts[s]}`}
            href={qs(s)}
            active={status === s}
          />
        ))}
        <form action="/admin/gift-cards" className="ml-auto flex gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          <Input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Код, нэр, имэйл"
            className="w-56"
            aria-label="Хайх"
          />
          <Button type="submit" variant="secondary">
            Хайх
          </Button>
        </form>
      </div>

      {cards.length === 0 ? (
        <EmptyState
          surface="card"
          icon={CreditCard}
          title={q || status ? "Тохирох карт олдсонгүй." : "Одоогоор бэлгийн карт зарагдаагүй байна."}
        />
      ) : (
        <div className="bg-card overflow-x-auto rounded-xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Огноо</TableHead>
                <TableHead>Код</TableHead>
                <TableHead className="text-right">Дүн</TableHead>
                <TableHead>Хүлээн авагч</TableHead>
                <TableHead>Худалдан авагч</TableHead>
                <TableHead>Илгээлт</TableHead>
                <TableHead>Төлөв</TableHead>
                <TableHead>Хугацаа</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cards.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="whitespace-nowrap">{formatDate(c.createdAt)}</TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/gift-cards/${c.id}`}
                      className="font-mono font-medium underline-offset-2 hover:underline"
                    >
                      {c.code}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatGiftAmount(c.amount)}
                  </TableCell>
                  <TableCell>
                    <div>{c.recipientName}</div>
                    <div className="text-muted-foreground text-xs">
                      {c.recipientEmail ?? "Өөрөө өгнө"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>{c.buyerName || c.fromName}</div>
                    <div className="text-muted-foreground text-xs">
                      {c.buyerPhone ?? ""} · {c.orderNo}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    {!c.recipientEmail
                      ? "—"
                      : c.sentAt
                        ? `Илгээсэн ${formatDate(c.sentAt)}`
                        : c.lastSendError
                          ? <span className="text-destructive">Амжилтгүй</span>
                          : c.sendAt
                            ? `Товлосон ${formatDate(c.sendAt)}`
                            : "Хүлээгдэж буй"}
                  </TableCell>
                  <TableCell>{GIFT_STATUS_LABEL[c.status]}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {c.redeemedAt
                      ? `Ашигласан ${formatDate(c.redeemedAt)}`
                      : c.expiresAt
                        ? formatDate(c.expiresAt)
                        : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
