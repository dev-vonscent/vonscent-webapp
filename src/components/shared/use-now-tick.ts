"use client";

import * as React from "react";

/**
 * Секунд тутмын НЭГ дундын цаг — хуудсан дээрх бүх тоолуур (каталогийн 24
 * карт г.м.) нэг `setInterval`-ийг хуваалцана. Анхны захиалагч ирэхэд
 * эхэлж, сүүлийнх нь явахад зогсоно.
 *
 * Сервер ба hydration-ий render-т null (`getServerSnapshot`) — тоолуурын
 * текст SSR/ISR HTML-д хэзээ ч орохгүй (hydration mismatch, ISR write
 * үгүй). Hydration-ий дараа React захиалж, жинхэнэ цаг руу шилжинэ.
 */
const TICK_MS = 1000;

let now: number | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function emit() {
  now = Date.now();
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (timer == null) {
    timer = setInterval(emit, TICK_MS);
    // Эхний утгыг шууд — секунд хүлээхгүй.
    queueMicrotask(emit);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer != null) {
      clearInterval(timer);
      timer = null;
      now = null;
    }
  };
}

const getSnapshot = () => now;
const getServerSnapshot = () => null;

/** Одоогийн мөч (ms), сервер дээр болон hydration-ий үед null. */
export function useNowTick(): number | null {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Тестэд: дундын төлвийг цэвэрлэнэ. */
export function __resetNowTick() {
  if (timer != null) clearInterval(timer);
  timer = null;
  now = null;
  listeners.clear();
}
