"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useConfirm } from "@/components/shared/confirm-dialog";

/**
 * Drawer-ийн панел — Base UI popup-ууд (combobox) `<body>` биш энд portal
 * хийх ёстой. Radix modal фокусыг панел дотор түгждэг тул `<body>`-д гарсан
 * хайлтын талбар фокус авч чадахгүй, бичихэд юу ч болохгүй байв.
 */
export const DrawerPortalContext = React.createContext<HTMLElement | null>(
  null,
);

/**
 * Админы засах/үүсгэх маягтын drawer: баруун талаас (утсан дээр дэлгэц
 * дүүрэн), доор нь үргэлж харагдах «Болих» + үйлдлийн товч.
 *
 * Хадгалаагүй өөрчлөлттэй хаах гэвэл (Болих, X, Escape, гадна дарах) нэг л
 * удаа асууна. Энэ «нэг л удаа» нь хэд хэдэн алдаанаас үүссэн:
 *   · Radix confirm нээгдэх/хаагдах үеийн фокусын шилжилтийг «гадна» гэж
 *     мэдэгддэг — фокус гарах нь хаах хүсэлт биш;
 *   · confirm болон portal-оор гарсан popup (combobox, select) доторх
 *     даралтыг Sheet-ийн гадна гэж үздэг (confirm-ийнхийг click дууссаны
 *     ДАРАА) — тиймээс зөвхөн Sheet-ийн өөрийн backdrop дээрх даралт хаана;
 *   · эдгээр дуудлага хуучин closure-оор ирдэг тул төлвийг ref-ээс уншина.
 *
 * Нээх нь эцэг компонентын `open`; хаах хүсэлт бүр энд шалгагдаад зөвшөөрвөл
 * `onClose`. Амжилттай хадгалсны дараа эцэг нь `open`-оо шууд false болгоно.
 */
export function FormDrawer({
  open,
  dirty,
  onClose,
  title,
  description,
  footer,
  discardDescription = "Энд хийсэн өөрчлөлт тань хадгалагдахгүй.",
  children,
}: {
  open: boolean;
  /** Хадгалаагүй өөрчлөлт байгаа эсэх — хаахын өмнө асуух эсэхийг шийднэ. */
  dirty: boolean;
  /** Хаах нь зөвшөөрөгдсөн: төлвөө буцааж, `open`-оо false болго. */
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  /** «Болих»-ийн хажууд — ихэвчлэн хадгалах товч. */
  footer: React.ReactNode;
  /** «Хадгалахгүй гарах уу?» асуултын тайлбар. */
  discardDescription?: string;
  children: React.ReactNode;
}) {
  const [confirm, confirmDialog] = useConfirm();
  const openRef = React.useRef(open);
  const dirtyRef = React.useRef(dirty);
  const askingRef = React.useRef(false);
  const contentRef = React.useRef<HTMLDivElement>(null);
  // State as well as the ref: popups need a re-render once the panel mounts.
  const [panel, setPanel] = React.useState<HTMLDivElement | null>(null);
  const setContent = React.useCallback((el: HTMLDivElement | null) => {
    contentRef.current = el;
    setPanel(el);
  }, []);
  // Layout effect: the next keypress or click must already see this render.
  React.useLayoutEffect(() => {
    openRef.current = open;
    dirtyRef.current = dirty;
  }, [open, dirty]);

  function close() {
    openRef.current = false;
    onClose();
  }

  async function requestClose() {
    if (!openRef.current || askingRef.current) return;
    if (!dirtyRef.current) return close();
    askingRef.current = true;
    try {
      const discard = await confirm({
        title: "Өөрчлөлтөө хадгалахгүй гарах уу?",
        description: discardDescription,
        confirmLabel: "Хадгалахгүй гарах",
        destructive: true,
      });
      if (discard) close();
    } finally {
      askingRef.current = false;
    }
  }

  return (
    <>
      {confirmDialog}
      <Sheet open={open} onOpenChange={(next) => !next && requestClose()}>
        <SheetContent
          side="right"
          className="w-full max-w-none gap-0 p-0 sm:max-w-xl"
          ref={setContent}
          onFocusOutside={(e) => e.preventDefault()}
          // Only a press on the Sheet's own backdrop means "close". Anything
          // else outside the panel is a layer above it — the confirm, or a
          // combobox/select popup portalled to <body> — and Radix reports
          // those as outside too (the confirm's, after its click is over).
          onPointerDownOutside={(e) => {
            const backdrop = contentRef.current?.previousElementSibling;
            if (askingRef.current || e.target !== backdrop) e.preventDefault();
          }}
          // Escape inside a portalled popup closes that popup, not the form.
          // Base UI has already closed it and moved focus back to its trigger
          // by the time Radix sees the key, so focus alone can't tell — the
          // trigger's `aria-expanded` (DOM not yet re-rendered) still can.
          onEscapeKeyDown={(e) => {
            const content = contentRef.current;
            const active = document.activeElement;
            const focusOutside =
              active && active !== document.body && !content?.contains(active);
            if (
              focusOutside ||
              content?.querySelector('[aria-expanded="true"]')
            )
              e.preventDefault();
          }}
        >
          <SheetHeader className="p-6 pb-4">
            <SheetTitle>{title}</SheetTitle>
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <DrawerPortalContext.Provider value={panel}>
              {children}
            </DrawerPortalContext.Provider>
          </div>

          <div className="bg-muted/40 flex justify-end gap-2 px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button type="button" variant="ghost" onClick={requestClose}>
              Болих
            </Button>
            {footer}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
