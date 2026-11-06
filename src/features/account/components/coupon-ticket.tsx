import Image from "next/image";
import type * as React from "react";
import { BadgePercent, CalendarClock, ShoppingBag } from "lucide-react";
import { SkeletonBlock } from "@/components/shared/skeletons";
import { formatDate, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { daysLeft } from "./coupons";

/**
 * A coupon drawn as a printed voucher: the brand on a stub, a perforation,
 * then the code, the value set large, and whatever lines the caller adds.
 *
 * The side bites are cut out of the card with a mask, not painted over it in
 * the page colour: a painted circle sits on top of the shadow and shows as a
 * white dot wherever the page is not exactly `background`. A real hole lets
 * whatever is behind the ticket show through, and the shadow (a `drop-shadow`
 * on the wrapper, which follows the masked outline) curves into the bite.
 *
 * Proportions follow the reference card (~11:4); the card only grows taller
 * when a used coupon adds its extra line.
 */

/**
 * The mask that cuts the two side bites, `radius` deep. Each half of the card
 * carries one bite; together they cover it all.
 */
export function ticketMask(radius: string): React.CSSProperties {
  const bite = (x: string) =>
    `radial-gradient(circle ${radius} at ${x} 50%, transparent calc(${radius} - 0.5px), #000 ${radius})`;
  const mask = `${bite("0")} left / 51% 100% no-repeat, ${bite("100%")} right / 51% 100% no-repeat`;
  return { mask, WebkitMask: mask };
}

const MASK_STYLE = ticketMask("14px");

export function CouponTicket({
  type,
  value,
  code,
  muted = false,
  size = "row",
  onCard = false,
  className,
  children,
}: {
  type: "percent" | "fixed";
  value: number;
  /** The top line — where a printed voucher names the brand. */
  code: string;
  /** Used or expired: greyed out. */
  muted?: boolean;
  /** `hero` is the detail page's larger ticket. */
  size?: "row" | "hero";
  /**
   * Drawn on a `bg-card` surface (dialog, drawer): the face steps up to
   * `secondary`, or a card-coloured ticket vanishes into it in dark theme.
   */
  onCard?: boolean;
  className?: string;
  /** The small lines under the value: expiry, terms, last use. */
  children?: React.ReactNode;
}) {
  const hero = size === "hero";

  return (
    <div className={cn("drop-shadow-md", muted && "opacity-70", className)}>
      <div
        style={MASK_STYLE}
        className={cn(
          "flex items-stretch rounded-xl",
          onCard ? "bg-secondary" : "bg-card",
        )}
      >
        <TicketSpacer />
        <div className="flex w-[37%] shrink-0 items-center justify-center">
          <Image
            src="/von-logo.png"
            alt=""
            width={96}
            height={96}
            className={cn(
              "rounded-xl",
              hero ? "size-20" : "size-14",
              muted && "grayscale",
            )}
          />
        </div>

        <Perforation />

        <div className="text-foreground/80 @container flex min-w-0 flex-1 flex-col justify-center py-4 pr-5 pl-6 *:shrink-0">
          <p
            className={cn(
              "truncate font-medium tracking-[0.15em] uppercase",
              hero ? "text-base" : "text-sm",
            )}
          >
            {code}
          </p>
          {/* The whole amount, symbol included («10,000₮», «10%»), set large;
              the word «хөнгөлөлт» follows only where there is room for it — a
              phone-width ticket has none once the amount is spelled out. */}
          <p className="mt-1 flex items-baseline gap-1.5">
            <span
              className={cn(
                "leading-none font-bold whitespace-nowrap tabular-nums",
                // Shrinks with the column (`cqw`) so «10,000₮» never runs
                // into the bite on a narrow ticket.
                hero ? "text-[min(3rem,21cqw)]" : "text-[min(2.25rem,21cqw)]",
              )}
            >
              {couponLabel(type, value)}
            </span>
            <span className="min-w-0 truncate text-[11px] font-medium tracking-[0.12em] uppercase @max-[17rem]:hidden">
              хөнгөлөлт
            </span>
          </p>
          {children && (
            <div className="text-muted-foreground/80 mt-2 space-y-0.5 text-[11px] tracking-wide">
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The two lines every ticket carries under its value, so a coupon reads the
 * same wherever it shows up (wallet, wheel prize, welcome gift, checkout):
 *
 * - when it ends — the date, a countdown in the last week (red in the last
 *   three days), or «Хугацаагүй»;
 * - the order total it needs («Доод дүн») — left out when there is none,
 *   since «no minimum» is the default nobody needs told — and a percent
 *   coupon's cap when it has one.
 *
 * Each sits on its own line with an icon, worded short enough to fit a
 * phone: joined by «·», or as «…-өөс дээш захиалгад», the minimum was the
 * part truncated away — and it decides whether the coupon applies at all.
 */
export function CouponTerms({
  type,
  endsAt,
  minSubtotal,
  maxDiscount,
  ended = false,
}: {
  type: "percent" | "fixed";
  endsAt: string | null;
  minSubtotal: number;
  maxDiscount: number | null;
  /** Used or expired — the date is history, not a countdown. */
  ended?: boolean;
}) {
  const expiry = expiryText(endsAt, ended);
  const cap = type === "percent" && maxDiscount != null;
  return (
    <>
      <TermLine icon={CalendarClock}>
        <span className={cn(expiry.urgent && "text-destructive font-medium")}>
          {expiry.label}
        </span>
      </TermLine>
      {minSubtotal > 0 && (
        <TermLine icon={ShoppingBag}>
          Доод дүн {formatPrice(minSubtotal)}
        </TermLine>
      )}
      {cap && (
        <TermLine icon={BadgePercent}>
          Дээд хөнгөлөлт {formatPrice(maxDiscount)}
        </TermLine>
      )}
    </>
  );
}

function TermLine({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <p className="flex min-w-0 items-center gap-1.5">
      <Icon className="size-3 shrink-0 opacity-70" />
      <span className="truncate">{children}</span>
    </p>
  );
}

/** When the coupon ends, in the words a customer would use. */
export function expiryText(
  endsAt: string | null,
  ended = false,
  now = Date.now(),
): { label: string; urgent: boolean } {
  if (!endsAt) return { label: "Хугацаагүй", urgent: false };
  if (ended)
    return { label: `${formatDate(endsAt)} хүртэл байсан`, urgent: false };
  const days = daysLeft(endsAt, now);
  if (days == null) return { label: "Хугацаа дууссан", urgent: true };
  if (days <= 1) return { label: "Өнөөдөр дуусна", urgent: true };
  if (days <= 7) return { label: `${days} хоног үлдсэн`, urgent: days <= 3 };
  return { label: `${formatDate(endsAt)} хүртэл`, urgent: false };
}

/**
 * Holds the card at least 11:4. `aspect-ratio` alone fixed the height, so a
 * third line (a cap, «Ашигласан: …») ran into the bottom edge instead of
 * growing the card; a zero-width strut with percentage padding (relative to
 * the card's width) sets the floor and lets the content push past it.
 */
function TicketSpacer() {
  return <span aria-hidden className="w-0 shrink-0 pb-[36.36%]" />;
}

/** The perforation: long dashes, shorter than the card is tall. */
export function Perforation({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 2 100"
      preserveAspectRatio="none"
      className={cn(
        "text-muted-foreground/70 h-[62%] w-0.5 shrink-0 self-center",
        className,
      )}
    >
      <line
        x1={1}
        y1={0}
        x2={1}
        y2={100}
        stroke="currentColor"
        strokeWidth={2}
        strokeDasharray="9 7"
      />
    </svg>
  );
}

/**
 * The ticket while it loads — the same cut-out card and perforation, with
 * pulsing bars where the logo, code, value and expiry will land, so nothing
 * jumps when the data arrives.
 */
export function CouponTicketSkeleton({
  size = "row",
  className,
}: {
  size?: "row" | "hero";
  className?: string;
}) {
  const hero = size === "hero";
  return (
    <div aria-hidden className={cn("drop-shadow-md", className)}>
      <div style={MASK_STYLE} className="bg-card flex items-stretch rounded-xl">
        <TicketSpacer />
        <div className="flex w-[37%] shrink-0 items-center justify-center">
          <SkeletonBlock
            className={cn("rounded-xl", hero ? "size-20" : "size-14")}
          />
        </div>
        <Perforation />
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2.5 px-6">
          <SkeletonBlock className="h-3.5 w-2/5" />
          <SkeletonBlock className={cn("w-3/5", hero ? "h-11" : "h-8")} />
          <SkeletonBlock className="h-2.5 w-1/2" />
        </div>
      </div>
    </div>
  );
}

/**
 * What the coupon is worth, and nothing else: «10%», «10,000₮».
 *
 * Amounts are spelled out in full — «10k» read as shorthand the client did
 * not want, and it is not how prices appear anywhere else on the site.
 */
export function couponLabel(type: "percent" | "fixed", value: number): string {
  return type === "percent" ? `${value}%` : formatPrice(value);
}
