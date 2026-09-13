"use client";

import * as React from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SignOutForm } from "@/features/account/components/sign-out-form";

/**
 * «Гарах» товчийг санамсаргүй товшилтоос хамгаална.
 *
 * Утсан дээр гарах товч нь цэсний ирмэг дээр байдаг тул хуруу зөрөхөд л
 * хэрэглэгч сессээсээ унадаг байв. Тиймээс товшилт нь шууд илгээхийн оронд
 * баталгаажуулах цонх нээж, «Гарах» дарсан үед л формыг илгээнэ.
 *
 *   const [askSignOut, signOutDialog] = useSignOutConfirm();
 *   return (<>{signOutDialog}<button onClick={askSignOut}>Гарах</button></>);
 *
 * Буцаах `node` нь нуугдмал формыг хамт зурдаг тул дуудагч талд `SignOutForm`
 * тусад нь хэрэггүй. Цэс/самбарын (Radix portal) ГАДНА зурах ёстой — эс тэгвэл
 * товшилтод цэс хаагдахад форм ч DOM-оос алга болно.
 */
export function useSignOutConfirm(): [() => void, React.ReactNode] {
  const formRef = React.useRef<HTMLFormElement>(null);
  const [open, setOpen] = React.useState(false);

  const ask = React.useCallback(() => setOpen(true), []);

  const node = (
    <>
      <SignOutForm ref={formRef} />
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Гарах уу?"
        description="Та бүртгэлээсээ гарна. Дахин нэвтрэх шаардлагатай болно."
        confirmLabel="Гарах"
        cancelLabel="Болих"
        destructive
        onConfirm={() => {
          formRef.current?.requestSubmit();
        }}
      />
    </>
  );

  return [ask, node];
}
