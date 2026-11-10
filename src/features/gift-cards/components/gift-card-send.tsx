"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingButton } from "@/components/shared/loading-button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { FieldError, fieldErrorProps } from "@/components/ui/form-field";
import { rateLimitMessage } from "@/lib/rate-limit-client";
import { toast } from "@/lib/toast";
import { GENERIC_ERROR } from "../messages";

/**
 * Картаа имэйлээр илгээх / дахин илгээх / буруу хаягаа засах
 * (gift-cards-plan §2.2). Ашиглагдаагүй картад л харагдана.
 */
export function GiftCardSendButton({
  cardId,
  currentEmail,
  sent,
  size,
}: {
  cardId: string;
  currentEmail: string | null;
  sent: boolean;
  /** Жагсаалтын товчнуудын мөрөнд `sm`. */
  size?: "sm";
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState(currentEmail ?? "");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      const res = await fetch(`/api/gift-cards/cards/${cardId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const limited = await rateLimitMessage(res);
      if (limited) {
        setError(limited);
        return;
      }
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        email?: string;
        message?: string;
      } | null;
      if (!res.ok || !data?.ok) {
        setError(data?.message ?? GENERIC_ERROR);
        return;
      }
      setOpen(false);
      toast.success(`${data.email} руу илгээлээ.`, "Бэлгийн карт илгээгдлээ");
      router.refresh();
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size={size}
        className={size ? undefined : "w-full"}
        onClick={() => setOpen(true)}
      >
        <Mail className="size-4" aria-hidden="true" />
        {size ? "Имэйл" : sent ? "Дахин илгээх" : "Имэйлээр илгээх"}
      </Button>
      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title={sent ? "Дахин илгээх" : "Имэйлээр илгээх"}
        description="Код, заавар, QR бүхий имэйл хүлээн авагч руу очно."
      >
        <form onSubmit={onSubmit} noValidate className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="gift-send-email">Хүлээн авагчийн имэйл</Label>
            <Input
              type="email"
              inputMode="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="saraa@gmail.com"
              {...fieldErrorProps("gift-send-email", error)}
            />
            <FieldError id="gift-send-email" message={error} />
          </div>
          <LoadingButton type="submit" loading={pending} className="w-full">
            Илгээх
          </LoadingButton>
        </form>
      </ResponsiveDialog>
    </>
  );
}
