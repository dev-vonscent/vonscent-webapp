"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  Eye,
  EyeOff,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Trash2,
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

/**
 * Мөрийн үйлдэл: засах, нийтлэх/нуух, архивлах, устгах
 * (plan §7.1). Устгах нь зөвхөн түүхгүй бараанд (0177) — захиалга, худалдан
 * авалттай бол сервер татгалзаж архивлахыг санал болгоно.
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
  const sold = extra.leftover?.lockState === "committed";

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

  async function remove() {
    const ok = await confirm({
      title: "Бүрмөсөн устгах уу?",
      description:
        "Бараа болон хувилбарууд нь сэргээгдэхгүйгээр устана. Захиалга, нөөцийн худалдан авалт бүртгэгдсэн бол устгах боломжгүй, архивлана уу.",
      confirmLabel: "Устгах",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    const res = await adminFetch(`/api/admin/extras/${extra.id}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error, "Устгаж чадсангүй");
      return;
    }
    toast.success("Устгалаа");
    router.refresh();
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
          {sold && (
            // Ижил үнэртний дараагийн шил: мэдээллийг хуулж шинэ бараа (§18.4).
            <DropdownMenuItem asChild>
              <Link
                href={`/admin/extras/new?cat=${extra.categorySlug}&mode=leftover_liquid&from=${extra.id}`}
              >
                <RefreshCw className="size-4" /> Дахин нийтлэх
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {extra.status !== "archived" && (
            <DropdownMenuItem onSelect={archive} className="text-destructive">
              <Archive className="size-4" /> Архивлах
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={remove} className="text-destructive">
            <Trash2 className="size-4" /> Устгах
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
