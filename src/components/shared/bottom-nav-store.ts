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
}

const useBottomNavStore = create<BottomNavState>((set) => ({
  claims: 0,
  claim: () => set((s) => ({ claims: s.claims + 1 })),
  release: () => set((s) => ({ claims: Math.max(0, s.claims - 1) })),
}));

/** Доод цэс яг одоо нуугдсан эсэх — зөвхөн `BottomNav` уншина. */
export function useBottomNavHidden() {
  return useBottomNavStore((s) => s.claims > 0);
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
