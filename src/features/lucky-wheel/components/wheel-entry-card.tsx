"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ChevronRight, Disc3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import { useCountdown, useWheelState } from "../use-wheel";

/**
 * The wheel's entry point on the profile page.
 *
 * It states the one thing the customer wants to know before tapping — is the
 * free spin up yet, and if not, when — so the row is worth reading even when
 * they don't go through. Renders nothing at all while the wheel is off, being
 * fetched, or unavailable (demo build): an inert row promising a spin that
 * cannot happen is worse than no row.
 */
export function WheelEntryCard({ className }: { className?: string }) {
  const { data: state } = useWheelState();
  const countdown = useCountdown(state?.nextFreeAt);
  const reduced = usePrefersReducedMotion();

  if (!state?.enabled || state.prizes.length === 0) return null;

  const ready = state.freeReady || countdown.ready;
  const canPay = state.points >= state.spinCost && state.spinCost > 0;

  const status = ready
    ? "Үнэгүй эргэлт бэлэн боллоо"
    : canPay
      ? `${state.spinCost.toLocaleString("mn-MN")}V-оор эргүүлэх боломжтой`
      : `Дараагийн үнэгүй эргэлт ${countdown.label}-ийн дараа`;

  return (
    <Link
      href="/lucky-wheel"
      className={cn(
        "bg-card hover:bg-accent flex items-center gap-4 rounded-xl p-4 transition-colors",
        ready && "ring-gold/60 ring-1",
        className,
      )}
    >
      <span className="bg-secondary flex size-10 shrink-0 items-center justify-center rounded-full">
        {/* The icon turns slowly while a spin is waiting — the row's only
            motion, and it stops once there is nothing to collect. */}
        <motion.span
          animate={ready && !reduced ? { rotate: 360 } : { rotate: 0 }}
          transition={
            ready && !reduced
              ? { duration: 8, repeat: Infinity, ease: "linear" }
              : { duration: 0.3 }
          }
          className="flex"
        >
          <Disc3 className={cn("size-4", ready && "text-gold-strong")} />
        </motion.span>
      </span>

      <span className="min-w-0">
        <span className="block font-medium">Азын хүрд</span>
        <span
          className={cn(
            "block text-xs tabular-nums",
            ready ? "text-gold-strong" : "text-muted-foreground",
          )}
        >
          {status}
        </span>
      </span>

      <ChevronRight className="text-muted-foreground ml-auto size-4 shrink-0" />
    </Link>
  );
}
