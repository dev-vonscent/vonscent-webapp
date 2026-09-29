"use client";

import * as React from "react";

const EDITABLE = "input,textarea,select,[contenteditable='true']";

/** Гар хаагдах хөдөлгөөн (~250ms) дуусахыг хүлээх хугацаа. */
const SETTLE_MS = 300;

function editableFocused() {
  const el = document.activeElement;
  return el instanceof HTMLElement && el.matches(EDITABLE);
}

/**
 * Гар хаагдсаны дараа `position: fixed` элементүүдийг байранд нь буулгана.
 *
 * iOS 26-ийн WebKit (Safari болон Discord/Instagram зэрэг in-app browser) гар
 * хаагдахад visual viewport-оо бүрэн сэргээдэггүй: доод цэс, барааны
 * «Захиалах» зурвас гарын өндрөөр дээш — дэлгэцийн голд — гацаж, доош
 * гүйлгэсэн ч тэндээ үлддэг. Хайлт, купон, багцын нэр гэх мэт аль ч талбарт
 * гар нээгээд хаасны дараа л гардаг тул «хааяа» мэт санагддаг.
 *
 * CSS-ээр засагдахгүй алдаа. WebKit байрлалаа гүйлгэлт дээр л дахин
 * тооцоолдог тул гар хаагдмагц 1px нааш цааш гүйлгэж хүчээр тооцоолуулна —
 * хоёр алхам нэг frame дотор болох тул нүдэнд харагдахгүй. Бусад хөтөч дээр
 * хор хөнөөлгүй. Юу ч render хийхгүй.
 */
export function KeyboardDismissRepair() {
  React.useEffect(() => {
    let timer: number | undefined;

    /** `keyboardClosed`: viewport өөрөө томорсон — focus-ээс үл хамааран засна. */
    const repair = (keyboardClosed = false) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        // Нэг талбараас нөгөөд шилжихэд гар хаагдаагүй — хөндөхгүй.
        if (!keyboardClosed && editableFocused()) return;
        const x = window.scrollX;
        const y = window.scrollY;
        window.scrollTo(x, y > 0 ? y - 1 : y + 1);
        window.scrollTo(x, y);
      }, SETTLE_MS);
    };

    const onFocusOut = (e: FocusEvent) => {
      if (e.target instanceof HTMLElement && e.target.matches(EDITABLE)) {
        repair();
      }
    };

    // Гарыг «Done»/доош чирж хаахад focus заримдаа хэвээр үлддэг — тэр үед
    // visual viewport өндөр нь буцаж томорно.
    const vv = window.visualViewport;
    let lastHeight = vv?.height ?? 0;
    const onResize = () => {
      if (!vv) return;
      if (vv.height - lastHeight > 100) repair(true);
      lastHeight = vv.height;
    };

    document.addEventListener("focusout", onFocusOut);
    vv?.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("focusout", onFocusOut);
      vv?.removeEventListener("resize", onResize);
    };
  }, []);

  return null;
}
