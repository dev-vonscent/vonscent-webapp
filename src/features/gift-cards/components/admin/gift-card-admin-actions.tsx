"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingButton } from "@/components/shared/loading-button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { DatePicker } from "@/features/admin/components/date-picker";
import { mutateJson } from "@/features/admin/lib/mutate";
import { toast } from "@/lib/toast";
import { ubDayFromNow } from "@/lib/time";

/**
 * Админ: дахин илгээх (ажилтан бүр), хугацаа сунгах (super_admin, шалтгаан
 * заавал — `gift_card_events`-д бичигдэнэ).
 */
export function GiftCardAdminActions({
  cardId,
  status,
  recipientEmail,
  canExtend,
}: {
  cardId: string;
  status: string;
  recipientEmail: string | null;
  canExtend: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = React.useState<"resend" | "extend" | null>(null);
  const [email, setEmail] = React.useState(recipientEmail ?? "");
  const [until, setUntil] = React.useState(ubDayFromNow(90));
  const [reason, setReason] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const canResend = status === "active";
  const extendable = canExtend && (status === "active" || status === "expired");

  async function resend(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const ok = await mutateJson(
      `/api/admin/gift-cards/${cardId}/resend`,
      "POST",
      { email },
      "Илгээж чадсангүй",
    );
    setPending(false);
    if (ok) {
      toast.success(`${email} руу илгээлээ.`);
      setDialog(null);
      router.refresh();
    }
  }

  async function extend(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const ok = await mutateJson(
      `/api/admin/gift-cards/${cardId}/extend`,
      "POST",
      { until, reason },
      "Сунгаж чадсангүй",
    );
    setPending(false);
    if (ok) {
      toast.success("Хугацаа сунгагдлаа.");
      setDialog(null);
      router.refresh();
    }
  }

  if (!canResend && !extendable) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {canResend && (
        <Button variant="secondary" onClick={() => setDialog("resend")}>
          <Mail className="size-4" aria-hidden="true" /> Дахин илгээх
        </Button>
      )}
      {extendable && (
        <Button variant="secondary" onClick={() => setDialog("extend")}>
          <CalendarPlus className="size-4" aria-hidden="true" /> Хугацаа сунгах
        </Button>
      )}

      <ResponsiveDialog
        open={dialog === "resend"}
        onOpenChange={(v) => !v && setDialog(null)}
        title="Дахин илгээх"
        description="Код, заавар, QR бүхий имэйл. Хаяг өөрчлөгдвөл карт дээр хадгалагдана."
      >
        <form onSubmit={resend} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="admin-gift-email">Имэйл</Label>
            <Input
              id="admin-gift-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <LoadingButton type="submit" loading={pending} className="w-full">
            Илгээх
          </LoadingButton>
        </form>
      </ResponsiveDialog>

      <ResponsiveDialog
        open={dialog === "extend"}
        onOpenChange={(v) => !v && setDialog(null)}
        title="Хугацаа сунгах"
        description="Кодыг V point болгох эцсийн өдөр. Хугацаа дууссан карт дахин идэвхжинэ."
      >
        <form onSubmit={extend} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="admin-gift-until">Шинэ хугацаа</Label>
            <DatePicker
              id="admin-gift-until"
              value={until}
              onChange={setUntil}
              min={ubDayFromNow(1)}
              max={ubDayFromNow(730)}
              clearable={false}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-gift-reason">Шалтгаан</Label>
            <Input
              id="admin-gift-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Жишээ нь: хэрэглэгчийн хүсэлтээр"
              maxLength={200}
            />
          </div>
          <LoadingButton
            type="submit"
            loading={pending}
            disabled={reason.trim().length < 3}
            className="w-full"
          >
            Сунгах
          </LoadingButton>
        </form>
      </ResponsiveDialog>
    </div>
  );
}
