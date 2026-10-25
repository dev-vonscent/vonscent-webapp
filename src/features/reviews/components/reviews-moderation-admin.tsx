"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Stars } from "@/components/shared/stars";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { mutate, mutateJson } from "@/features/admin/lib/mutate";
import { formatDateTime } from "@/lib/format";
import { toast } from "@/lib/toast";
import {
  REVIEW_REJECT_REASONS,
  REVIEW_REJECT_REASON_LABEL,
  type ReviewStatus,
} from "@/lib/constants";
import type { ReviewModerationInput } from "@/lib/validators/review";
import type { AdminReview } from "../types";

const STATUS_BADGE: Record<
  ReviewStatus,
  { label: string; variant: "secondary" | "new" | "sale" }
> = {
  pending: { label: "Шалгах", variant: "secondary" },
  approved: { label: "Батлагдсан", variant: "new" },
  rejected: { label: "Цуцлагдсан", variant: "sale" },
};

function ReviewCard({ review }: { review: AdminReview }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [confirm, confirmDialog] = useConfirm();

  async function moderate(input: ReviewModerationInput, success: string) {
    setBusy(true);
    try {
      const ok = await mutateJson(
        `/api/admin/reviews/${review.id}`,
        "PATCH",
        input,
        "Сэтгэгдэл хадгалагдсангүй",
      );
      if (ok) {
        toast.success(success);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const ok = await confirm({
      title: "Сэтгэгдлийг бүрмөсөн устгах уу?",
      description:
        "Буцаах боломжгүй. Олгосон V point хэрэглэгчид хэвээр үлдэнэ.",
      confirmLabel: "Устгах",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const done = await mutate(
        `/api/reviews?id=${review.id}`,
        { method: "DELETE" },
        "Сэтгэгдэл устсангүй",
      );
      if (done) {
        toast.success("Сэтгэгдэл устлаа.");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  const badge = STATUS_BADGE[review.status];
  const canFeature =
    review.status === "approved" && review.targetHref?.startsWith("/products");

  return (
    <Card>
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-0.5">
            {review.targetHref ? (
              <Link
                href={review.targetHref}
                target="_blank"
                className="font-medium hover:underline"
              >
                {review.targetName}
              </Link>
            ) : (
              <p className="font-medium">{review.targetName}</p>
            )}
            <p className="text-muted-foreground text-xs">
              {review.authorName ?? "Нэргүй"}
              {review.authorPhone && ` · ${review.authorPhone}`} ·{" "}
              {formatDateTime(review.createdAt)}
            </p>
          </div>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>

        <Stars rating={review.rating} size={14} />
        <p className="text-sm/relaxed wrap-break-word whitespace-pre-line">
          {review.body}
        </p>

        {review.status === "rejected" && review.rejectReason && (
          <p className="text-destructive text-xs">
            Шалтгаан: {REVIEW_REJECT_REASON_LABEL[review.rejectReason]}
          </p>
        )}

        <div className="border-border flex flex-wrap items-center gap-2 border-t pt-3">
          {review.status !== "approved" && (
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                moderate({ action: "approve" }, "Сэтгэгдэл батлагдлаа.")
              }
            >
              <Check className="size-4" />
              Батлах
            </Button>
          )}
          {review.status !== "rejected" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="secondary" disabled={busy}>
                  <X className="size-4" />
                  Цуцлах
                  <ChevronDown className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {REVIEW_REJECT_REASONS.map((reason) => (
                  <DropdownMenuItem
                    key={reason}
                    onSelect={() =>
                      moderate(
                        { action: "reject", reason },
                        "Сэтгэгдэл цуцлагдлаа.",
                      )
                    }
                  >
                    {REVIEW_REJECT_REASON_LABEL[reason]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {review.status === "approved" && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={review.isVisible}
                  disabled={busy}
                  onCheckedChange={(v) =>
                    moderate(
                      { action: "visibility", visible: v === true },
                      v === true ? "Сайтад харагдана." : "Сайтаас нуулаа.",
                    )
                  }
                />
                Сайтад харуулах
              </label>
              {canFeature && (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={review.isFeatured}
                    disabled={busy}
                    onCheckedChange={(v) =>
                      moderate(
                        { action: "featured", featured: v === true },
                        v === true
                          ? "Нүүр хуудсанд нэмлээ."
                          : "Нүүр хуудаснаас хаслаа.",
                      )
                    }
                  />
                  Нүүр хуудсанд
                </label>
              )}
            </>
          )}

          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground hover:text-destructive ml-auto"
            disabled={busy}
            onClick={remove}
            aria-label="Сэтгэгдэл устгах"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </CardContent>
      {confirmDialog}
    </Card>
  );
}

/**
 * Админ → Сэтгэгдэл (0162): шалгах, батлах, цуцлах (3 шалтгаанаас),
 * батлагдсаныг нуух / нүүрэнд сонгох, бүрмөсөн устгах. Мэдэгдэл байхгүй —
 * админ өдөрт нэг ороод шалгана (клиент, 2026-10).
 */
export function ReviewsModerationAdmin({ rows }: { rows: AdminReview[] }) {
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <ReviewCard key={r.id} review={r} />
      ))}
    </div>
  );
}
