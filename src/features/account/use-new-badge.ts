"use client";

import * as React from "react";

const EVENT = "vonscent-seen";
const storageKey = (key: string) => `vonscent-seen:${key}`;

/**
 * «Шинэ» тэмдгийг харуулах эсэх — шинэ хэсгийг зарлах түр тэмдэг.
 *
 * Нуугдах хоёр нөхцөл: хэрэглэгч тэр хуудсыг нэг удаа нээсэн (`markSeen`),
 * эсвэл `until` өнгөрсөн. localStorage нь зөвхөн тухайн төхөөрөмжийнх тул
 * шинэ утсан дээр дахин гарч болно — энэ нь хор хөнөөлгүй тохь л.
 *
 * Mount-ын дараа уншина (SSR дээр хэзээ ч харагдахгүй) тул hydration зөрөхгүй;
 * storage хаалттай үед тэмдэг л харагдахгүй болно, юу ч эвдрэхгүй.
 */
export function useNewBadge(key: string, until: string): boolean {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    const read = () => {
      if (Date.now() >= Date.parse(until)) return setShow(false);
      try {
        setShow(localStorage.getItem(storageKey(key)) == null);
      } catch {
        setShow(false);
      }
    };
    read();
    window.addEventListener(EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, [key, until]);
  return show;
}

/** Тэмдгийг энэ төхөөрөмж дээр нууна; нээлттэй цэсүүд шууд шинэчлэгдэнэ. */
export function markSeen(key: string) {
  try {
    localStorage.setItem(storageKey(key), new Date().toISOString());
  } catch {
    return;
  }
  window.dispatchEvent(new Event(EVENT));
}
