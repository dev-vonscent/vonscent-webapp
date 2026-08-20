"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { createClient } from "@/lib/supabase/browser";

export function DeleteReviewButton({
  reviewId,
  productId,
  ownerId,
}: {
  reviewId: string;
  productId: string;
  /** The review author — the button renders only for their own session. */
  ownerId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [mine, setMine] = React.useState(false);

  // Ownership is resolved in the browser so the product page can stay
  // statically cached; the API still enforces it server-side on DELETE.
  React.useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    supabase.auth
      .getUser()
      .then(({ data }) => setMine(data.user?.id === ownerId));
  }, [ownerId]);

  if (!mine) return null;

  async function remove() {
    const res = await fetch(
      `/api/reviews?id=${reviewId}&productId=${productId}`,
      { method: "DELETE" },
    );
    if (res.ok) router.refresh();
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
        title="Сэтгэгдлээ устгах уу?"
        description="Энэ үйлдлийг буцаах боломжгүй."
        confirmLabel="Устгах"
        destructive
        onConfirm={remove}
      />
    </>
  );
}
