import Image from "next/image";
import type * as React from "react";
import { SkeletonBlock } from "@/components/shared/skeletons";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

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
  className?: string;
  /** The small lines under the value: expiry, terms, last use. */
  children?: React.ReactNode;
}) {
  const face = couponFace(type, value);
  const hero = size === "hero";

  return (
    <div className={cn("drop-shadow-md", muted && "opacity-70", className)}>
      <div
        style={MASK_STYLE}
        className="bg-card flex aspect-11/4 items-stretch rounded-xl"
      >
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

        <div className="text-foreground/80 flex min-w-0 flex-1 flex-col justify-center px-6 py-3 *:shrink-0">
          <p
            className={cn(
              "truncate font-medium tracking-[0.15em] uppercase",
              hero ? "text-base" : "text-sm",
            )}
          >
            {code}
          </p>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span
              className={cn(
                "leading-none font-bold tabular-nums",
                hero ? "text-5xl" : "text-4xl",
              )}
            >
              {face.amount}
            </span>
            <span className="text-[11px] font-medium tracking-[0.12em] whitespace-nowrap uppercase">
              {face.unit}
            </span>
          </p>
          {children && (
            <div className="text-muted-foreground/80 mt-2 text-[11px] tracking-wide">
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
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
      <div
        style={MASK_STYLE}
        className="bg-card flex aspect-11/4 items-stretch rounded-xl"
      >
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
 * What the coupon is worth, and nothing else.
 *
 * `10,000₮` is too long to read at card size, so a round thousand becomes
 * `10k` — the notation the client asked for and the one already on the wheel.
 */
export function couponLabel(type: "percent" | "fixed", value: number): string {
  if (type === "percent") return `${value}%`;
  return value >= 1000 && value % 1000 === 0
    ? `${value / 1000}k`
    : formatPrice(value);
}

/**
 * The coupon's face split in two — the big number and the small word after
 * it, the way a printed voucher sets «25 % OFF». A round thousand still reads
 * `10k`, as in `couponLabel`.
 */
export function couponFace(
  type: "percent" | "fixed",
  value: number,
): { amount: string; unit: string } {
  if (type === "percent") return { amount: String(value), unit: "% хөнгөлөлт" };
  const amount =
    value >= 1000 && value % 1000 === 0
      ? `${value / 1000}k`
      : formatPrice(value).replace("₮", "");
  return { amount, unit: "₮ хөнгөлөлт" };
}
