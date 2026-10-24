import type * as React from "react";

/** Enter нь эдгээр input дээр формыг илгээдэггүй эсвэл өөрийн үүрэгтэй. */
const NON_TEXT = new Set(["submit", "button", "checkbox", "radio", "file"]);

/**
 * Урт админ формд текст талбар дээр Enter дарахад браузер формыг шууд
 * илгээдэг — админ дутуу бөглөсөн барааг санамсаргүй хадгалдаг байв.
 * `<form onKeyDown>`-д өгнө: зөвхөн «Хадгалах» товч хадгална. Өөрийн Enter
 * үйлдэлтэй талбарууд (нот орчуулга, жагсаалтын хайлт) түрүүлж ажилладаг тул
 * хэвээрээ; textarea-д Enter шинэ мөр хэвээр.
 */
export function preventEnterSubmit(e: React.KeyboardEvent<HTMLFormElement>) {
  if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
  const t = e.target;
  if (t instanceof HTMLInputElement && !NON_TEXT.has(t.type)) {
    e.preventDefault();
  }
}
