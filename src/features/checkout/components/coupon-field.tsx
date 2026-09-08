"use client";

import * as React from "react";
import { Check, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AvailableCoupon } from "@/app/api/coupons/available/route";

/**
 * The coupon field in the order summary.
 *
 * It replaced a bare input beside a row of grey pills that showed only a code
 * and a number. Two things made that worse than it looks: a customer cannot
 * tell `VW7K2X` from `VWQ13B` at a glance, and since the lucky wheel started
 * letting coupons accumulate (docs/lucky-wheel.md §0) they may hold several at
 * once — so the field's real job is to answer "which of mine saves the most
 * here?", not "type a code".
 *
 * Hence: the offers are rows led by what they *are* (10%, 10,000₮), the saving
 * on this cart is the loud number, the best one is marked, and the manual
 * input steps aside when the customer already has coupons to choose from.
 *
 * `/api/coupons/available` only ever returns coupons that validate against the
 * current subtotal, best first — so every row here is one tap from working,
 * and nothing needs to render a disabled or "not yet" state.
 */

export function CouponField({
  applied,
  offers,
  code,
  onCodeChange,
  onApply,
  applying,
  message,
  onPick,
  onRemove,
}: {
  applied: { code: string; discount: number } | null;
  offers: AvailableCoupon[];
  code: string;
  onCodeChange: (value: string) => void;
  onApply: () => void;
  applying: boolean;
  message: string | null;
  onPick: (coupon: AvailableCoupon) => void;
  onRemove: () => void;
}) {
  // With offers on screen the input is the fallback, so it starts folded away.
  const [manualOpen, setManualOpen] = React.useState(false);
  const showManual = manualOpen || offers.length === 0;

  if (applied) {
    return (
      <div className="border-gold-strong/40 bg-secondary flex items-center gap-3 rounded-xl border p-3">
        <span className="bg-gold-strong/15 text-gold-strong flex size-8 shrink-0 items-center justify-center rounded-full">
          <Check className="size-4" strokeWidth={2.5} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-mono text-sm font-semibold">
            {applied.code}
          </span>
          <span className="text-muted-foreground block text-xs">
            {formatPrice(applied.discount)} хэмнэлээ
          </span>
        </span>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Купон хасах"
          className="text-muted-foreground hover:text-destructive shrink-0 transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {offers.length > 0 && (
        <>
          <p className="text-muted-foreground text-xs font-medium">
            Танд боломжтой купон
          </p>
          <ul className="space-y-2">
            {offers.map((o, i) => (
              <li key={o.code}>
                <OfferRow
                  offer={o}
                  best={i === 0 && offers.length > 1}
                  onPick={() => onPick(o)}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      {showManual ? (
        <div className="flex gap-2">
          <Input
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
            placeholder="Купон код"
            // Codes are printed uppercase; typing them lowercase and seeing
            // them stay lowercase reads as "this isn't the code I was given".
            className="h-9 font-mono uppercase placeholder:font-sans placeholder:normal-case"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onApply();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 shrink-0"
            disabled={applying || !code.trim()}
            onClick={onApply}
          >
            {applying ? "…" : "Хэрэглэх"}
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setManualOpen(true)}
          className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 transition-colors hover:underline"
        >
          Өөр код оруулах
        </button>
      )}

      {message && <p className="text-destructive text-xs">{message}</p>}
    </div>
  );
}

function OfferRow({
  offer,
  best,
  onPick,
}: {
  offer: AvailableCoupon;
  best: boolean;
  onPick: () => void;
}) {
  const expiry = expiryNote(offer.endsAt);
  return (
    <button
      type="button"
      onClick={onPick}
      className="border-border hover:border-gold-strong/40 hover:bg-accent flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-all"
    >
      {/* What the coupon *is*, so two codes are told apart without reading
          either of them. */}
      <span className="bg-secondary flex size-11 shrink-0 flex-col items-center justify-center rounded-lg">
        <Tag className="text-muted-foreground mb-0.5 size-3" />
        <span className="text-[11px] leading-none font-bold">
          {offer.type === "percent"
            ? `${offer.value}%`
            : compactAmount(offer.value)}
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate font-mono text-xs font-semibold">
            {offer.code}
          </span>
          {offer.personal && (
            <span className="bg-secondary text-muted-foreground rounded-full px-1.5 py-px text-[10px] font-medium">
              Танд
            </span>
          )}
          {best && (
            <span className="bg-foreground text-background rounded-full px-1.5 py-px text-[10px] font-semibold">
              Хамгийн их
            </span>
          )}
        </span>
        {expiry && (
          <span
            className={cn(
              "mt-0.5 block text-[11px]",
              expiry.urgent ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {expiry.label}
          </span>
        )}
      </span>

      <span className="text-gold-strong shrink-0 text-sm font-semibold">
        −{formatPrice(offer.discount)}
      </span>
    </button>
  );
}

/** "10,000₮" is too wide for a 44px tile; "10мянга" is not a thing. */
function compactAmount(value: number): string {
  return value >= 1000 ? `${Math.round(value / 1000)}мянга` : `${value}₮`;
}

/**
 * Only mentions an expiry that is close enough to act on. Wheel coupons last a
 * month (docs/lucky-wheel.md §1), and "24 хоногийн дараа дуусна" on every row
 * is noise that trains people to ignore the line that matters.
 */
function expiryNote(
  endsAt: string | null,
): { label: string; urgent: boolean } | null {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const days = Math.ceil(ms / 86_400_000);
  if (days > 7) return null;
  return {
    label: days <= 1 ? "Өнөөдөр дуусна" : `${days} хоногийн дараа дуусна`,
    urgent: days <= 3,
  };
}
