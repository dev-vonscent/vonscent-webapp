"use client";

import * as React from "react";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

/**
 * A one-shot confetti burst on a full-screen canvas.
 *
 * Canvas rather than a few hundred DOM nodes: the browser paints one layer
 * instead of laying out 160 elements a frame, and the whole thing removes
 * itself when the last piece falls off screen. Colours are read from the live
 * theme so the burst belongs to whichever of the three palettes is on.
 */

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  spin: number;
  angle: number;
  color: string;
  ratio: number;
}

const GRAVITY = 0.16;
const DRAG = 0.992;

function themeColors(): string[] {
  const style = getComputedStyle(document.documentElement);
  const pick = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback;
  return [
    pick("--gold", "#d4d4d4"),
    pick("--gold-soft", "#a1a1a1"),
    pick("--foreground", "#ffffff"),
    pick("--muted-foreground", "#a1a1a1"),
  ];
}

export function Confetti({
  fire,
  intense = false,
}: {
  /** Increment to fire a burst; 0 means "nothing yet". */
  fire: number;
  /** The grand prize gets twice the pieces and a wider spread. */
  intense?: boolean;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const reduced = usePrefersReducedMotion();

  React.useEffect(() => {
    if (!fire || reduced) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    const colors = themeColors();
    const count = intense ? 220 : 120;
    const originY = height * 0.42;
    const pieces: Piece[] = Array.from({ length: count }, () => {
      const angle =
        -Math.PI / 2 + (Math.random() - 0.5) * (intense ? 2.6 : 1.9);
      const speed = (intense ? 9 : 7) + Math.random() * 7;
      return {
        x: width / 2 + (Math.random() - 0.5) * width * 0.25,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 5 + Math.random() * 6,
        ratio: 0.35 + Math.random() * 0.5,
        spin: (Math.random() - 0.5) * 0.3,
        angle: Math.random() * Math.PI,
        color: colors[Math.floor(Math.random() * colors.length)],
      };
    });

    let raf = 0;
    let alive = true;
    const step = () => {
      ctx.clearRect(0, 0, width, height);
      let onScreen = 0;
      for (const p of pieces) {
        p.vy += GRAVITY;
        p.vx *= DRAG;
        p.x += p.vx;
        p.y += p.vy;
        p.angle += p.spin;
        if (p.y < height + 40) onScreen++;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        // Flip the piece as it tumbles — a rectangle that never turns edge-on
        // reads as a sticker rather than a scrap of paper.
        ctx.globalAlpha = 0.55 + 0.45 * Math.abs(Math.cos(p.angle));
        ctx.fillRect(
          -p.size / 2,
          -(p.size * p.ratio) / 2,
          p.size,
          p.size * p.ratio,
        );
        ctx.restore();
      }
      if (onScreen === 0 || !alive) {
        ctx.clearRect(0, 0, width, height);
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, width, height);
    };
  }, [fire, intense, reduced]);

  if (reduced) return null;
  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-60"
    />
  );
}
