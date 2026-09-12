"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useIsStaff } from "@/features/auth/use-is-staff";

export function DeleteReviewButton({
  reviewId,
  onDeleted,
}: {
  reviewId: string;
  /** Drop the card from the list immediately; the refresh reconciles counts. */
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  // Only the admin deletes reviews (client decision, questions.md №22).
  // The role is resolved in the browser (once per tab, see the hook) so the
  // product page can stay statically cached; the API enforces the same rule.
  const staff = useIsStaff();

  if (!staff) return null;

  async function remove() {
    const res = await fetch(`/api/reviews?id=${reviewId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      onDeleted?.();
      router.refresh();
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-destructive transition-colors"
        aria-label="Сэтгэгдэл устгах"
      >
        <Trash2 className="size-3.5" />
      </button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Сэтгэгдлийг устгах уу?"
        description="Энэ хэрэглэгчийн сэтгэгдэл бүрмөсөн устах бөгөөд буцаах боломжгүй."
        confirmLabel="Устгах"
        destructive
        onConfirm={remove}
      />
    </>
  );
}
