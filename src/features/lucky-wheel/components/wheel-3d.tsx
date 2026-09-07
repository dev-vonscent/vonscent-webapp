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
import { segmentPath, slotAtRotation, targetRotation } from "../geometry";
import type { WheelPrize } from "../types";

/**
 * The wheel itself.
 *
 * Three-dimensional for real, not painted: the stage carries a `perspective`
 * and the disc is tilted on X, so the stack of discs behind the face projects
 * as a visible rim edge. Only the face rotates — the rim is a solid colour and
 * would look identical spinning, so keeping it still leaves exactly one
 * transformed layer per frame.
 *
 * Colour comes from `color-mix` over the theme's own foreground/background, so
 * the same wheel reads correctly in all three themes and stays inside the
 * house rule of solid colour only (design.md §2 — no gradients).
 */

/** Depth of the rim, in stacked discs. */
const DEPTH = 9;
const DEPTH_STEP = 2.4;

export interface WheelHandle {
  /** Spin to `slot` and resolve once the pointer has settled. */
  spinTo(slot: number): Promise<void>;
}

interface WheelProps {
  prizes: WheelPrize[];
  /** Hub button — the primary way to spin. */
  onSpin?: () => void;
  hubLabel: string;
  hubHint?: string;
  disabled?: boolean;
  busy?: boolean;
  /** Fired as each segment passes the pointer, for sound and haptics. */
  onTick?: () => void;
  className?: string;
}

/** Segment fill, as a step of the theme's own foreground over its background. */
function fillFor(prize: WheelPrize, index: number): string {
  if (prize.tier === "grand") return "var(--gold)";
  const pct = prize.tier === "rare" ? 22 : index % 2 === 0 ? 6 : 13;
  return `color-mix(in oklab, var(--foreground) ${pct}%, var(--background))`;
}

function textFor(prize: WheelPrize): string {
  return prize.tier === "grand" ? "var(--background)" : "var(--foreground)";
}

/**
 * Split a short label so it stays inside its wedge. The cut-off is 6
 * characters, not 8: at radius 64 an eight-character line spans wider than the
 * 45° wedge it belongs to, and its ends drift over the neighbouring segments.
 */
function labelLines(text: string): string[] {
  if (text.length <= 6) return [text];
  const parts = text.split(" ");
  if (parts.length === 1) return [text];
  const mid = Math.ceil(parts.length / 2);
  return [parts.slice(0, mid).join(" "), parts.slice(mid).join(" ")];
}

