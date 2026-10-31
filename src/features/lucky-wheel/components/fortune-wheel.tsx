"use client";

import * as React from "react";
import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
} from "motion/react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import { VPointIcon } from "@/components/shared/v-point-icon";
import {
  isFlick,
  positionOfSlot,
  segmentPath,
  slotAtRotation,
  targetRotation,
  type LightPhase,
} from "../geometry";
import { colorOf, prizeColors } from "../palette";
import type { WheelPrize } from "../types";

/**
 * The prize wheel — a game-show wheel, not a chart.
 *
 * Built as three stacked layers in one square:
 * - the **rim** (still): gold, its "metal" made of several solid rings
 *   rather than a gradient (design.md §2 still holds on this page);
 * - the **face** (turns): the wedges, a glowing icon per prize at the rim
 *   (GTA V's casino wheel), a small label towards the hub, and the pegs —
 *   pegs ride with the wheel, like on a real one;
 * - the **pointer** (still, flaps): a small gold flapper the pegs knock aside.
 *
 * Colours are the `--wheel-*` tokens (palette.ts): this page is the one place
 * the shop steps out of its monochrome palette.
 */

const VIEW = 95;
/** Radius of the turning face inside the rim's coordinate space. */
const FACE_R = 88;
/** Where the prize icons sit, and where the labels start (face units). */
const ICON_R = 74;
/**
 * The hub button's radius in face units (it is 24% of a 2×VIEW square).
 * Anything that should reach "all the way in" — the grand bands, the dim
 * over losing wedges, the winner's outline — stops here, not short of it.
 */
const HUB_R = 0.12 * VIEW * 2;
const LABEL_R = 62;
/** How long the rim keeps celebrating before it settles back to idle. */
const AFTERGLOW_MS = 4200;

export interface WheelHandle {
  /**
   * Spin to the prize occupying `slot` and resolve once the pointer settles.
   * Takes the **database** slot, not a wheel position — see `positionOfSlot`.
   * `win: false` (a «Хоосон» wedge) lands quietly: no flashing rim.
   */
  spinTo(slot: number, opts?: { win?: boolean }): Promise<void>;
}

interface WheelProps {
  prizes: WheelPrize[];
  /** Hub button — the primary way to spin. */
  onSpin?: () => void;
  hubLabel: string;
  hubHint?: React.ReactNode;
  disabled?: boolean;
  busy?: boolean;
  /** Fired as each peg passes the pointer, for sound and haptics. */
  onTick?: () => void;
  className?: string;
}

/** Point on a circle, angle in degrees clockwise from 12 o'clock. */
function polar(deg: number, r: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: r * Math.cos(rad), y: r * Math.sin(rad) };
}

/** A four-point sparkle centred on (x, y). */
function sparklePath(x: number, y: number, s: number) {
  return `M${x} ${y - s} Q${x} ${y} ${x + s} ${y} Q${x} ${y} ${x} ${y + s} Q${x} ${y} ${x - s} ${y} Q${x} ${y} ${x} ${y - s}Z`;
}

/** lucide `gift`, 24-unit box, stroked — the bundle prizes' icon. */
const GIFT = [
  "M3 9a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z",
  "M12 8v13",
  "M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7",
  "M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5",
];

/** A stroked 24-unit icon scaled to ~11 units, centred on (0, 0). */
function StrokeIcon({
  paths,
  color,
  scale = 0.46,
  width = 2,
}: {
  paths: string[];
  color: string;
  scale?: number;
  width?: number;
}) {
  return (
    <g
      transform={`scale(${scale}) translate(-12 -12)`}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </g>
  );
}

/** V point coin — the same glyph as `VPointIcon`, 32-unit box. */
const COIN =
  "M0 16A16 16 0 1 0 32 16A16 16 0 1 0 0 16Z M2.2 16A13.8 13.8 0 1 0 29.8 16A13.8 13.8 0 1 0 2.2 16Z M2.95 16A13.05 13.05 0 1 0 29.05 16A13.05 13.05 0 1 0 2.95 16Z M6.6 10.06H12.98V10.92H11.79L16 20.97L20.08 10.92H19.24V10.06H23.99V10.92H21.83L16.59 23.78H15.41L8.12 10.92H6.6Z";
