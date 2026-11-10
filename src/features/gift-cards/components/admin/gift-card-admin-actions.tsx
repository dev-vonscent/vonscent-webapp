"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingButton } from "@/components/shared/loading-button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { mutateJson } from "@/features/admin/lib/mutate";
import { toast } from "@/lib/toast";

/**
 * Админ: дахин илгээх / имэйл засах. Хугацаа сунгахгүй (§12-Q8) — хүлээн
 * авагчид 30 / 7 хоногийн өмнө сануулга очдог.
 */
export function GiftCardAdminActions({
  cardId,
  status,
  recipientEmail,
}: {
  cardId: string;
  status: string;
  recipientEmail: string | null;
}) {
  const router = useRouter();
  const [dialog, setDialog] = React.useState<"resend" | null>(null);
  const [email, setEmail] = React.useState(recipientEmail ?? "");
  const [pending, setPending] = React.useState(false);

  const canResend = status === "active";

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

  if (!canResend) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {canResend && (
        <Button variant="secondary" onClick={() => setDialog("resend")}>
          <Mail className="size-4" aria-hidden="true" /> Дахин илгээх
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

    </div>
  );
}