export const Wheel3D = React.forwardRef<WheelHandle, WheelProps>(
  function Wheel3D(
    { prizes, onSpin, hubLabel, hubHint, disabled, busy, onTick, className },
    ref,
  ) {
    const reduced = usePrefersReducedMotion();
    const rotation = useMotionValue(0);
    const [pointerKick, setPointerKick] = React.useState(0);
    const lastSlot = React.useRef(1);
    const count = prizes.length;

    // Pointer parallax: the stage leans a few degrees towards the cursor, which
    // is what makes the depth read as depth before anything moves.
    const tiltX = useMotionValue(15);
    const tiltY = useMotionValue(0);

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (reduced || e.pointerType !== "mouse") return;
      const rect = e.currentTarget.getBoundingClientRect();
      const dx = (e.clientX - rect.left) / rect.width - 0.5;
      const dy = (e.clientY - rect.top) / rect.height - 0.5;
      animate(tiltY, dx * 14, { duration: 0.5 });
      animate(tiltX, 15 - dy * 10, { duration: 0.5 });
    };

    const resetTilt = () => {
      animate(tiltY, 0, { duration: 0.6 });
      animate(tiltX, 15, { duration: 0.6 });
    };

    // One flick of the pointer per segment boundary — the physical tick that
    // makes a wheel feel like a wheel rather than a rotating picture.
    useMotionValueEvent(rotation, "change", (value) => {
      if (count === 0) return;
      const slot = slotAtRotation(value, count);
      if (slot === lastSlot.current) return;
      lastSlot.current = slot;
      setPointerKick((n) => n + 1);
      onTick?.();
    });

    React.useImperativeHandle(ref, () => ({
      async spinTo(slot: number) {
        if (count === 0) return;
        const from = rotation.get();
        const turns = reduced ? 0 : 5 + Math.floor(Math.random() * 3);
        const jitter = reduced ? 0 : Math.random() * 2 - 1;
        const target = targetRotation(from, slot, count, turns, jitter);
        if (reduced) {
          await animate(rotation, target, { duration: 0.45, ease: "easeOut" });
          return;
        }
        // A long tail rather than a plain ease-out: the wheel should still be
        // creeping when it crosses the last two segments.
        await animate(rotation, target, {
          duration: 5.4,
          ease: [0.08, 0.72, 0.12, 1],
        });
        // Backlash — the peg lets go and the rim rocks back a fraction.
        await animate(rotation, target - 1.4, {
          type: "spring",
          stiffness: 140,
          damping: 11,
          mass: 0.6,
        });
      },
    }));

    return (
      <div
        className={cn(
          "relative mx-auto w-full max-w-[min(88vw,30rem)]",
          className,
        )}
        onPointerMove={handlePointerMove}
        onPointerLeave={resetTilt}
      >
        {/* Grounding shadow: the wheel floats, so it needs something under it. */}
        <div
          aria-hidden
          className="absolute inset-x-[12%] bottom-[2%] h-6 rounded-[50%] blur-xl"
          style={{
            background:
              "color-mix(in oklab, var(--foreground) 22%, transparent)",
          }}
        />

        <div className="relative aspect-square perspective-[1400px]">
          <motion.div
            className="absolute inset-0 transform-3d"
            style={{ rotateX: tiltX, rotateY: tiltY }}
          >
            {/* Rim: stacked discs receding in Z. Static — a solid cylinder
                looks the same at every angle, so it never needs to turn. */}
            {Array.from({ length: DEPTH }, (_, i) => (
              <div
                key={i}
                aria-hidden
                className="absolute inset-[1.5%] rounded-full"
                style={{
                  transform: `translateZ(-${(i + 1) * DEPTH_STEP}px)`,
                  background: `color-mix(in oklab, var(--foreground) ${
                    18 - i * 1.6
                  }%, var(--background))`,
                }}
              />
            ))}

            {/* Bezel — the still frame the pegs sit on. */}
            <div
              aria-hidden
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  "color-mix(in oklab, var(--foreground) 20%, var(--background))",
                boxShadow: "var(--shadow-lift)",
              }}
            />

            <motion.svg
              viewBox="-100 -100 200 200"
              className="absolute inset-[4%] size-[92%] overflow-visible"
              style={{ rotate: rotation }}
              role="img"
              aria-label={`Азын хүрд: ${prizes.map((p) => p.label).join(", ")}`}
            >
              {prizes.map((prize, i) => (
                <path
                  key={prize.slot}
                  d={segmentPath(prize.slot, count, 100)}
                  fill={fillFor(prize, i)}
                  stroke="color-mix(in oklab, var(--background) 70%, transparent)"
                  strokeWidth={0.8}
                />
              ))}
              {prizes.map((prize) => {
                const lines = labelLines(prize.shortLabel || prize.label);
                const center = (prize.slot - 0.5) * (360 / count);
                const y = lines.length > 1 ? -68 : -64;
                // Past a quarter turn the radial label ends up upside down.
                // Flipping it about its own anchor keeps every wedge readable
                // without moving the text off its radius.
                const flipped = center > 90 && center < 270;
                return (
                  <g key={`t-${prize.slot}`} transform={`rotate(${center})`}>
                    <text
                      x={0}
                      y={y}
                      transform={flipped ? `rotate(180 0 ${y})` : undefined}
                      textAnchor="middle"
                      fill={textFor(prize)}
                      fontSize={lines.length > 1 ? 10 : 11.5}
                      fontWeight={prize.tier === "common" ? 500 : 700}
                      letterSpacing={0.2}
                    >
                      {lines.map((line, li) => (
                        <tspan key={line} x={0} dy={li === 0 ? 0 : 12}>
                          {line}
                        </tspan>
                      ))}
                    </text>
                    {prize.tier !== "common" && (
                      <circle
                        cx={0}
                        cy={-36}
                        r={2}
                        fill={textFor(prize)}
                        opacity={0.75}
                      />
                    )}
                  </g>
                );
              })}
            </motion.svg>

            {/* Pegs on the still bezel, one per divider. Drawn in their own
                SVG rather than as positioned divs: a percentage translate
                would be measured against the peg, not the wheel. */}
            <svg
              aria-hidden
              viewBox="-100 -100 200 200"
              className="pointer-events-none absolute inset-0 size-full"
              style={{ transform: "translateZ(4px)" }}
            >
              {prizes.map((prize) => {
                const a =
                  ((prize.slot - 1) * (360 / count) - 90) * (Math.PI / 180);
                return (
                  <circle
                    key={`peg-${prize.slot}`}
                    cx={96 * Math.cos(a)}
                    cy={96 * Math.sin(a)}
                    r={2.2}
                    fill="color-mix(in oklab, var(--foreground) 55%, var(--background))"
                  />
                );
              })}
            </svg>
          </motion.div>

          {/* Hub — the spin button. Sits above the disc in Z so the tilt never
              buries it, and stays a real <button> for keyboard and screen
              readers. */}
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <motion.button
              type="button"
              onClick={onSpin}
              disabled={disabled || busy}
              whileTap={reduced ? undefined : { scale: 0.94 }}
              whileHover={reduced ? undefined : { scale: 1.03 }}
              className={cn(
                "bg-background text-foreground pointer-events-auto grid size-[30%] cursor-pointer",
                "place-items-center rounded-full text-center leading-tight",
                "disabled:cursor-not-allowed disabled:opacity-60",
              )}
              style={{
                boxShadow:
                  "0 0 0 2px color-mix(in oklab, var(--foreground) 30%, transparent), var(--shadow-lift)",
              }}
            >
              {busy ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <span className="px-1">
                  <span className="block text-[clamp(0.7rem,2.6vw,0.9rem)] font-semibold tracking-wide">
                    {hubLabel}
                  </span>
                  {hubHint && (
                    <span className="text-muted-foreground mt-0.5 block text-[clamp(0.55rem,2vw,0.7rem)]">
                      {hubHint}
                    </span>
                  )}
                </span>
              )}
            </motion.button>
          </div>

          {/* Pointer, at 12 o'clock. It flicks on every peg it passes. */}
          <motion.div
            aria-hidden
            key={pointerKick}
            initial={reduced ? false : { rotate: -13 }}
            animate={{ rotate: 0 }}
            transition={{ type: "spring", stiffness: 900, damping: 16 }}
            className="absolute -top-2 left-1/2 z-10 -ml-3.5 origin-top"
          >
            {/* An SVG triangle, not a CSS border one: `@layer base` collapses
                every border-color to transparent with `!important`, which an
                inline style cannot outrank. */}
            <svg
              width="28"
              height="30"
              viewBox="0 0 28 30"
              style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.35))" }}
            >
              <path
                d="M14 30 L2 4 A 12 12 0 0 1 26 4 Z"
                fill="var(--foreground)"
              />
              <circle cx="14" cy="8" r="3.4" fill="var(--background)" />
            </svg>
          </motion.div>
        </div>
      </div>
    );
  },
);
