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
  /**
   * Хуудасны доод төгсгөлд хүрсэн — уншиж дууссан хүн дараагийн алхам руу
   * шилжинэ (iOS Safari-ийн toolbar шиг). Доод цэс гарч, footer-ийн доорх
   * нөөц зайг дүүргэнэ; header нуугдсан чигээрээ.
   */
  atEnd: boolean;
  setScroll: (scrollHidden: boolean, atEnd: boolean) => void;
}

const useBottomNavStore = create<BottomNavState>((set) => ({
  claims: 0,
  claim: () => set((s) => ({ claims: s.claims + 1 })),
  release: () => set((s) => ({ claims: Math.max(0, s.claims - 1) })),
  scrollHidden: false,
  atEnd: false,
  setScroll: (scrollHidden, atEnd) => set({ scrollHidden, atEnd }),
}));

/** Хуудасны үйлдлийн зурвас доод ирмэгийг эзэлсэн эсэх. */
export function useBottomBarClaimed() {
  return useBottomNavStore((s) => s.claims > 0);
}

/** Доош гүйлгэснээр доод цэс нуугдах ёстой эсэх (төгсгөлд хүрвэл гарна). */
export function useScrollHidden() {
  return useBottomNavStore((s) => s.scrollHidden && !s.atEnd);
}

/** `SiteHeader` гүйлгэлтийн төлөвөө энд нийтэлнэ. */
export function usePublishScrollHidden(hidden: boolean, atEnd = false) {
  const setScroll = useBottomNavStore((s) => s.setScroll);
  React.useEffect(() => {
    setScroll(hidden, atEnd);
  }, [hidden, atEnd, setScroll]);
  React.useEffect(() => () => setScroll(false, false), [setScroll]);
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
