"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  SpinFailure,
  SpinOutcome,
  SpinSuccess,
  WheelState,
} from "./types";

export const WHEEL_QUERY_KEY = ["lucky-wheel"] as const;

/** The wheel's segments, the customer's balance and their cooldown. */
export function useWheelState() {
  return useQuery<WheelState>({
    queryKey: WHEEL_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/lucky-wheel", { cache: "no-store" });
      if (!res.ok) throw new Error("wheel_state_failed");
      return res.json();
    },
    // A cooldown ticks in real time and points change elsewhere (an order, a
    // second tab), so this is never fresh for long.
    staleTime: 15_000,
  });
}

/**
 * One spin. The result is *not* written into the cache here — the wheel has to
 * finish turning first, or the page would announce the prize while the pointer
 * is still moving. The caller refreshes once the animation lands.
 */
export function useSpin() {
  const queryClient = useQueryClient();
  return useMutation<SpinSuccess, SpinFailure, "free" | "points">({
    mutationFn: async (mode) => {
      const res = await fetch("/api/lucky-wheel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = (await res.json().catch(() => null)) as SpinOutcome | null;
      if (!res.ok || !data || !data.ok) {
        throw (data as SpinFailure | null) ?? { ok: false, reason: "NO_DB" };
      }
      return data;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: WHEEL_QUERY_KEY });
    },
  });
}

export interface Countdown {
  ready: boolean;
  hours: number;
  minutes: number;
  seconds: number;
  /** "05:42:11" — zero-padded, hours only while there are any. */
  label: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Live countdown to `iso`, re-rendering once a second while it runs. */
export function useCountdown(iso: string | null | undefined): Countdown {
  const target = iso ? new Date(iso).getTime() : 0;
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (!target || target <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);

  const left = Math.max(0, target - now);
  const seconds = Math.floor(left / 1000) % 60;
  const minutes = Math.floor(left / 60_000) % 60;
  const hours = Math.floor(left / 3_600_000);
  return {
    ready: !target || left <= 0,
    hours,
    minutes,
    seconds,
    label:
      hours > 0
        ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
        : `${pad(minutes)}:${pad(seconds)}`,
  };
}

const SOUND_KEY = "vonscent:wheel-sound";

/**
 * Wheel audio, synthesised rather than shipped: a click as each segment passes
 * the pointer and a short arpeggio on a win. No asset to download, nothing to
 * cache, and it can never play before a gesture has created the context.
 *
 * Off by default — sound that starts on its own is the fastest way to make a
 * page feel cheap.
 */
export function useWheelSound() {
  const [on, setOn] = React.useState(false);
  const ctxRef = React.useRef<AudioContext | null>(null);

  React.useEffect(() => {
    try {
      setOn(window.localStorage.getItem(SOUND_KEY) === "1");
    } catch {
      // Private mode / storage disabled — stay silent.
    }
  }, []);

  const toggle = React.useCallback(() => {
    setOn((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SOUND_KEY, next ? "1" : "0");
      } catch {
        // Ignored: the preference simply won't survive a reload.
      }
      return next;
    });
  }, []);

  const context = React.useCallback(() => {
    if (!on) return null;
    if (!ctxRef.current) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return null;
      ctxRef.current = new Ctor();
    }
    void ctxRef.current.resume?.();
    return ctxRef.current;
  }, [on]);

  const blip = React.useCallback(
    (freq: number, duration: number, gain: number, type: OscillatorType) => {
      const ctx = context();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      amp.gain.setValueAtTime(gain, ctx.currentTime);
      amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.connect(amp).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    },
    [context],
  );

  const tick = React.useCallback(
    () => blip(1180, 0.035, 0.05, "square"),
    [blip],
  );

  const fanfare = React.useCallback(
    (grand: boolean) => {
      const notes = grand ? [523, 659, 784, 1046, 1318] : [523, 659, 784];
      notes.forEach((freq, i) => {
        setTimeout(() => blip(freq, 0.28, 0.09, "triangle"), i * 95);
      });
    },
    [blip],
  );

  React.useEffect(
    () => () => {
      void ctxRef.current?.close();
      ctxRef.current = null;
    },
    [],
  );

  return { on, toggle, tick, fanfare };
}
