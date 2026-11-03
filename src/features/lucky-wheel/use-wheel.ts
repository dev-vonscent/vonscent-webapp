"use client";

import * as React from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  BundleGender,
  GrandPrizesResponse,
  SpinFailure,
  SpinHistoryPage,
  SpinMode,
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
 * The full spin history, paged. Only fetched while the dialog is open; the
 * key sits under WHEEL_QUERY_KEY so a spin's invalidation refreshes it too.
 */
export function useSpinHistory(enabled: boolean) {
  return useInfiniteQuery({
    queryKey: [...WHEEL_QUERY_KEY, "history"],
    queryFn: async ({ pageParam }): Promise<SpinHistoryPage> => {
      const res = await fetch(`/api/lucky-wheel/history?offset=${pageParam}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("wheel_history_failed");
      return res.json();
    },
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset,
    enabled,
  });
}

/**
 * One spin. Nothing is refreshed here on success — the wheel has to finish
 * turning first, or the page would announce the prize (a V point balance
 * already grown, a history row) while the pointer is still moving. The caller
 * invalidates `WHEEL_QUERY_KEY` once the animation lands.
 */
export function useSpin() {
  const queryClient = useQueryClient();
  return useMutation<SpinSuccess, SpinFailure, SpinMode>({
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
    // A refusal changes nothing on screen worth hiding — refresh at once.
    onError: () => {
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

  // A few cents of random detune: a wooden peg never clicks twice alike.
  const tick = React.useCallback(
    () => blip(1100 + Math.random() * 160, 0.035, 0.05, "square"),
    [blip],
  );

  /** The launch: a short band of filtered noise sweeping down. */
  const whoosh = React.useCallback(() => {
    const ctx = context();
    if (!ctx) return;
    const length = Math.floor(ctx.sampleRate * 0.5);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 1.4;
    filter.frequency.setValueAtTime(2400, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(380, ctx.currentTime + 0.5);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, ctx.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.06);
    amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    noise.connect(filter).connect(amp).connect(ctx.destination);
    noise.start();
  }, [context]);

  /** A win: a rising arpeggio, then the chord held under it. */
  const fanfare = React.useCallback(
    (grand: boolean) => {
      const notes = grand ? [523, 659, 784, 1046, 1318] : [523, 659, 784];
      notes.forEach((freq, i) => {
        setTimeout(() => blip(freq, 0.28, 0.09, "triangle"), i * 95);
      });
      const chordAt = notes.length * 95;
      const chord = grand ? [523, 659, 784, 1046] : [523, 659, 784];
      chord.forEach((freq) => {
        setTimeout(() => blip(freq, grand ? 1.4 : 0.8, 0.05, "sine"), chordAt);
      });
    },
    [blip],
  );

  /** A miss («Хоосон»): two soft falling notes — consolation, not a buzzer. */
  const miss = React.useCallback(() => {
    blip(523, 0.22, 0.06, "sine");
    setTimeout(() => blip(392, 0.4, 0.06, "sine"), 160);
  }, [blip]);

  React.useEffect(
    () => () => {
      void ctxRef.current?.close();
      ctxRef.current = null;
    },
    [],
  );

  return { on, toggle, tick, whoosh, fanfare, miss };
}

/* ── Бодит шагнал: гранд 2мл багц (0165), бараа (0170) ──────────────── */

export const GRAND_PRIZES_KEY = [...WHEEL_QUERY_KEY, "prizes"] as const;

/** The customer's physical prizes and today's two grand bundles. */
export function useGrandPrizes(enabled = true) {
  return useQuery<GrandPrizesResponse>({
    queryKey: GRAND_PRIZES_KEY,
    queryFn: async () => {
      const res = await fetch("/api/lucky-wheel/prizes", { cache: "no-store" });
      if (!res.ok) throw new Error("grand_prizes_failed");
      return res.json();
    },
    enabled,
    staleTime: 30_000,
  });
}

/** Why a bundle could not be picked, in the customer's words. */
export const CHOOSE_REFUSAL: Record<string, string> = {
  LOCKED: "Шагнал аль хэдийн захиалгад орсон байна.",
  EXPIRED: "Шагналын хугацаа дууссан байна.",
  NO_OPTION: "Энэ багц одоогоор санал болгогдоогүй байна.",
  SOLD_OUT: "Энэ багц 2мл-ээр түр дууссан байна. Нөгөөг нь сонгоно уу.",
  NOT_FOUND: "Шагнал олдсонгүй.",
};

export function useChooseBundle() {
  const queryClient = useQueryClient();
  return useMutation<
    GrandPrizesResponse,
    Error,
    { spinId: string; gender: BundleGender }
  >({
    mutationFn: async (input) => {
      const res = await fetch("/api/lucky-wheel/prizes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "CHOOSE_FAILED");
      return data as GrandPrizesResponse;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(GRAND_PRIZES_KEY, data);
    },
  });
}