/** lucide `ticket` and `heart-crack`, 24-unit box, stroked. */
const TICKET = [
  "M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z",
  "M13 5v2",
  "M13 17v2",
  "M13 11v2",
];
const HEART_CRACK = [
  "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z",
  "m12 13-1-1 2-2-3-3 2-2",
];

/** One prize's icon, ~11 units, centred on (0, 0). */
function PrizeGlyph({ kind }: { kind: WheelPrize["kind"] }) {
  if (kind === "points") {
    return (
      <path
        d={COIN}
        transform="scale(0.36) translate(-16 -16)"
        fill="var(--wheel-gold-light)"
        fillRule="evenodd"
      />
    );
  }
  if (kind === "bundle" || kind === "product") {
    return <StrokeIcon paths={GIFT} color="var(--wheel-gold-light)" />;
  }
  return (
    <StrokeIcon
      paths={kind === "none" ? HEART_CRACK : TICKET}
      color={
        kind === "none"
          ? "color-mix(in oklab, var(--foreground) 55%, var(--background))"
          : "var(--wheel-gold-light)"
      }
    />
  );
}

export const FortuneWheel = React.forwardRef<WheelHandle, WheelProps>(
  function FortuneWheel(
    { prizes, onSpin, hubLabel, hubHint, disabled, busy, onTick, className },
    ref,
  ) {
    const reduced = usePrefersReducedMotion();
    const rotation = useMotionValue(0);
    const [phase, setPhase] = React.useState<LightPhase>("idle");
    /** Wheel position (1..count) of the wedge just landed on, while lit. */
    const [landed, setLanded] = React.useState<number | null>(null);
    const [kick, setKick] = React.useState(0);
    const lastPosition = React.useRef(1);
    const afterglow = React.useRef<ReturnType<typeof setTimeout>>(undefined);
    const flick = React.useRef<{ x: number; y: number; t: number } | null>(
      null,
    );
    React.useEffect(() => () => clearTimeout(afterglow.current), []);

    const count = prizes.length;
    const seg = count > 0 ? 360 / count : 360;
    const colors = React.useMemo(() => prizeColors(prizes), [prizes]);
    /** SVG ids for the glow filter and clip paths — unique per wheel. */
    const uid = React.useId().replace(/:/g, "");
    const ready = !disabled && !busy;

    // One flap of the pointer per peg — the click that makes it a wheel.
    useMotionValueEvent(rotation, "change", (value) => {
      if (count === 0) return;
      const position = slotAtRotation(value, count);
      if (position === lastPosition.current) return;
      lastPosition.current = position;
      setKick((n) => n + 1);
      onTick?.();
    });

    React.useImperativeHandle(ref, () => ({
      async spinTo(slot: number, opts?: { win?: boolean }) {
        if (count === 0) return;
        clearTimeout(afterglow.current);
        setLanded(null);
        setPhase("spin");
        const position = positionOfSlot(
          prizes.map((p) => p.slot),
          slot,
        );
        const settle = () => {
          const won = opts?.win !== false;
          setLanded(position);
          setPhase(won ? "win" : "miss");
          afterglow.current = setTimeout(() => {
            setPhase("idle");
            setLanded(null);
          }, AFTERGLOW_MS);
        };

        const from = rotation.get();
        const turns = reduced ? 0 : 6 + Math.floor(Math.random() * 3);
        const jitter = reduced ? 0 : Math.random() * 2 - 1;
        const target = targetRotation(from, position, count, turns, jitter);
        if (reduced) {
          await animate(rotation, target, { duration: 0.45, ease: "easeOut" });
          settle();
          return;
        }
        // Wind-up, then the throw: pulled back a touch before it is let go.
        await animate(rotation, from - 10, { duration: 0.34, ease: "easeOut" });
        // A long tail: still creeping as it crosses the last few pegs.
        await animate(rotation, target, {
          duration: 6,
          ease: [0.12, 0.72, 0.1, 1],
        });
        // Backlash — the last peg lets go and the wheel rocks back.
        await animate(rotation, target - 1.2, {
          type: "spring",
          stiffness: 150,
          damping: 10,
          mass: 0.6,
        });
        settle();
      },
    }));

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      flick.current = { x: e.clientX, y: e.clientY, t: e.timeStamp };
    };
    const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
      const start = flick.current;
      flick.current = null;
      if (!start || !ready || !onSpin) return;
      if (
        isFlick(e.clientX - start.x, e.clientY - start.y, e.timeStamp - start.t)
      ) {
        onSpin();
      }
    };

    const landedColor =
      landed !== null ? colorOf(colors, prizes[landed - 1]) : null;

    return (
      <div
        className={cn(
          "relative mx-auto w-full max-w-[min(92vw,34rem)] select-none",
          className,
        )}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (flick.current = null)}
        // Sideways swipes spin the wheel; vertical ones still scroll the page.
        style={{ touchAction: "pan-y" }}
      >
        <div className="relative aspect-square">
          {/* Halo behind the wheel — the prize's colour on a win. */}
          <motion.div
            aria-hidden
            className="absolute inset-[4%] rounded-full blur-3xl"
            animate={{
              backgroundColor: landedColor?.fill ?? "var(--wheel-halo)",
              // The idle halo carries its own alpha (--wheel-halo).
              opacity: phase === "win" ? 0.85 : 1,
              scale: phase === "win" ? 1.08 : 1,
            }}
            transition={{ duration: 0.6 }}
          />

          {/* ── Rim (still) ─────────────────────────────────────────── */}
          <svg
            aria-hidden
            viewBox={`${-VIEW} ${-VIEW} ${VIEW * 2} ${VIEW * 2}`}
            className="absolute inset-0 size-full"
          >
            {/* Gold rim: dark edge, body, highlight, body — read as metal. */}
            <circle r={93.5} fill="var(--wheel-gold-deep)" />
            <circle r={92} fill="var(--wheel-gold)" />
            <circle r={90.6} fill="var(--wheel-gold-light)" />
            <circle r={89.8} fill="var(--wheel-gold-mid)" />
            <circle r={88.6} fill="var(--wheel-gold-deep)" />
          </svg>

          {/* ── Face (turns) ────────────────────────────────────────── */}
          {/* The round window the face turns in. A rotated square's box is
              wider than itself — on a phone that pushed the page sideways
              mid-spin — so the clip lives here, round, rather than on the
              whole wheel, where it also cut the halo off flat. */}
          <div className="absolute inset-[3.7%] overflow-hidden rounded-full">
            <motion.svg
              viewBox={`${-FACE_R} ${-FACE_R} ${FACE_R * 2} ${FACE_R * 2}`}
              className="size-full"
              style={{ rotate: rotation }}
              role="img"
              aria-label={`Азын хүрд: ${prizes.map((p) => p.label).join(", ")}`}
            >
              {prizes.map((prize, i) => (
                <path
                  key={prize.slot}
                  d={segmentPath(i + 1, count, FACE_R)}
                  fill={colorOf(colors, prize).fill}
                  stroke="var(--wheel-gold-deep)"
                  strokeWidth={0.7}
                />
              ))}

              {/* Grand wedge:
                  1. a glow — the wedge blurred, drawn over its neighbours so
                     the light spills onto them;
                  2. the wedge again on top, one solid deeper gold;
                  3. a shine sweeping out from the hub. */}
              <defs>
                <filter
                  id={`${uid}-glow`}
                  x="-60%"
                  y="-60%"
                  width="220%"
                  height="220%"
                >
                  <feGaussianBlur stdDeviation="7" />
                </filter>
                {/* The grand's name and gift, lit from within: a white blur
                    under the white shape. Two small elements only — the
                    icons elsewhere stay filter-free (scroll jank). */}
                <filter
                  id={`${uid}-white`}
                  x="-50%"
                  y="-50%"
                  width="200%"
                  height="200%"
                >
                  <feGaussianBlur stdDeviation="1.6" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              {prizes.map((prize, i) => {
                if (prize.tier !== "grand") return null;
                const pos = i + 1;
                return (
                  <g key={`grand-${prize.slot}`}>
                    <path
                      d={segmentPath(pos, count, FACE_R - 2, HUB_R)}
                      fill="var(--wheel-gold)"
                      // A thick stroke widens the halo past the wedge's edges.
                      stroke="var(--wheel-gold)"
                      strokeWidth={9}
                      strokeLinejoin="round"
                      filter={`url(#${uid}-glow)`}
                      // Still, not breathing: an animated blur repaints the
                      // whole face every frame (scroll jank).
                      opacity={0.85}
                    />
                    {/* One solid field, a shade deeper than the rim's gold —
                        no light bands or sweeping shine over it (client). */}
                    <path
                      d={segmentPath(pos, count, FACE_R, HUB_R)}
                      fill="color-mix(in oklab, var(--wheel-gold) 82%, var(--wheel-gold-deep))"
                    />
                    {/* A shine sweeping out from the hub every few seconds,
                        clipped to the wedge. */}
                    {!reduced && (
                      <>
                        <clipPath id={`${uid}-clip-${prize.slot}`}>
                          <path d={segmentPath(pos, count, FACE_R)} />
                        </clipPath>
                        <g clipPath={`url(#${uid}-clip-${prize.slot})`}>
                          <motion.circle
                            fill="none"
                            stroke="var(--wheel-gold-shine)"
                            strokeWidth={5}
                            initial={{ r: 28, opacity: 0 }}
                            animate={{ r: [28, 92], opacity: [0, 0.9, 0] }}
                            transition={{
                              duration: 1.3,
                              repeat: Infinity,
                              repeatDelay: 1.6,
                              ease: "easeOut",
                            }}
                          />
                        </g>
                      </>
                    )}
                  </g>
                );
              })}

              {/* Grand wedge: a crown at the rim and sparkles that twinkle. */}
              {prizes.map((prize, i) => {
                if (prize.tier !== "grand") return null;
                const center = (i + 0.5) * seg;
                return (
                  <g
                    key={`grand-${prize.slot}`}
                    transform={`rotate(${center})`}
                  >
                    <g
                      transform={`translate(0 ${-ICON_R})`}
                      filter={`url(#${uid}-white)`}
                    >
                      <StrokeIcon
                        paths={GIFT}
                        color="#ffffff"
                        scale={0.5}
                        width={2.4}
                      />
                    </g>
                    {[
                      [-6.4, -84, 1.6, 0],
                      [6.6, -82, 1.4, 0.6],
                      [5.6, -67, 1.2, 1.1],
                    ].map(([x, y, s, delay]) => (
                      <path
                        key={`${x}${y}`}
                        className="wheel-twinkle"
                        d={sparklePath(x, y, s)}
                        fill="var(--wheel-gold-shine)"
                        style={{
                          transformBox: "fill-box",
                          transformOrigin: "center",
                          animation: `wheel-twinkle 1.6s ease-in-out ${delay}s infinite`,
                        }}
                      />
                    ))}
                  </g>
                );
              })}

              {/* Labels run along the radius, rim → hub, flipped on the right
                half so none reads upside down. A miss («Хоосон») has no
                words — its broken heart says it (client, 2026-10-31). */}
              {prizes.map((prize, i) => {
                if (prize.kind === "none") return null;
                const center = (i + 0.5) * seg;
                const color = colorOf(colors, prize);
                const flipped = center < 180;
                const text = prize.shortLabel || prize.label;
                const textProps = {
                  textAnchor: flipped ? ("end" as const) : ("start" as const),
                  dominantBaseline: "central" as const,
                  fontSize: 6.6,
                  fontWeight: 800,
                  letterSpacing: 0.3,
                };
                if (prize.tier === "grand") {
                  // The jackpot's name in plain white, glowing — no outline.
                  return (
                    <g
                      key={`t-${prize.slot}`}
                      transform={`rotate(${center}) translate(0 ${-LABEL_R}) rotate(${flipped ? -90 : 90})`}
                      filter={`url(#${uid}-white)`}
                    >
                      <text {...textProps} fill="#ffffff">
                        {text}
                      </text>
                    </g>
                  );
                }
                return (
                  <g key={`t-${prize.slot}`} transform={`rotate(${center})`}>
                    <text
                      {...textProps}
                      transform={`translate(0 ${-LABEL_R}) rotate(${flipped ? -90 : 90})`}
                      fill={color.text}
                    >
                      {text}
                    </text>
                  </g>
                );
              })}

              {/* A lit icon per prize at the rim — V point coin, coupon,
                  broken heart for «Хоосон» (the grand has its crown). */}
              {prizes.map((prize, i) =>
                prize.tier === "grand" ? null : (
                  <g
                    key={`icon-${prize.slot}`}
                    transform={`rotate(${(i + 0.5) * seg}) translate(0 ${-ICON_R})`}
                  >
                    {/* The "lit" look without an SVG filter: 25 blurs
                        re-rasterised on every animation frame made the page
                        stutter while scrolling. Two soft discs do the job. */}
                    {prize.kind !== "none" && (
                      <>
                        <circle
                          r={8.5}
                          fill="var(--wheel-gold)"
                          opacity={0.1}
                        />
                        <circle
                          r={6.5}
                          fill="var(--wheel-gold)"
                          opacity={0.14}
                        />
                      </>
                    )}
                    <PrizeGlyph kind={prize.kind} />
                  </g>
                ),
              )}

              {/* Pegs at every seam, riding with the wheel. */}
              {prizes.map((prize, i) => {
                const { x, y } = polar(i * seg, FACE_R - 3.2);
                return (
                  <circle
                    key={`peg-${prize.slot}`}
                    cx={x}
                    cy={y}
                    r={2}
                    fill="var(--wheel-gold-light)"
                    stroke="var(--wheel-gold-deep)"
                    strokeWidth={0.8}
                  />
                );
              })}

              {/* The landed wedge: the rest dims, it gets a lit outline. */}
              {landed !== null && (
                <g aria-hidden>
                  {prizes.map((prize, i) =>
                    i + 1 === landed ? null : (
                      <path
                        key={`dim-${prize.slot}`}
                        d={segmentPath(i + 1, count, FACE_R, HUB_R)}
                        fill="var(--background)"
                        opacity={0.62}
                      />
                    ),
                  )}
                  {phase === "win" && (
                    <motion.path
                      d={segmentPath(landed, count, FACE_R - 0.8, HUB_R)}
                      fill="none"
                      stroke="var(--foreground)"
                      strokeWidth={2.2}
                      strokeLinejoin="round"
                      initial={{ opacity: 0 }}
                      animate={
                        reduced
                          ? { opacity: 1 }
                          : { opacity: [0, 1, 0.3, 1, 0.3, 1] }
                      }
                      transition={{ duration: 1.4 }}
                    />
                  )}
                </g>
              )}
            </motion.svg>
          </div>

          {/* ── Hub — the spin button ───────────────────────────────── */}
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <motion.button
              type="button"
              onClick={onSpin}
              disabled={disabled || busy}
              whileTap={reduced || !ready ? undefined : { scale: 0.92 }}
              whileHover={reduced || !ready ? undefined : { scale: 1.04 }}
              className={cn(
                "bg-background text-foreground pointer-events-auto grid size-[24%] cursor-pointer place-items-center rounded-full text-center",
                "disabled:cursor-not-allowed",
              )}
              style={{ boxShadow: "0 10px 26px rgb(0 0 0 / 0.55)" }}
            >
              {busy ? (
                <Loader2 className="text-wheel-title size-6 animate-spin" />
              ) : (
                <span className="flex flex-col items-center px-1 leading-none">
                  <VPointIcon className="text-wheel-title mb-1 size-[clamp(1.1rem,4.2vw,1.6rem)]" />
                  <span className="text-[clamp(0.6rem,2.5vw,0.85rem)] font-black tracking-wider">
                    {hubLabel}
                  </span>
                  {hubHint && (
                    <span className="text-wheel-accent mt-1 text-[clamp(0.5rem,1.9vw,0.68rem)] font-semibold">
                      {hubHint}
                    </span>
                  )}
                </span>
              )}
            </motion.button>
          </div>

          {/* ── Pointer — a small gold flapper the pegs knock aside ─── */}
          <motion.div
            aria-hidden
            key={kick}
            initial={reduced ? false : { rotate: -16 }}
            animate={{ rotate: 0 }}
            transition={{ type: "spring", stiffness: 850, damping: 14 }}
            className="absolute top-[-1.5%] left-1/2 z-10 w-[6.5%] origin-[50%_22%] -translate-x-1/2"
          >
            <svg
              viewBox="0 0 40 52"
              className="w-full"
              style={{ filter: "drop-shadow(0 4px 6px rgb(0 0 0 / 0.5))" }}
            >
              <path
                d="M20 52 L4 16 A16 16 0 0 1 36 16 Z"
                fill="var(--wheel-gold-deep)"
              />
              <path
                d="M20 47 L7 16 A13 13 0 0 1 33 16 Z"
                fill="var(--wheel-gold)"
              />
              <path
                d="M20 40 L11 17 A9 9 0 0 1 20 9 Z"
                fill="var(--wheel-gold-light)"
                opacity={0.7}
              />
            </svg>
          </motion.div>
        </div>
      </div>
    );
  },
);
