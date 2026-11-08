"use client";

import * as React from "react";
import { create } from "zustand";

interface BottomNavState {
  /**
   * Хэдэн хуудасны үйлдлийн зурвас яг одоо доод ирмэгийг эзэлж байгаа тоо.
   *
   * Boolean биш тоолуур: хоёр зурвас давхцан гарч нэг нь хаагдахад нөгөө нь
   * хэвээрээ байтал цэс эргэж гарч ирэх алдааг үүнээс сэргийлнэ.
   */
  claims: number;
  claim: () => void;
  release: () => void;
  /**
   * Доош гүйлгэж байгаа үед `true` — header-тэй хамт цэс ч гулсаж бууна
   * (Material «hide on scroll», Instagram/X шиг). Эх сурвалж нь `SiteHeader`-ийн
   * гүйлгэлтийн дүрэм ганцаараа, тэгэхгүй бол хоёр зурвас өөр мөчид хөдөлнө.
   */
  scrollHidden: boolean;
  setScrollHidden: (hidden: boolean) => void;
}

const useBottomNavStore = create<BottomNavState>((set) => ({
  claims: 0,
  claim: () => set((s) => ({ claims: s.claims + 1 })),
  release: () => set((s) => ({ claims: Math.max(0, s.claims - 1) })),
  scrollHidden: false,
  setScrollHidden: (scrollHidden) => set({ scrollHidden }),
}));

/** Хуудасны үйлдлийн зурвас доод ирмэгийг эзэлсэн эсэх. */
export function useBottomBarClaimed() {
  return useBottomNavStore((s) => s.claims > 0);
}

/** Доош гүйлгэснээр header ба доод цэс нуугдсан эсэх. */
export function useScrollHidden() {
  return useBottomNavStore((s) => s.scrollHidden);
}

/** `SiteHeader` гүйлгэлтийн төлөвөө энд нийтэлнэ. */
export function usePublishScrollHidden(hidden: boolean) {
  const setScrollHidden = useBottomNavStore((s) => s.setScrollHidden);
  React.useEffect(() => {
    setScrollHidden(hidden);
  }, [hidden, setScrollHidden]);
  React.useEffect(() => () => setScrollHidden(false), [setScrollHidden]);
}

/**
 * Дэлгэцийн доод ирмэгийг эзэмшинэ — идэвхтэй байх хугацаандаа доод цэсийг
 * нуулгана.
 *
 * Барааны хуудасны наалдсан «Захиалах» зурвас цэсний ДЭЭР давхарлан суухад
 * хоёулаа 145px буюу утасны дэлгэцийн 17%-ийг байнга эзэлж, хоёр хөвөгч капсул
 * дээр дээрээсээ овоорч харагддаг байсан. Барааны хуудсанд хэрэглэгч шийдэж
 * байгаа болохоос шилжиж яваа биш — тэр мөчид үйлдэл нь навигацийг дардаг.
 */
export function useClaimBottomBar(active: boolean) {
  const claim = useBottomNavStore((s) => s.claim);
  const release = useBottomNavStore((s) => s.release);
  React.useEffect(() => {
    if (!active) return;
    claim();
    return release;
  }, [active, claim, release]);
}
