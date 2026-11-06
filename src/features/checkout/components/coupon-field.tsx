"use client";

import * as React from "react";
import { Check, Lock, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingButton } from "@/components/shared/loading-button";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AvailableCoupon } from "@/app/api/coupons/available/route";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import {
  CouponTerms,
  CouponTicket,
  couponLabel,
} from "@/features/account/components/coupon-ticket";

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
 * Хураангуйд үргэлж НЭГ мөр: сонгосон купон (`код · −дүн · Солих`), эсвэл
 * «N купон байна · Сонгох». Өмнө нь санал бүр карт болж жагсдаг байсан тул 5
 * купонтой хүний тойм ~1340px болж, «Төлбөр төлөх» нь десктоп дээр ч fold-оос
 * доош ордог байв. Бүх санал, гараар код оруулах нь `ResponsiveDialog` дотор.
 *
 * `/api/coupons/available` only ever returns coupons that validate against the
 * current subtotal — so every usable row is one tap from working. Rows arrive
 * soonest-expiry first and are never merged (0104): two 10% codes ending on
 * different days are two rows, each with its own date and terms.
 */

export function CouponField({
  applied,
  autoApplied = false,
  offers,
  code,
  onCodeChange,
  onApply,
  applying,
  loading = false,
  message,
  onPick,
  onRemove,
}: {
  applied: { code: string; discount: number } | null;
  /** Одоогийн купоныг хэрэглэгч биш, хуудас өөрөө сонгосон. */
  autoApplied?: boolean;
  offers: AvailableCoupon[];
  code: string;
  onCodeChange: (value: string) => void;
  onApply: () => void;
  applying: boolean;
  /** Санал болгох купонуудыг сервер хайж байна. */
  loading?: boolean;
  message: string | null;
  onPick: (coupon: AvailableCoupon) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  // Гараар оруулсан код dialog дотор хүчинтэй болмогц dialog хаагдана —
  // render-ийн үеийн state тохируулга (effect биш).
  const appliedCode = applied?.code ?? null;
  const [seenCode, setSeenCode] = React.useState(appliedCode);
  if (seenCode !== appliedCode) {
    setSeenCode(appliedCode);
    if (appliedCode) setOpen(false);
  }

  const usable = offers.filter((o) => o.eligible);
  const top = Math.max(0, ...usable.map((o) => o.discount));

  let row: React.ReactNode;
  if (applied) {
    row = (
      <div className="bg-secondary flex items-center gap-2.5 rounded-xl py-2 pr-1 pl-3">
        <Check className="text-gold-strong size-4 shrink-0" strokeWidth={2.5} />
        <span className="min-w-0 flex-1">
          {/* Утсан дээр код зай л эзэлнэ — хэрэглэгч кодоор биш дүнгээр
              сонгодог, код нь «Нийт» хэсгийн мөрөнд бий. */}
          <span className="flex items-baseline gap-1.5 text-sm">
            <span className="truncate font-mono font-semibold max-sm:hidden">
              {applied.code}
            </span>
            <span className="text-muted-foreground max-sm:hidden" aria-hidden>
              ·
            </span>
            <span className="text-gold-strong shrink-0 font-semibold tabular-nums">
              −{formatPrice(applied.discount)}
            </span>
            <span className="text-muted-foreground sm:hidden">хөнгөлөлт</span>
          </span>
          {autoApplied && (
            <span className="text-muted-foreground block text-xs">
              Хамгийн их хэмнэлттэйг сонголоо
            </span>
          )}
        </span>
        <ChangeButton onClick={() => setOpen(true)}>
          {offers.length > 1 ? `Солих (${offers.length})` : "Солих"}
        </ChangeButton>
        {/* 16px дүрс, 44px хүрэх талбар (WCAG 2.5.8). */}
        <button
          type="button"
          onClick={onRemove}
          aria-label="Купон хасах"
          className="text-muted-foreground hover:text-destructive relative flex size-8 shrink-0 items-center justify-center transition-colors before:absolute before:top-1/2 before:left-1/2 before:size-11 before:-translate-1/2 before:content-['']"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  } else if (loading && offers.length === 0) {
    // Хайлт дуусаагүй байхад «купон байхгүй» гэж шийдэхгүй — эс тэгвээс input
    // гарч ирээд, санал ирэхэд нь дахин алга болж анивчина.
    row = (
      <div
        className="bg-secondary h-11 w-full animate-pulse rounded-xl"
        aria-hidden
      />
    );
  } else if (usable.length > 0) {
    row = (
      <div className="bg-secondary flex items-center gap-2.5 rounded-xl py-2 pr-1 pl-3">
        <Tag className="text-muted-foreground size-4 shrink-0" />
        <span className="min-w-0 flex-1 text-sm">
          <span className="block">{usable.length} купон ашиглах боломжтой</span>
          <span className="text-muted-foreground block text-xs">
            Хамгийн ихдээ{" "}
            <span className="text-gold-strong font-semibold tabular-nums">
              −{formatPrice(top)}
            </span>
          </span>
        </span>
        <ChangeButton onClick={() => setOpen(true)}>Сонгох</ChangeButton>
      </div>
    );
  } else {
    // Ашиглах купон алга — гараар оруулах нь энд шууд, dialog-гүй.
    row = (
      <ManualEntry
        code={code}
        onCodeChange={onCodeChange}
        onApply={onApply}
        applying={applying}
      />
    );
  }

  // Хэрэглэх боломжгүй (доод дүнд хүрээгүй) купон л байгаа үед тэдгээрийг
  // жагсаалтаар нь харах зам.
  const lockedOnly = !applied && !loading && usable.length === 0;
  const nearest = nearestLocked(offers);

  return (
    <div className="space-y-1.5">
      <p className="text-muted-foreground text-xs font-medium">Купон</p>
      {row}
      {!open && message && <Message text={message} />}
      {/* Хүрэхэд хамгийн ойр купоныг хэлнэ — «Бусад купон (2)» гэх нь купон
          байгааг л хэлдэг, юу хийвэл ашиглаж болохыг хэлдэггүй байв. */}
      {lockedOnly && nearest && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="bg-secondary hover:bg-accent flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors"
        >
          <Lock className="text-muted-foreground size-4 shrink-0" />
          <span className="min-w-0 flex-1 text-xs">
            Дахин{" "}
            <span className="font-semibold tabular-nums">
              {formatPrice(nearest.shortfall)}
            </span>
            -ийн бараа нэмбэл{" "}
            <span className="font-semibold">
              {couponLabel(nearest.type, nearest.value)}
            </span>{" "}
            купон ашиглах боломжтой
          </span>
          <span className="shrink-0 text-xs font-semibold">
            {offers.length > 1 ? `Харах (${offers.length})` : "Харах"}
          </span>
        </button>
      )}

      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        className="sm:max-w-2xl"
        title="Купон сонгох"
        description="Нэг захиалгад нэг купон хэрэглэнэ."
      >
        <div className="space-y-4">
          {offers.length > 0 && (
            <OfferList
              offers={offers}
              appliedCode={appliedCode}
              onPick={(o) => {
                onPick(o);
                setOpen(false);
              }}
            />
          )}
          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs font-medium">
              Код оруулах
            </p>
            <ManualEntry
              code={code}
              onCodeChange={onCodeChange}
              onApply={onApply}
              applying={applying}
            />
            {message && <Message text={message} />}
          </div>
        </div>
      </ResponsiveDialog>
    </div>
  );
}

/**
 * Хүрэхэд хамгийн ойр купон. Ижил доод дүнтэй (100k-ын 5k ба 10k) бол нэг
 * дүнд хоёулаа нээгдэх тул их хөнгөлөлттэйг нь хэлнэ — 5k-ыг хэлбэл илүү
 * сайн нь байгааг нууна.
 */
export function nearestLocked(
  offers: AvailableCoupon[],
): AvailableCoupon | null {
  let best: AvailableCoupon | null = null;
  for (const o of offers) {
    if (
      !best ||
      o.shortfall < best.shortfall ||
      (o.shortfall === best.shortfall && worth(o) > worth(best))
    ) {
      best = o;
    }
  }
  return best;
}

/** Доод дүнд яг хүрэх үед купон хэдэн ₮ хэмнэх вэ. */
function worth(o: AvailableCoupon): number {
  if (o.type === "fixed") return o.value;
  const raw = Math.floor((o.minSubtotal * o.value) / 100);
  return o.maxDiscount != null ? Math.min(raw, o.maxDiscount) : raw;
}

function ChangeButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="h-9 shrink-0 px-2.5 text-xs font-semibold"
    >
      {children}
    </Button>
  );
}

