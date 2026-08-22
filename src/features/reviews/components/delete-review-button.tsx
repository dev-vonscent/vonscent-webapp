"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { createClient } from "@/lib/supabase/browser";

export function DeleteReviewButton({
  reviewId,
  productId,
}: {
  reviewId: string;
  productId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [staff, setStaff] = React.useState(false);

  // Only the admin deletes reviews (client decision, questions.md №22).
  // The role is resolved in the browser so the product page can stay
  // statically cached; the API enforces the same rule server-side.
  React.useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();
      const role = (profile as { role?: string } | null)?.role;
      setStaff(role === "operator" || role === "super_admin");
    });
  }, []);

  if (!staff) return null;

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
