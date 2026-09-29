"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Gift, Loader2, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart, selectSubtotal } from "@/features/cart/store";
import { formatPrice, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { daysLeft, describeRedemption, type CouponStatus } from "./coupons";
import { useWalletCoupon } from "../use-coupons";
import { CopyCodeButton } from "./coupon-actions";
import {
  STUB_RATIO,
  TicketOutline,
  TicketStub,
  couponLabel,
} from "./coupon-ticket";

/**
 * One coupon, in full.
 *
 * The wallet shows the row; this shows the thing itself — the ticket at the
 * top with the value, the code and every condition attached to it, who has
 * used it (masked, 0104), and one action at the bottom. "Ашиглах" is the whole
 * point of an active coupon, so it is the only big button and it sits where a
 * thumb lands; a used or expired coupon has none.
 *
 * Read from `/api/account/coupons/<code>`, never from the browser: a friend's
 * redemption row is invisible to the owner under RLS, and the server is the
 * one place that masks who they are.
 *
 * Applying goes through `/api/coupons/validate` rather than trusting what the
 * browser already knows: the discount depends on the current cart total, and
 * the coupon may have been spent in another tab since this page loaded.
 */

const STATUS_LABEL: Record<CouponStatus, string> = {
  active: "Идэвхтэй",
  used: "Ашиглагдсан",
  expired: "Хугацаа дууссан",
};

export function CouponDetail({ code }: { code: string }) {
  const router = useRouter();
  const { data: coupon, isPending } = useWalletCoupon(code);
  const [applying, setApplying] = React.useState(false);
  // Амжилттай болсны дараа навигаци дуустал товч «бэлэн» рүү буцахгүй —
  // үгүй бол хэрэглэгч дуусаагүй гэж бодоод дахин дардаг.
  const [leaving, setLeaving] = React.useState(false);
  const pending = applying || leaving;
  const [error, setError] = React.useState<string | null>(null);

  const subtotal = useCart(selectSubtotal);
  const applyToCart = useCart((s) => s.setCoupon);
  // Купоныг сагсны дүн дээр шалгаж байгаа тул захиалга ч сагсаараа явна —
  // үлдсэн «Захиалах» мөр байвал энд хаягдана.
  const clearBuyNow = useCart((s) => s.clearBuyNow);

  async function onUse() {
    if (!coupon) return;
    // Nothing to discount yet — send them shopping rather than failing.
    if (subtotal <= 0) {
      setLeaving(true);
      router.push("/catalog");
      return;
    }
    setApplying(true);
    setError(null);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: coupon.code, subtotal }),
      });
      const data = await res.json();
      if (!data.valid) {
        setError(data.message ?? "Купон хүчингүй байна.");
        return;
      }
      applyToCart({ code: data.code ?? coupon.code, discount: data.discount });
      clearBuyNow();
      setLeaving(true);
      router.push("/checkout");
    } catch {
      setError("Алдаа гарлаа. Дахин оролдоно уу.");
    } finally {
      setApplying(false);
    }
  }

  if (isPending) {
    return <div className="mx-auto min-h-[60vh] max-w-md px-4 py-10" />;
  }

  if (!coupon) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <Ticket
          className="text-muted-foreground mx-auto size-12"
          strokeWidth={1.5}
        />
        <h1 className="mt-4 font-serif text-2xl font-semibold">
          Купон олдсонгүй
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Энэ код таны купонуудын дунд алга. Найзаас авсан код бол захиалга
          хийхдээ купоны талбарт шууд бичээрэй.
        </p>
        <Button asChild className="mt-6">
          <Link href="/account/coupons">Миний купон руу буцах</Link>
        </Button>
      </div>
    );
  }

  const label = couponLabel(coupon.type, coupon.value);
  const active = coupon.status === "active";
  const days = active ? daysLeft(coupon.endsAt) : null;
  const urgent = days != null && days <= 3;

  return (
    <div
      className={cn("mx-auto max-w-md px-4 pt-6", active ? "pb-28" : "pb-10")}
    >
      <Link
        href="/account/coupons"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors"
      >
        <ArrowLeft className="size-3.5" /> Миний купон
      </Link>

      {/* The same ticket as the wallet, at hero size. */}
      <div
        className={cn(
          "relative mt-4 aspect-video",
          active
            ? "text-muted-foreground/50"
            : "text-muted-foreground/30 opacity-70",
        )}
      >
        <TicketOutline />
        <TicketStub className="text-muted-foreground/70" />
        <span
          className="absolute inset-y-0 right-0 flex flex-col items-center justify-center gap-1"
          style={{ left: `${STUB_RATIO * 100}%` }}
        >
          <span className="text-foreground font-serif text-6xl font-semibold">
            {label}
          </span>
          <span className="text-muted-foreground text-xs font-medium">
            {STATUS_LABEL[coupon.status]}
          </span>
        </span>
      </div>

      <div className="bg-secondary mt-4 flex items-center gap-3 rounded-xl px-4 py-3">
        <span className="min-w-0 flex-1">
          <span className="text-muted-foreground block text-[11px]">
            Купоны код
          </span>
          <span className="block truncate font-mono text-lg font-semibold tracking-wider">
            {coupon.code}
          </span>
        </span>
        {active && <CopyCodeButton code={coupon.code} />}
      </div>

      <dl className="mt-6 space-y-px overflow-hidden rounded-xl">
        <Detail label="Хүчинтэй хугацаа">
          {coupon.endsAt ? (
            <span className={cn(urgent && "text-destructive font-medium")}>
              {formatDate(coupon.endsAt)}
              {days != null &&
                ` · ${days <= 1 ? "өнөөдөр дуусна" : `${days} хоног үлдсэн`}`}
            </span>
          ) : (
            "Хугацаагүй"
          )}
        </Detail>
        <Detail label="Доод хязгаар">
          {coupon.minSubtotal > 0
            ? `${formatPrice(coupon.minSubtotal)}-өөс дээш захиалга`
            : "Байхгүй"}
        </Detail>
        {coupon.type === "percent" && coupon.maxDiscount != null && (
          <Detail label="Дээд хөнгөлөлт">
            {formatPrice(coupon.maxDiscount)}
          </Detail>
        )}
        <Detail label="Ашиглах тоо">
          {coupon.maxUses != null
            ? `${Math.max(coupon.maxUses - coupon.usedCount, 0)} удаа үлдсэн`
            : "Хязгааргүй"}
        </Detail>
        {coupon.source === "spin" && (
          <Detail label="Хаанаас">
            <span className="inline-flex items-center gap-1.5">
              <Gift className="text-muted-foreground size-3.5" /> Азын хүрднээс
            </span>
          </Detail>
        )}
      </dl>

      {coupon.redemptions.length > 0 && (
        <div className="mt-6">
          <h2 className="text-muted-foreground mb-2 text-xs font-medium">
            Ашигласан
          </h2>
          <ul className="space-y-px overflow-hidden rounded-xl">
            {coupon.redemptions.map((r) => (
              <li
                key={r.at}
                className="bg-secondary flex items-center justify-between gap-4 px-4 py-3 text-sm"
              >
                <span>{describeRedemption(r)}</span>
                <span className="text-muted-foreground text-xs">
                  {formatDate(r.at)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p className="bg-destructive/10 text-destructive mt-6 flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      {/* One action, pinned where a thumb lands. */}
      {active && (
        <div className="bg-background/95 border-border fixed inset-x-0 bottom-20 z-40 border-t px-4 py-3 backdrop-blur md:bottom-0">
          <div className="mx-auto max-w-md">
            <Button
              size="lg"
              className="w-full in-[.black]:bg-white in-[.black]:text-black in-[.black]:hover:bg-white/90"
              disabled={pending}
              onClick={onUse}
            >
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Шалгаж байна…
                </>
              ) : subtotal > 0 ? (
                "Ашиглах"
              ) : (
                "Дэлгүүр үзэх"
              )}
            </Button>
            {subtotal <= 0 && (
              <p className="text-muted-foreground mt-2 text-center text-[11px]">
                Сагс хоосон байна — бараа нэмээд купоноо хэрэглээрэй.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-secondary flex items-center justify-between gap-4 px-4 py-3">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-right text-sm">{children}</dd>
    </div>
  );
}