function Message({ text }: { text: string }) {
  return (
    <p role="alert" className="text-destructive text-xs">
      {text}
    </p>
  );
}

function ManualEntry({
  code,
  onCodeChange,
  onApply,
  applying,
}: {
  code: string;
  onCodeChange: (value: string) => void;
  onApply: () => void;
  applying: boolean;
}) {
  return (
    <div className="flex gap-2">
      <Input
        value={code}
        onChange={(e) => onCodeChange(e.target.value)}
        placeholder="Купон код"
        aria-label="Купон код"
        // Codes are printed uppercase; typing them lowercase and seeing
        // them stay lowercase reads as "this isn't the code I was given".
        className="h-10 font-mono uppercase placeholder:font-sans placeholder:normal-case md:h-9"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            // Шалгаж байх үед Enter дахин хүсэлт илгээхгүй.
            if (!applying) onApply();
          }
        }}
      />
      {/* «…» гэж үгээ солихоор товч жижгэрч, юу болж буй нь ойлгомжгүй байв —
          spinner нь үгийн байранд гарч, өргөн хэвээр үлдэнэ. */}
      <LoadingButton
        type="button"
        size="sm"
        className="h-10 shrink-0 md:h-9"
        loading={applying}
        disabled={!code.trim()}
        // Шууд `onClick={onApply}` бол click event нь `apply(raw)`-ийн код
        // болж ирээд `.trim()` дээр унадаг байв.
        onClick={() => onApply()}
      >
        Хэрэглэх
      </LoadingButton>
    </div>
  );
}

