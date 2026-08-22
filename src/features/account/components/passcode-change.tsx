"use client";

import * as React from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Change the 4-digit login passcode from the profile page. */
export function PasscodeChange() {
  const [open, setOpen] = React.useState(false);
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(
    null,
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!/^\d{4}$/.test(next)) {
      setMsg({ ok: false, text: "Шинэ код 4 оронтой тоо байх ёстой." });
      return;
    }
    if (next !== confirm) {
      setMsg({ ok: false, text: "Шинэ кодууд хоорондоо таарахгүй байна." });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/phone/change-passcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current, next }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setMsg({ ok: true, text: "Нэвтрэх код солигдлоо." });
        setCurrent("");
        setNext("");
        setConfirm("");
      } else if (data?.error === "WRONG_PASSCODE") {
        setMsg({ ok: false, text: "Одоогийн код буруу байна." });
      } else if (data?.error === "LOCKED") {
        setMsg({
          ok: false,
          text: `Олон удаа буруу оруулсан тул ${data.minutes ?? 15} минут түгжигдлээ.`,
        });
      } else {
        setMsg({ ok: false, text: "Алдаа гарлаа. Дахин оролдоно уу." });
      }
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="hover:text-primary flex items-center gap-2 text-sm"
      >
        <KeyRound className="size-4" /> Нэвтрэх код солих
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="flex items-center gap-2 text-sm font-medium">
        <KeyRound className="size-4" /> Нэвтрэх код солих
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs">Одоогийн код</Label>
          <Input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={current}
            onChange={(e) => setCurrent(e.target.value.replace(/\D/g, ""))}
            required
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Шинэ код (4 орон)</Label>
          <Input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={next}
            onChange={(e) => setNext(e.target.value.replace(/\D/g, ""))}
            required
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Шинэ код давтах</Label>
          <Input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ""))}
            required
          />
        </div>
      </div>
      {msg && (
        <p
          className={`text-sm ${msg.ok ? "text-success" : "text-destructive"}`}
        >
          {msg.text}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Солиж байна…" : "Солих"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
        >
          Болих
        </Button>
      </div>
    </form>
  );
}
