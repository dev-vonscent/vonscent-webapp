"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { MotionConfig, motion } from "motion/react";
import {
  Check,
  ChevronDown,
  Loader2,
  QrCode,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatPrice } from "@/lib/format";
import { trackPurchase } from "@/lib/analytics";
import { BANK_TRANSFER } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  DISPATCH_HOUR,
  ORDER_EDIT_CUTOFF_HOUR,
  earliestDeliveryDay,
  formatDeliveryDay,
  projectedDeliveryDay,
} from "@/lib/time";
import type { PaymentView } from "../types";
import { BankApps } from "./bank-apps";
import { CopyRow } from "./copy-row";

/**
 * The payment page.
 *
 * The order is **not** confirmed when this page opens — `place_order` leaves it
 * `pending` with an inventory hold, and only `mark_order_paid` moves it to
 * `confirmed`. So the page opens as "pay now", not as a receipt, and the whole
 * layout exists to get one thing done before the hold lapses.
 *
 * The hierarchy is deliberate: the amount is the hero, the bank apps are the
 * single obvious action, and everything else (QR, invoice id, order number)
 * recedes. Its predecessor led with a big green tick and a card of key/value
 * rows, which read as a receipt for money nobody had sent yet.
 *
 * While a payment is outstanding the page offers no way out of it — no link to
 * the order list, no reassurance copy under the check button. Every one of
 * those is an invitation to leave a page whose only job is to get one thing
 * paid before the inventory hold lapses. The exits belong on the states that
 * are actually finished: paid, and cancelled.
 */

/** Cheap poll of `orders.payment_status` — what the QPay callback writes. */
const POLL_MS = 3_000;
/** Every Nth poll asks QPay directly, so a lost callback still resolves. */
const VERIFY_EVERY = 5;
/** Stop polling eventually; the reserve hold is long gone by then. */
const POLL_TIMEOUT_MS = 20 * 60_000;

