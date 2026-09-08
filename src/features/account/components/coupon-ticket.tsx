import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * A coupon drawn as a line-art ticket.
 *
 * An outlined SVG rather than a filled box with masked notches: the reference
 * shape has a stroke that runs *around* the notches, and a mask can only
 * remove pixels — it cannot draw the cut edge. One path gives the rounded
 * corners, the two side bites, the small tears where the dashed rule meets the
 * top and bottom edges, and a single continuous line through all of them.
 *
 * The geometry lives in a 160×90 viewBox — the same 16:9 the cards are laid
 * out at (`aspect-video`) — so the ticket scales uniformly and the notches
 * never go oval. Change the card's aspect and this viewBox moves with it.
 *
 * Direction matters for the arcs: the outline is drawn clockwise, so its four
 * corners are `sweep=1` (convex) and every notch is `sweep=0` (concave). Get
 * one wrong and that arc balloons outward instead of biting in.
 */

/** Where the stub is torn off, in viewBox units — ~27% in, as the reference. */
const TEAR_X = 44;
/** The stub's share of the width — the label sits centred in what is left. */
export const STUB_RATIO = TEAR_X / 160;

const TICKET_PATH = [
  "M 8 1",
  "H 41",
  "A 3 3 0 0 0 47 1", // tear notch, top
  "H 152",
  "A 7 7 0 0 1 159 8", // corner, top-right
  "V 35",
  "A 10 10 0 0 0 159 55", // bite, right
  "V 82",
  "A 7 7 0 0 1 152 89", // corner, bottom-right
  "H 47",
  "A 3 3 0 0 0 41 89", // tear notch, bottom
  "H 8",
  "A 7 7 0 0 1 1 82", // corner, bottom-left
  "V 55",
  "A 10 10 0 0 0 1 35", // bite, left
  "V 8",
  "A 7 7 0 0 1 8 1", // corner, top-left
  "Z",
].join(" ");

/**
 * The outline on its own. Absolutely positioned by the caller so real HTML
 * text can sit on top of it and inherit the app's fonts and theme tokens —
 * `<text>` inside the SVG would need its own font plumbing.
 */
export function TicketOutline({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 160 90"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      className={cn("absolute inset-0 size-full", className)}
    >
      <path d={TICKET_PATH} />
      {/* The perforation, running between the two tear notches. */}
      <line
        x1={TEAR_X}
        y1={5}
        x2={TEAR_X}
        y2={85}
        strokeDasharray="4 4"
        strokeWidth={1.25}
      />
    </svg>
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
