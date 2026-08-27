"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DigitInput } from "@/components/ui/digit-input";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { toast } from "@/lib/toast";

/** 4 оронтой нэвтрэх кодоо солих dialog (мобайлд bottom sheet). */
export function PasscodeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const currentRef = React.useRef<HTMLInputElement>(null);
  const nextRef = React.useRef<HTMLInputElement>(null);
  const confirmRef = React.useRef<HTMLInputElement>(null);

  // Дахин нээхэд өмнөх оролдлого үлдэхгүй.
  React.useEffect(() => {
    if (!open) return;
    setCurrent("");
    setNext("");
    setConfirm("");
    // Dialog нээгдэх animation дуустал Radix focus-оо өөр дээрээ авдаг тул
    // эхний нүдэнд буцааж өгнө — login/register шиг caret шууд анивчина.
    const t = setTimeout(() => currentRef.current?.focus(), 220);
    return () => clearTimeout(t);
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      toast.error("Шинэ кодууд хоорондоо таарахгүй байна.");
      setConfirm("");
      confirmRef.current?.focus();
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/phone/change-passcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current, next }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        minutes?: number;
      } | null;
      if (res.ok) {
        toast.success("Нэвтрэх код солигдлоо.");
        onOpenChange(false);
      } else if (data?.error === "WRONG_PASSCODE") {
        toast.error("Одоогийн код буруу байна.");
        setCurrent("");
      } else if (data?.error === "LOCKED") {
        toast.error(
          `Олон удаа буруу оруулсан тул ${data.minutes ?? 15} минут түгжигдлээ.`,
        );
      } else {
        toast.error("Алдаа гарлаа. Дахин оролдоно уу.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Нэвтрэх код солих"
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-muted-foreground block text-center text-xs tracking-widest uppercase">
            Одоогийн код
          </Label>
          <DigitInput
            ref={currentRef}
            length={4}
            mask
            value={current}
            onChange={setCurrent}
            label="Одоогийн код"
            autoFocus
            disabled={busy}
            className="mx-auto w-fit"
            cellClassName="size-12 max-w-none flex-none"
            onComplete={() => nextRef.current?.focus()}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-muted-foreground block text-center text-xs tracking-widest uppercase">
            Шинэ код
          </Label>
          <DigitInput
            ref={nextRef}
            length={4}
            mask
            value={next}
            onChange={setNext}
            label="Шинэ код"
            disabled={busy}
            className="mx-auto w-fit"
            cellClassName="size-12 max-w-none flex-none"
            onComplete={() => confirmRef.current?.focus()}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-muted-foreground block text-center text-xs tracking-widest uppercase">
            Шинэ код давтах
          </Label>
          <DigitInput
            ref={confirmRef}
            length={4}
            mask
            value={confirm}
            onChange={setConfirm}
            label="Шинэ код давтах"
            disabled={busy}
            className="mx-auto w-fit"
            cellClassName="size-12 max-w-none flex-none"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Болих
          </Button>
          <Button
            type="submit"
            disabled={
              busy ||
              current.length !== 4 ||
              next.length !== 4 ||
              confirm.length !== 4
            }
          >
            {busy ? "Солиж байна…" : "Солих"}
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