export function PaymentPanel({
  view,
  token,
}: {
  view: PaymentView;
  token: string;
}) {
  const [paid, setPaid] = React.useState(view.paid);
  /**
   * Хуудас нээлттэй байхад захиалга цуцлагдаж болно (админ, эсвэл хэрэглэгч
   * өөр таб дээр). Тийм үед poller-ийг зогсоож, цуцлагдсаныг шууд харуулна —
   * `mark_order_paid` тэр захиалгыг хэзээ ч төлөгдсөн болгохгүй.
   */
  const [cancelled, setCancelled] = React.useState(view.cancelled);
  /**
   * Хүргэх өдөр нь төлбөр төлөгдсөн мөчид ахьж болно (migration 0069: 09:00-аас
   * хойш төлсөн бол тэр өдөр хүргэх боломж аль хэдийн өнгөрсөн). Хуудас
   * нээгдэхэд уншсан өдөр нь тийм тохиолдолд хуучирдаг тул төлөгдсөн гэсэн
   * хариунаас шинэ өдрийг авна.
   */
  const [deliverOn, setDeliverOn] = React.useState(view.deliverOn);
  const [checking, setChecking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isQpay = view.paymentMethod === "qpay";
  const waiting = !paid && !cancelled;
  /** Set only when the invoice asks for less than the order is worth. */
  const testAmount =
    view.invoice && view.invoice.amount < view.total
      ? view.invoice.amount
      : null;

  const check = React.useCallback(
    async (verify: boolean) => {
      const res = await fetch(
        `/api/payments/status?token=${encodeURIComponent(token)}` +
          (verify ? "&verify=1" : ""),
      );
      if (!res.ok) return false;
      const data = (await res.json()) as {
        paid?: boolean;
        cancelled?: boolean;
        deliverOn?: string | null;
      };
      if (data?.paid) {
        if (data.deliverOn) setDeliverOn(data.deliverOn);
        setPaid(true);
      }
      if (data?.cancelled) setCancelled(true);
      // Аль аль нь poller-ийн төгсгөл: цааш хүлээх зүйл алга.
      return Boolean(data?.paid) || Boolean(data?.cancelled);
    },
    [token],
  );

  // Background polling, only while a QPay payment is genuinely outstanding. A
  // bank transfer is confirmed by a human, so polling it would be pure noise.
  React.useEffect(() => {
    if (!isQpay || !waiting || view.mock) return;
    const startedAt = Date.now();
    let ticks = 0;

    const timer = setInterval(async () => {
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        clearInterval(timer);
        return;
      }
      ticks += 1;
      try {
        if (await check(ticks % VERIFY_EVERY === 0)) clearInterval(timer);
      } catch {
        // transient — keep polling
      }
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [isQpay, waiting, view.mock, check]);

  // Purchase analytics fire on confirmed payment only. An unpaid invoice on
  // this page is an abandoned checkout, not a purchase.
  React.useEffect(() => {
    if (!paid) return;
    const key = `vonscent-purchase-${view.orderNo}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // storage blocked — fire anyway; a duplicate event beats none
    }
    trackPurchase(view.orderNo, [], view.total);
  }, [paid, view.orderNo, view.total]);

  async function onManualCheck() {
    setChecking(true);
    setError(null);
    try {
      if (!(await check(true))) {
        setError(
          "Төлбөр хараахан бүртгэгдээгүй байна. Төлсөн бол хэдэн секундын дараа дахин шалгана уу.",
        );
      }
    } catch {
      setError("Шалгах үед алдаа гарлаа. Дахин оролдоно уу.");
    } finally {
      setChecking(false);
    }
  }

  async function onMockConfirm() {
    setChecking(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/qpay/mock/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        setError("Симуляц бүтсэнгүй.");
        return;
      }
      const data = (await res.json().catch(() => null)) as {
        deliverOn?: string | null;
      } | null;
      if (data?.deliverOn) setDeliverOn(data.deliverOn);
      setPaid(true);
    } finally {
      setChecking(false);
    }
  }

  if (cancelled) return <CancelledState />;
  if (paid) return <PaidState view={view} deliverOn={deliverOn} />;

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className={cn(
          "mx-auto px-4 py-10 md:py-16",
          // One narrow column on a phone; two on a desktop, where a 512px
          // column in the middle of a 1440px window reads as a phone screen
          // someone forgot to lay out. The left rail carries what is being
          // paid, the right one how to pay it.
          "max-w-lg md:grid md:max-w-4xl md:grid-cols-[minmax(0,1fr)_420px] md:items-start md:gap-14",
        )}
      >
        <div className="md:sticky md:top-24">
          <div className="flex justify-center md:justify-start">
            <StatusPill />
          </div>

          {/* The amount is the page. Everything else is how to send it. */}
          <h1 className="mt-5 text-center font-serif text-5xl font-semibold tracking-tight tabular-nums sm:text-6xl md:text-left">
            {formatPrice(view.total)}
          </h1>

          {/*
            A staff test order under QPAY_TEST_AMOUNT collects a token sum
            instead of the total. Saying so loudly is the point: an invoice
            that quietly asks for 10₮ is exactly the bug this feature would be
            if it ever reached a customer.
          */}
          {testAmount != null && (
            <p className="border-destructive/40 bg-destructive/10 text-destructive mt-4 rounded-xl border px-3 py-2 text-center text-xs md:text-left">
              Тест горим — QR нь {formatPrice(testAmount)} нэхнэ, бүтэн дүнг
              биш.
            </p>
          )}

          <OrderRecap view={view} />
        </div>

        {/*
          No card on a phone. A bordered panel inset in a 4-unit gutter wastes
          the width the app grid needs and boxes in content that already fills
          the screen; the card earns its keep only once the viewport is wider
          than the content (md+).
        */}
        <div className="md:border-border md:bg-card mt-6 md:mt-0 md:overflow-hidden md:rounded-2xl md:border">
          {isQpay ? (
            <QpaySection
              view={view}
              checking={checking}
              error={error}
              onManualCheck={onManualCheck}
              onMockConfirm={onMockConfirm}
            />
          ) : (
            <BankTransfer orderNo={view.orderNo} />
          )}
        </div>
      </motion.div>
    </MotionConfig>
  );
}

/**
 * Юуны төлөө төлж байгаа нь — зүүн талын мөр.
 *
 * Хуудас нээгдэхэд «22,790₮» гэсэн тоо ба QR л байсан: төлбөрийн линк нь
 * бусдад дамжиж болдог, дамжуулж авсан хүн юуны төлөө хэдийг төлж байгаагаа
 * харах ёстой. Хаяг, холбоо барих мэдээллийг зориуд оруулаагүй (api.ts).
 */
function OrderRecap({ view }: { view: PaymentView }) {
  if (view.lines.length === 0) return null;
  return (
    <div className="border-border bg-card mt-6 rounded-2xl border p-4 md:mt-8 md:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium">Захиалга</p>
        <span className="text-muted-foreground font-mono text-xs">
          {view.orderNo}
        </span>
      </div>

      <ul className="divide-border mt-3 divide-y">
        {view.lines.map((line, i) => (
          <li
            key={`${line.name}-${line.ml}-${i}`}
            className="flex items-center gap-3 py-2.5"
          >
            <div className="relative size-11 shrink-0">
              <div className="bg-muted size-full overflow-hidden rounded-lg">
                {line.image && (
                  <Image
                    src={line.image}
                    alt={line.name}
                    fill
                    sizes="44px"
                    className="object-cover"
                  />
                )}
              </div>
              {line.qty > 1 && (
                <span className="bg-foreground text-background absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full text-[10px] font-semibold">
                  {line.qty}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm/tight font-medium">{line.name}</p>
              <p className="text-muted-foreground truncate text-xs">
                {[
                  line.brand,
                  `${line.ml}ml`,
                  line.collectionName ?? null,
                  line.isSample ? "бэлэг" : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <span className="text-sm font-medium tabular-nums">
              {line.isSample && line.lineTotal === 0
                ? "0₮"
                : formatPrice(line.lineTotal)}
            </span>
          </li>
        ))}
      </ul>

      {/* Тоог тайлбарлах бүтэц — «яагаад 22,790₮ болов?» гэсэн асуулт
          хуудсан дээрээ хариулттай байх ёстой. */}
      <div className="border-border mt-3 space-y-1.5 border-t pt-3 text-xs">
        <RecapRow label="Барааны дүн" value={formatPrice(view.subtotal)} />
        <RecapRow label="Хүргэлт" value={formatPrice(view.shippingFee)} />
        {view.discount > 0 && (
          <RecapRow
            label="Хөнгөлөлт"
            value={`−${formatPrice(view.discount)}`}
            accent
          />
        )}
        {view.loyaltyUsed > 0 && (
          <RecapRow
            label="V point"
            value={`−${formatPrice(view.loyaltyUsed)}`}
            accent
          />
        )}
      </div>

      {/* Төлбөр хоцорсон бол сонгосон өдөр аль хэдийн өнгөрсөн байж мэднэ —
          `mark_order_paid` (0069) төлөх мөчид өдрийг ахиулна. Тиймээс энд
          хадгалсан өдрийг биш, одоо төлөхөд хүргэгдэх өдрийг харуулна. */}
      <p className="text-muted-foreground mt-3 text-xs">
        <strong className="text-foreground font-medium">
          {formatDeliveryDay(projectedDeliveryDay(view.deliverOn))}
        </strong>{" "}
        {DISPATCH_HOUR}:00 цагт хүргэлтэд гарна.
      </p>
    </div>
  );
}

function RecapRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn("tabular-nums", accent ? "text-success" : "font-medium")}
      >
        {value}
      </span>
    </div>
  );
}

/** Live "waiting" affordance — a soft pulse, not a spinner racing the clock. */
function StatusPill() {
  return (
    <div className="flex justify-center">
      <span className="border-border bg-card text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium">
        <span className="relative flex size-1.5">
          <span className="bg-gold-strong absolute inline-flex size-full animate-ping rounded-full opacity-60" />
          <span className="bg-gold-strong relative inline-flex size-1.5 rounded-full" />
        </span>
        Төлбөр хүлээгдэж байна
      </span>
    </div>
  );
}

function QpaySection({
  view,
  checking,
  error,
  onManualCheck,
  onMockConfirm,
}: {
  view: PaymentView;
  checking: boolean;
  error: string | null;
  onManualCheck: () => void;
  onMockConfirm: () => void;
}) {
  const invoice = view.invoice;
  // Desktop opens on the QR (no app on the machine); a phone opens on the apps
  // and keeps the QR one tap away, since it cannot scan its own screen.
  const [qrOpen, setQrOpen] = React.useState(false);

  if (!invoice) {
    return (
      <div className="space-y-3 py-5 md:p-5">
        <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
          QPay-тэй холбогдож чадсангүй. Захиалга тань нөөцлөгдсөн хэвээр байгаа
          — дахин оролдоно уу.
        </p>
        <Button variant="outline" className="w-full" onClick={onManualCheck}>
          <RefreshCw className="size-4" /> Дахин оролдох
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/*
        Банкны аппын сүлжээ зөвхөн хүрэлцэхүйц төхөөрөмж дээр (`pointer-coarse`
        — утас, таблет). Web дээр `khanbank://` линк нээх апп байхгүй тул
        дарахад «хаяг буруу» гэсэн мухардал болдог: тэнд QR л жинхэнэ арга,
        иймд апп бүрэн харагдахгүй. Breakpoint биш pointer-оор шалгаж байгаа
        нь ноутбукийн хагас өргөн цонх ч апп нээж чадахгүйтэй адил.
      */}
      <div data-touch-only className="hidden pointer-coarse:block">
        {/* The group headings ("Банк", "Цахим хэтэвч") already say what this
            is, so it carries no heading of its own. */}
        <div className="pb-6 md:p-5">
          <BankApps links={invoice.deeplinks} mock={view.mock} />
        </div>
        <Separator />
      </div>

      <div className="py-5 md:p-5">
        <button
          type="button"
          onClick={() => setQrOpen((v) => !v)}
          aria-expanded={qrOpen}
          // Апп нээж чадах төхөөрөмж дээр л QR-г нугалж хийнэ; web дээр QR
          // нь цорын ганц арга тул хумихгүй.
          className="hidden w-full items-center gap-2 text-sm font-medium md:hidden pointer-coarse:flex"
        >
          <QrCode className="text-muted-foreground size-4" />
          QR кодоор төлөх
          <ChevronDown
            className={cn(
              "text-muted-foreground ml-auto size-4 transition-transform",
              qrOpen && "rotate-180",
            )}
          />
        </button>

        <div className="hidden items-center gap-2 md:flex pointer-fine:flex">
          <QrCode className="text-gold-strong size-4" />
          <p className="text-sm font-medium">Банкны аппаараа QR уншуулна уу</p>
        </div>

        <div
          className={cn(
            "md:block pointer-fine:block",
            qrOpen ? "block" : "hidden",
          )}
        >
          {invoice.qrImage && (
            <div className="mt-4 flex flex-col items-center gap-3">
              {/* Not next/image: a data: URL has no host to whitelist and
                  nothing to optimise — it is already a rendered PNG. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={invoice.qrImage}
                alt="QPay QR код"
                width={256}
                height={256}
                // Bigger on a desktop, where this is the only way to pay and
                // the customer is scanning it from arm's length with a phone.
                className="border-border size-52 rounded-xl border bg-white p-3 md:size-64"
              />
              {/* On a desktop the heading above already says this; the link
                  stays on both, since "open it on my phone" is exactly what a
                  desktop customer wants. */}
              <p className="text-muted-foreground text-center text-xs">
                <span className="hidden md:hidden pointer-coarse:inline">
                  Банкны аппаа онгойлгоод QR уншуулна уу
                  {invoice.shortUrl && " · "}
                </span>
                {invoice.shortUrl && (
                  <a
                    href={invoice.shortUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-foreground underline"
                  >
                    Утсан дээрээ нээх
                  </a>
                )}
              </p>
            </div>
          )}
        </div>
      </div>

      <Separator />

      <div className="space-y-3 py-5 md:p-5">
        {error && (
          <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
            {error}
          </p>
        )}

        {view.mock ? (
          <Button
            className="w-full"
            disabled={checking}
            onClick={onMockConfirm}
          >
            {checking ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Баталгаажуулж байна…
              </>
            ) : (
              "Төлбөр баталгаажуулах (mock)"
            )}
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              className="w-full"
              disabled={checking}
              onClick={onManualCheck}
            >
              {checking ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Шалгаж байна…
                </>
              ) : (
                <>
                  <RefreshCw className="size-4" /> Төлбөр шалгах
                </>
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function BankTransfer({ orderNo }: { orderNo: string }) {
  return (
    <div className="space-y-4 py-5 md:p-5">
      <p className="text-sm font-medium">Банкны шилжүүлгээр төлөх</p>
      <p className="text-muted-foreground text-sm">
        Доорх дансанд шилжүүлэг хийж, <strong>гүйлгээний утга</strong> дээр
        захиалгын дугаараа бичнэ үү. Шилжүүлэг бүртгэгдмэгц захиалга
        баталгаажна.
      </p>
      <div className="bg-secondary rounded-md px-3 py-1.5">
        <CopyRow label="Банк" value={BANK_TRANSFER.bank} />
        <CopyRow label="Данс" value={BANK_TRANSFER.account} copy mono />
        <CopyRow label="Хүлээн авагч" value={BANK_TRANSFER.holder} />
        <CopyRow label="Гүйлгээний утга" value={orderNo} copy mono />
      </div>
    </div>
  );
}

function PaidState({
  view,
  deliverOn,
}: {
  view: PaymentView;
  /** Төлбөр батлагдсаны дараах хүргэх өдөр — сервер ахиулсан байж мэднэ. */
  deliverOn: string | null;
}) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="mx-auto max-w-lg px-4 py-16 text-center md:py-24"
      >
        <motion.span
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.35, delay: 0.05, ease: "easeOut" }}
          className="bg-success/12 text-success mx-auto flex size-16 items-center justify-center rounded-full"
        >
          <Check className="size-8" strokeWidth={2.5} />
        </motion.span>

        <h1 className="mt-6 font-serif text-3xl font-semibold tracking-tight">
          Төлбөр амжилттай
        </h1>
        <p className="text-muted-foreground mt-2">
          Захиалга{" "}
          <span className="text-foreground font-mono font-medium">
            {view.orderNo}
          </span>{" "}
          баталгаажлаа — {formatPrice(view.total)}
        </p>

        <div className="border-border bg-card mt-8 rounded-2xl border p-5 text-left">
          <p className="text-sm">
            <strong>
              {formatDeliveryDay(deliverOn ?? earliestDeliveryDay())}
            </strong>{" "}
            {DISPATCH_HOUR}:00 цагт хүргэлтэд гарна.
          </p>
          <p className="text-muted-foreground mt-2 text-xs">
            Тэр өдрийн өглөөний {ORDER_EDIT_CUTOFF_HOUR}:00 цаг хүртэл цуцлах
            боломжтой. Захиалгын явцыг «Захиалгаа хянах» хэсгээс харна.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="outline" className="flex-1">
            <Link href="/account/orders">Захиалгаа хянах</Link>
          </Button>
          <Button asChild className="flex-1">
            <Link href="/catalog">Дэлгүүр үзэх</Link>
          </Button>
        </div>
      </motion.div>
    </MotionConfig>
  );
}

function CancelledState() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center md:py-24">
      <span className="bg-destructive/10 text-destructive mx-auto flex size-16 items-center justify-center rounded-full">
        <XCircle className="size-8" strokeWidth={2} />
      </span>
      <h1 className="mt-6 font-serif text-3xl font-semibold tracking-tight">
        Захиалга цуцлагдсан
      </h1>
      <p className="text-muted-foreground mt-2">
        Төлбөр хийгдээгүй тул нөөцийн хугацаа дууссан байна. Барааг дахин
        сагслаад захиалаарай.
      </p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Button asChild variant="outline">
          <Link href="/account/orders">Захиалгаа хянах</Link>
        </Button>
        <Button asChild>
          <Link href="/catalog">Дэлгүүр үзэх</Link>
        </Button>
      </div>
    </div>
  );
}