function OfferList({
  offers,
  appliedCode,
  onPick,
}: {
  offers: AvailableCoupon[];
  appliedCode: string | null;
  onPick: (coupon: AvailableCoupon) => void;
}) {
  // Rows are ordered by expiry, so the biggest saving is not necessarily the
  // first one — mark it wherever it sits, and only if it is a clear winner.
  const usable = offers.filter((o) => o.eligible);
  const top = Math.max(0, ...usable.map((o) => o.discount));
  const bestId =
    usable.length > 1 && usable.filter((o) => o.discount === top).length === 1
      ? usable.find((o) => o.discount === top)?.id
      : undefined;
  return (
    // Жагсаалт өөрөө гүйнэ — «Код оруулах» нь доор нь ямагт харагдана.
    // `p-1` нь сонгосон мөрийн ring-ийг overflow хайчлахаас хамгаална.
    <ul
      aria-label="Таны купон"
      className="-mx-1 max-h-[min(60dvh,32rem)] space-y-3 overflow-y-auto overscroll-contain p-1"
    >
      {offers.map((o) => (
        <li key={o.id}>
          <OfferRow
            offer={o}
            best={o.id === bestId}
            active={o.code === appliedCode}
            onPick={() => onPick(o)}
          />
        </li>
      ))}
    </ul>
  );
}

/**
 * One offer: the same logo ticket as «Миний купон» (with its expiry and
 * minimum lines), a radio, and a note on what picking it means for this cart.
 *
 * The ticket stays the coupon and nothing else — what this cart still lacks
 * is not a property of the coupon, so it is never printed on the ticket.
 * Under the ticket the radio read as a separate control. On a wide dialog
 * it sits to the ticket's left and the note (the saving, or how far the cart
 * is from the minimum) to its right; on a phone both move into one header
 * row above the ticket, which keeps the full width — a radio column beside
 * it squeezed the ticket until its amount ran into the bite. One element
 * each, moved by grid areas, so nothing is rendered twice.
 */
