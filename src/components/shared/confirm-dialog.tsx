"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Custom confirmation dialog — a styled replacement for the native `confirm()`.
 *
 * Controlled-friendly but also usable imperatively: pass `open`/`onOpenChange`
 * to drive it yourself, or use the `trigger` element to open it. `onConfirm`
 * may be async; the confirm button shows a busy state until it resolves and the
 * dialog closes automatically on success.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  trigger,
  title = "Та итгэлтэй байна уу?",
  description,
  confirmLabel = "Тийм",
  cancelLabel = "Болих",
  destructive = false,
  onConfirm,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
  title?: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const isOpen = open ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={busy ? undefined : setOpen}>
      {trigger}
      {/* `alertdialog` нь `dialog`-оос ялгаатай: дэлгэц уншигч нээгдэх
          мөчид агуулгыг нь ШУУД уншина, учир нь энэ бол хариу шаардсан
          тасалдал (WAI-ARIA APG). Устгах/цуцлах асуултууд яг тийм.
          `aria-describedby`-г Radix `DialogDescription`-оос өөрөө холбоно. */}
      <DialogContent role="alertdialog" className="max-w-sm gap-3">
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
        <div className="mt-2 flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="secondary" disabled={busy}>
              {cancelLabel}
            </Button>
          </DialogClose>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={busy}
            onClick={handleConfirm}
          >
            {busy ? "Түр хүлээнэ үү…" : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export interface ConfirmOptions {
  title: string;
  description?: React.ReactNode;
  /** Confirm button text. Defaults to "Тийм". */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Paints the confirm button red — use for deletes. */
  destructive?: boolean;
  /**
   * Баталгаажуулсны дараах ажил. Өгвөл цонх ажил ДУУСТАЛ нээлттэй үлдэж,
   * товч нь loader харуулна — эс бөгөөс цонх шууд хаагдаад хэрэглэгч хуучин
   * төлвийг хэсэг харж, юу ч болоогүй мэт санагддаг (захиалга цуцлах).
   * Амжилтгүй болсон ч цонх хаагдана; алдааг дуудагч тал өөрөө харуулна.
   */
  action?: () => Promise<void>;
}

/**
 * Promise-based replacement for `window.confirm`, so destructive admin actions
 * ask in our own themed dialog instead of the browser's chrome.
 *
 *   const [confirm, confirmDialog] = useConfirm();
 *   if (!(await confirm({ title: "Устгах уу?", destructive: true })) return;
 *   …
 *   return (<>{confirmDialog}<Button onClick={remove}/></>);
 */
export function useConfirm(): [
  (options: ConfirmOptions) => Promise<boolean>,
  React.ReactNode,
] {
  const [state, setState] = React.useState<ConfirmOptions | null>(null);
  const [busy, setBusy] = React.useState(false);
  // Held in a ref so resolving doesn't depend on a re-render landing first.
  const resolver = React.useRef<((ok: boolean) => void) | null>(null);

  const confirm = React.useCallback((options: ConfirmOptions) => {
    setState(options);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = React.useCallback((ok: boolean) => {
    setState(null);
    resolver.current?.(ok);
    resolver.current = null;
  }, []);

  async function accept() {
    const action = state?.action;
    if (!action) return settle(true);
    setBusy(true);
    try {
      await action();
    } catch {
      // Дуудагч тал алдаагаа өөрөө харуулна — энд зөвхөн цонхыг хаана.
    } finally {
      setBusy(false);
      settle(true);
    }
  }

  const dialog = (
    <Dialog
      open={state !== null}
      // Covers Escape, the X and outside clicks — all mean "cancel". Ажил
      // явж байхад хаагдахгүй: хагас хийгдсэн үйлдлийг «болих» гэж ойлгоно.
      onOpenChange={(open) => {
        if (!open && !busy) settle(false);
      }}
    >
      <DialogContent role="alertdialog">
        <DialogTitle>{state?.title}</DialogTitle>
        {state?.description && (
          <DialogDescription>{state.description}</DialogDescription>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => settle(false)}
            disabled={busy}
          >
            {state?.cancelLabel ?? "Болих"}
          </Button>
          <Button
            variant={state?.destructive ? "destructive" : "default"}
            onClick={accept}
            disabled={busy}
            aria-busy={busy}
          >
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            {state?.confirmLabel ?? "Тийм"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return [confirm, dialog];
}
