"use client";

import * as React from "react";

/**
 * Доод fixed зурвасуудыг (доод цэс, «Захиалах», «Төлбөр төлөх») харагдах
 * дэлгэцийн ёроолд барина — `bottom-visual` utility-ийн `--visual-bottom`-ийг
 * <html> дээр тавина. Юу ч зурахгүй.
 *
 * iOS 26 WebKit-ийн regression (FB19889436, Apple forums #800154): гар —
 * Safari-ийн хаягийн мөрөнд бичих, хайлт, ямар ч input — хаагдсаны дараа
 * `visualViewport.offsetTop` 0 болж буцдаггүй. Layout viewport харагдах
 * хэсгээсээ дээш гацаж, түүнд наалдсан `bottom: 0` элемент гарын өндрөөр
 * (~330px) дэлгэцийн ДУНД хөвж үлддэг; дараагийн гүйлгэлт хүртэл, заримдаа
 * табыг хаах хүртэл. Хэрэглэгч «хааяа» гэж мэдээлдэг нь үүнээс: гар нээгдсэн
 * эсэхээс хамаарна, хуудаснаас биш.
 */
export function VisualViewportSync() {
  React.useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;

    let applied = 0;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const next = visualBottomGap({
        innerHeight: window.innerHeight,
        offsetTop: vv.offsetTop,
        height: vv.height,
        scale: vv.scale,
      });
      if (next === applied) return;
      applied = next;
      if (next === 0) root.style.removeProperty("--visual-bottom");
      else root.style.setProperty("--visual-bottom", `${next}px`);
    };
    // Гүйлгэлтийн үеэр олон удаа ирдэг — нэг кадрт нэг л хэмжилт.
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    // Гацсан төлөв хэрэглэгч гүйлгэхэд өөрөө тайлагддаг — тэр мөчийг ч барина.
    window.addEventListener("scroll", schedule, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener("resize", schedule);
      vv.removeEventListener("scroll", schedule);
      window.removeEventListener("scroll", schedule);
      root.style.removeProperty("--visual-bottom");
    };
  }, []);

  return null;
}

/**
 * Доод зурвасыг хэдэн px доош (сөрөг `bottom`) шилжүүлэх вэ.
 *
 * Layout viewport-ийн ёроол (`innerHeight`) ба харагдах хэсгийн ёроол
 * (`offsetTop + height`) хоорондын зөрүү; эрүүл үед 0. Зөвхөн сөрөг — layout
 * нь дээш гацсан — үед залруулна. Эерэг зөрүү нь гар нээлттэй байгаа хэвийн
 * төлөв: зурвас өмнөх шигээ гарын ард үлдэнэ, гар дээр хөвж гарахгүй.
 * Хуруугаар томруулсан (pinch-zoom) үед fixed элемент layout viewport-д
 * наалддаг нь зөв зан тул хөндөхгүй.
 */
export function visualBottomGap(v: {
  innerHeight: number;
  offsetTop: number;
  height: number;
  scale: number;
}): number {
  if (Math.abs(v.scale - 1) > 0.01) return 0;
  const gap = v.innerHeight - (v.offsetTop + v.height);
  // 1px-ийн бутархай зөрүү гүйлгэх бүрд хэвийн гардаг — дагаж хөдлөхгүй.
  return gap > -1 ? 0 : Math.round(gap);
}
