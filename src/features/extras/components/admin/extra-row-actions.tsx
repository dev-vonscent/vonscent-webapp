"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  Copy,
  Eye,
  EyeOff,
  MoreHorizontal,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { adminFetch, mutateJson } from "@/features/admin/lib/mutate";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { AdminExtra } from "../../types";
import { draftOf, toSavePayload } from "./extra-draft";

/**
 * Мөрийн үйлдэл: засах, нийтлэх/нуух, хуулбарлах, архивлах (plan §7.1).
 * Утсан дээр картын доор бүтэн өргөнөөр (`block`).
 */
export function ExtraRowActions({
  extra,
  variant = "icon",
}: {
  extra: AdminExtra;
  variant?: "icon" | "block";
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [confirm, confirmDialog] = useConfirm();
  const published = extra.status === "published";
  const leftover = extra.mode === "leftover_liquid";

  async function setStatus(status: "draft" | "published" | "archived") {
    setBusy(true);
    const ok = await mutateJson(
      `/api/admin/extras/${extra.id}/status`,
      "POST",
      { status },
      status === "published" ? "Нийтэлж чадсангүй" : "Төлөв сольж чадсангүй",
    );
    setBusy(false);
    if (ok) {
      toast.success(
        status === "published"
          ? "Дэлгүүрт нийтэллээ"
          : status === "archived"
            ? "Архивлалаа"
            : "Дэлгүүрээс нууглаа",
      );
      router.refresh();
    }
  }

  async function duplicate() {
    setBusy(true);
    const draft = draftOf(extra);
    // Хуулбар нь ноорог, тоогүй — нөөцийг шинэ хувилбарт тусад нь оруулна.
    const payload = toSavePayload({
      ...draft,
      name: `${draft.name} (хуулбар)`,
      variants: draft.variants.map((v) => ({
        ...v,
        id: undefined,
        initialQty: 0,
      })),
    });
    const res = await adminFetch<{ id: string }>("/api/admin/extras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: extra.categoryId, extra: payload }),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error, "Хуулбарлаж чадсангүй");
      return;
    }
    toast.success("Хуулбар үүслээ — ноорог хэлбэрээр");
    router.push(`/admin/extras/${res.data.id}`);
  }

  async function archive() {
    const ok = await confirm({
      title: "Архивлах уу?",
      description:
        "Дэлгүүрээс бүрмөсөн нуугдана. Захиалгын түүхэнд хэвээр үлдэнэ.",
      confirmLabel: "Архивлах",
      destructive: true,
    });
    if (ok) await setStatus("archived");
  }

  return (
    <>
      {confirmDialog}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size={variant === "block" ? "default" : "icon"}
            className={cn(variant === "block" && "w-full")}
            disabled={busy}
            aria-label={`${extra.name} — үйлдэл`}
          >
            <MoreHorizontal className="size-4" />
            {variant === "block" && "Үйлдэл"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/admin/extras/${extra.id}`}>
              <Pencil className="size-4" /> Засах
            </Link>
          </DropdownMenuItem>
          {published ? (
            <DropdownMenuItem onSelect={() => setStatus("draft")}>
              <EyeOff className="size-4" /> Дэлгүүрээс нуух
            </DropdownMenuItem>
          ) : (
            extra.status !== "archived" && (
              <DropdownMenuItem
                // Шилийг нийтлэх нь эх үнэртний ml-ийг түгжинэ — мэдээллийн
                // цонхтой засварын хуудаснаас л (plan §7.2).
                onSelect={() =>
                  leftover
                    ? router.push(`/admin/extras/${extra.id}`)
                    : setStatus("published")
                }
              >
                <Eye className="size-4" /> Нийтлэх
              </DropdownMenuItem>
            )
          )}
          {!leftover && (
            <DropdownMenuItem onSelect={duplicate}>
              <Copy className="size-4" /> Хуулбарлах
            </DropdownMenuItem>
          )}
          {extra.status !== "archived" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={archive} className="text-destructive">
                <Archive className="size-4" /> Архивлах
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
