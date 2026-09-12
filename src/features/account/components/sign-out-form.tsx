import type * as React from "react";

/** Гарах хүсэлт хүлээж авдаг цорын ганц цэг. */
export const SIGN_OUT_ACTION = "/api/auth/sign-out";

/**
 * Гарах товчийг тойрсон форм.
 *
 * Яагаад форм гэж: гарах нь өмнө нь `onClick` дотор
 * `await supabase.auth.signOut()` байсан бөгөөд тэр дуудлага саатвал товч
 * хариугүй хөшиж, хэрэглэгч гарсан эсэхээ ойлгохгүй үлддэг байв. Форм илгээх
 * нь браузарын өөрийнх нь шилжилт — JS гацаад зогсох орон зайгүй, хариу нь
 * 303 redirect тул үргэлж нүүр рүү буудаг (`/api/auth/sign-out`).
 *
 * Хоёр хэрэглээ:
 *   - `children`-тэй: товч нь формын дотор (жирийн байрлал).
 *   - `children`-гүй + `ref`: форм нь нуугдмал, товч нь өөр газраас
 *     `ref.current?.requestSubmit()`-ээр илгээнэ. Цэс/хажуугийн самбар (Radix
 *     portal) дотор товч байхад хэрэгтэй: товшилтод цэс хаагдаж, товч нь DOM-
 *     оос алга болдог тул формын өөрийнх нь байршил цэсний ГАДНА байх ёстой.
 *     `requestSubmit()` нь шууд ажилладаг тул хаагдах дараалалд хамаарахгүй.
 */
export function SignOutForm({
  ref,
  className,
  children,
}: {
  ref?: React.Ref<HTMLFormElement>;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <form
      ref={ref}
      method="post"
      action={SIGN_OUT_ACTION}
      className={className}
      hidden={!children}
    >
      {children}
    </form>
  );
}
