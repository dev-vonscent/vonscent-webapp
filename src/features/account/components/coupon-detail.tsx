"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Copy,
  Gift,
  Loader2,
  Ticket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/browser";
import { useCart, selectSubtotal } from "@/features/cart/store";
import { formatPrice, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { daysLeft, usable, type CouponRecord } from "./coupons";
import {
  STUB_RATIO,
  TicketOutline,
  TicketStub,
  couponLabel,
} from "./coupon-ticket";

/**
 * One coupon, in full.
 *
 * The account list shows an offer; this shows the thing itself — the ticket at
 * the top with the value, the code and every condition attached to it, and one
 * action at the bottom. "Ашиглах" is the whole point of the page, so it is the
 * only button and it sits where a thumb lands.
 *
 * Applying goes through `/api/coupons/validate` rather than trusting what the
 * browser already knows: the discount depends on the current cart total, and
 * the coupon may have been spent in another tab since this page loaded.
 */

type Row = CouponRecord & { source: string };

export function CouponDetail({ code }: { code: string }) {
  const router = useRouter();
  const [state, setState] = React.useState<"loading" | "missing" | "ready">(
    "loading",
  );
  const [coupon, setCoupon] = React.useState<Row | null>(null);
  /** Every code this customer holds for the same offer. */
  const [siblings, setSiblings] = React.useState<Row[]>([]);
  const [applying, setApplying] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const subtotal = useCart(selectSubtotal);
  const applyToCart = useCart((s) => s.setCoupon);

  React.useEffect(() => {
    const supabase = createClient();
    if (!supabase) return setState("missing");
    const select =
      "id, code, type, value, min_subtotal, ends_at, max_uses, used_count, user_id, source";
    supabase
      .from("coupons")
      .select(select)
      .eq("is_active", true)
      .then(({ data }) => {
        const rows = usable((data as Row[] | null) ?? []) as Row[];
        const hit = rows.find(
          (c) => c.code.toUpperCase() === code.toUpperCase(),
        );
        if (!hit) return setState("missing");
        setCoupon(hit);
        setSiblings(
          rows.filter(
            (c) =>
              c.id !== hit.id &&
              c.type === hit.type &&
              c.value === hit.value &&
              c.min_subtotal === hit.min_subtotal,
          ),
        );
        setState("ready");
      });
  }, [code]);

  async function onUse() {
    if (!coupon) return;
    // Nothing to discount yet — send them shopping rather than failing.
    if (subtotal <= 0) {
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
      router.push("/checkout");
    } catch {
      setError("Алдаа гарлаа. Дахин оролдоно уу.");
    } finally {
      setApplying(false);
    }
  }

  if (state === "loading") {
    return <div className="mx-auto min-h-[60vh] max-w-md px-4 py-10" />;
  }

  if (state === "missing" || !coupon) {
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
          Хугацаа нь дууссан, эсвэл аль хэдийн ашигласан байж магадгүй.
        </p>
        <Button asChild className="mt-6">
          <Link href="/account#coupons">Купонууд руу буцах</Link>
        </Button>
      </div>
    );
  }

  const days = daysLeft(coupon.ends_at);
  const urgent = days != null && days <= 3;

  return (
    <div className="mx-auto max-w-md px-4 pt-6 pb-28">
      <Link
        href="/account#coupons"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors"
      >
        <ArrowLeft className="size-3.5" /> Купонууд
      </Link>

      {/* The same ticket as the wallet grid, at hero size. */}
      <div className="text-muted-foreground/50 relative mt-4 aspect-video">
        <TicketOutline />
        <TicketStub className="text-muted-foreground/70" />
        <span
          className="absolute inset-y-0 right-0 flex flex-col items-center justify-center gap-1"
          style={{ left: `${STUB_RATIO * 100}%` }}
        >
          <span className="text-foreground font-serif text-6xl font-semibold">
            {couponLabel(coupon.type, coupon.value)}
          </span>
          {coupon.user_id && (
            <span className="text-muted-foreground text-xs font-medium">
              Зөвхөн танд
            </span>
          )}
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
        <CopyButton code={coupon.code} />
      </div>

      <dl className="mt-6 space-y-px overflow-hidden rounded-xl">
        <Detail label="Хүчинтэй хугацаа">
          {coupon.ends_at ? (
            <span className={cn(urgent && "text-destructive font-medium")}>
              {formatDate(coupon.ends_at)}
              {days != null &&
                ` · ${days <= 1 ? "өнөөдөр дуусна" : `${days} хоног үлдсэн`}`}
            </span>
          ) : (
            "Хугацаагүй"
          )}
        </Detail>
        <Detail label="Доод хязгаар">
          {coupon.min_subtotal > 0
            ? `${formatPrice(coupon.min_subtotal)}-өөс дээш захиалга`
            : "Байхгүй"}
        </Detail>
        <Detail label="Ашиглах тоо">
          {coupon.max_uses != null
            ? `${coupon.max_uses - coupon.used_count} удаа үлдсэн`
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

      {siblings.length > 0 && (
        <div className="mt-6">
          <p className="text-muted-foreground mb-2 text-xs">
            Танд ижил купон бас {siblings.length} ширхэг байна
          </p>
          <ul className="space-y-1.5">
            {siblings.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/account/coupons/${encodeURIComponent(c.code)}`}
                  className="bg-secondary hover:bg-accent flex items-center gap-2 rounded-lg px-3 py-2 transition-colors"
                >
                  <span className="flex-1 font-mono text-xs">{c.code}</span>
                  <span className="text-muted-foreground text-[11px]">
                    {c.ends_at ? formatDate(c.ends_at) : ""}
                  </span>
                </Link>
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
      <div className="bg-background/95 border-border fixed inset-x-0 bottom-20 z-40 border-t px-4 py-3 backdrop-blur md:bottom-0">
        <div className="mx-auto max-w-md">
          <Button
            size="lg"
            className="w-full in-[.black]:bg-white in-[.black]:text-black in-[.black]:hover:bg-white/90"
            disabled={applying}
            onClick={onUse}
          >
            {applying ? (
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

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      aria-label={`${code} хуулах`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          // Clipboard blocked — the code is on screen and selectable.
        }
      }}
      className="bg-background hover:bg-accent flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors"
    >
      {copied ? (
        <Check className="text-foreground size-4" />
      ) : (
        <Copy className="size-4" />
      )}
    </button>
  );
}