function OfferRow({
  offer,
  best,
  active,
  onPick,
}: {
  offer: AvailableCoupon;
  best: boolean;
  /** Одоо хэрэглэгдэж буй купон. */
  active: boolean;
  onPick: () => void;
}) {
  const locked = !offer.eligible;
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={locked}
      aria-pressed={active}
      className={cn(
        "group enabled:hover:bg-secondary/50 grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5 rounded-2xl p-3 text-left transition-colors [grid-template-areas:'mark_note''ticket_ticket'] disabled:cursor-not-allowed sm:grid-cols-[auto_minmax(0,1fr)_9.5rem] sm:gap-x-4 sm:[grid-template-areas:'mark_ticket_note']",
      )}
    >
      <span className="flex [grid-area:mark]">
        {locked ? (
          <Lock className="text-muted-foreground size-5" />
        ) : (
          <span
            aria-hidden
            className={cn(
              "flex size-5 items-center justify-center rounded-full ring-2 transition-colors",
              active
                ? "bg-foreground ring-foreground"
                : "ring-muted-foreground/40 group-hover:ring-muted-foreground",
            )}
          >
            {active && <span className="bg-background size-2 rounded-full" />}
          </span>
        )}
        {active && <span className="sr-only">Хэрэглэж байна</span>}
      </span>

      <CouponTicket
        type={offer.type}
        value={offer.value}
        code={offer.code}
        muted={locked}
        onCard
        className="[grid-area:ticket]"
      >
        <CouponTerms
          type={offer.type}
          endsAt={offer.endsAt}
          minSubtotal={offer.minSubtotal}
          maxDiscount={offer.maxDiscount}
        />
      </CouponTicket>

      <span className="min-w-0 [grid-area:note]">
        {locked ? (
          <ShortfallNote offer={offer} />
        ) : (
          <span className="flex items-center gap-x-2 gap-y-1.5 sm:flex-col sm:items-start">
            <span className="flex items-baseline gap-1.5 max-sm:order-last max-sm:ml-auto sm:flex-col sm:gap-0">
              {/* Утсан дээр шошго «…хэмнэлт» гэж аль хэдийн хэлдэг — нэг мөрөнд
                  багтаахын тулд давхардсан үгийг нууна. */}
              <span
                className={cn(
                  "text-muted-foreground text-xs",
                  best && "max-sm:hidden",
                )}
              >
                Хэмнэлт
              </span>
              <span className="text-gold-strong text-base font-bold tabular-nums sm:text-xl">
                −{formatPrice(offer.discount)}
              </span>
            </span>
            {best && (
              <span className="bg-foreground text-background rounded-full px-2 py-0.5 text-[11px] font-semibold">
                Хамгийн их хэмнэлт
              </span>
            )}
            {/* Most offers are the customer's own; the shared code is the odd one. */}
            {!offer.personal && (
              <span className="bg-secondary text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-medium">
                Бүгдэд
              </span>
            )}
          </span>
        )}
      </span>
    </button>
  );
}

/** How far the cart is from a coupon's minimum, and what is left to add. */
function ShortfallNote({ offer }: { offer: AvailableCoupon }) {
  const reached = Math.max(0, offer.minSubtotal - offer.shortfall);
  const pct =
    offer.minSubtotal > 0
      ? Math.min(100, Math.round((reached / offer.minSubtotal) * 100))
      : 0;
  return (
    <span className="block space-y-1.5">
      <span className="block text-xs">
        <span>
          Дахин{" "}
          <span className="font-semibold tabular-nums">
            {formatPrice(offer.shortfall)}
          </span>
          -ийн бараа нэмбэл ашиглах боломжтой
        </span>
      </span>
      <span
        role="progressbar"
        aria-label="Купоны доод дүн хүртэл"
        aria-valuemin={0}
        aria-valuemax={offer.minSubtotal}
        aria-valuenow={reached}
        className="bg-secondary block h-1.5 overflow-hidden rounded-full"
      >
        <span
          className="bg-gold-strong block h-full rounded-full"
          style={{ width: `${pct}%` }}
        />
      </span>
    </span>
  );
}
