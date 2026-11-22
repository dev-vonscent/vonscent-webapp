"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { LoadingButton } from "@/components/shared/loading-button";
import { adminFetch } from "@/features/admin/lib/mutate";
import { formatPrice } from "@/lib/format";
import { toast } from "@/lib/toast";
import { READINESS_MESSAGE } from "../../messages";
import type { AdminExtra } from "../../types";

const STATUS_LABEL: Record<AdminExtra["status"], string> = {
  draft: "Ноорог — дэлгүүрт харагдахгүй",
  published: "Нийтэлсэн — дэлгүүрт харагдаж байна",
  archived: "Архивласан",
};

/**
 * Төлөв ба «Нийтлэх» (plan §7.2). Товч идэвхжихээс өмнө юу дутуу байгааг
 * доор нь жагсаана. Хадгалаагүй өөрчлөлттэй бол эхлээд хадгална.
 * Үлдэгдэлтэй шил нь эх үнэртний ml-ийг түгжих тул нийтлэхээс өмнө
 * «Нийтлэх мэдээлэл» цонхоор баталгаажуулна.
 */
export function ExtraPublishPanel({
  extra,
  dirty,
  missing,
  saving,
  onSave,
}: {
  extra: AdminExtra | null;
  dirty: boolean;
  /** Маягтаас тооцсон дутуу зүйл. */
  missing: string[];
  saving: boolean;
  onSave: () => Promise<string | null>;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const published = extra?.status === "published";
  // Хадгалсан хувилбарын дутууг сервер хэлнэ (тоо оруулаагүй сав, туг г.м.);
  // маягтын дутуу нь хадгалаагүй өөрчлөлтийг хамарна.
  const serverMissing = dirty
    ? []
    : (extra?.readiness ?? []).map((c) => READINESS_MESSAGE[c]);
  const all = [...new Set([...missing, ...serverMissing])];
  const leftover = extra?.mode === "leftover_liquid" ? extra.leftover : null;
  const leftoverPrice =
    extra?.mode === "leftover_liquid" ? extra.variants[0]?.price : undefined;

  async function setStatus(status: "draft" | "published") {
    setBusy(true);
    if (dirty) {
      const id = await onSave();
      if (!id) {
        setBusy(false);
        return;
      }
    }
    const res = await adminFetch(`/api/admin/extras/${extra!.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusy(false);
    setConfirming(false);
    if (!res.ok) {
      toast.error(
        res.error,
        status === "published" ? "Нийтэлж чадсангүй" : "Нууж чадсангүй",
      );
      return;
    }
    toast.success(
      status === "published" ? "Дэлгүүрт нийтэллээ" : "Дэлгүүрээс нууглаа",
    );
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-6">
        <div className="space-y-1">
          <h2 className="text-muted-foreground text-xs font-medium tracking-[0.15em] uppercase">
            Төлөв
          </h2>
          <Badge variant={published ? "new" : "secondary"}>
            {extra ? STATUS_LABEL[extra.status] : "Шинэ — хадгалаагүй"}
          </Badge>
        </div>

        {!extra ? (
          <p className="text-muted-foreground text-sm">
            Хадгалсны дараа нийтлэх боломжтой. Бараа ноорог хэлбэрээр үүснэ.
          </p>
        ) : published ? (
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled={busy || saving}
            onClick={() => void setStatus("draft")}
          >
            <EyeOff className="size-4" aria-hidden />
            Дэлгүүрээс нуух
          </Button>
        ) : (
          <div className="space-y-2">
            <LoadingButton
              type="button"
              className="w-full"
              loading={busy}
              disabled={all.length > 0 || saving || (leftover != null && dirty)}
              onClick={() =>
                leftover ? setConfirming(true) : void setStatus("published")
              }
            >
              {dirty && !leftover ? "Хадгалаад нийтлэх" : "Нийтлэх"}
            </LoadingButton>
            {/* Шилний мэдээллийн цонх нь ХАДГАЛСАН ml-ийг харуулна — түгжих
                хэмжээ нь яг тэр. */}
            {leftover != null && dirty && (
              <p className="text-muted-foreground text-sm">
                Эхлээд өөрчлөлтөө хадгална уу.
              </p>
            )}
            {all.length > 0 && (
              <ul className="space-y-1 text-sm" aria-label="Нийтлэхэд дутуу">
                {all.map((m) => (
                  <li key={m} className="text-muted-foreground flex gap-2">
                    <CircleAlert
                      className="text-gold-strong mt-0.5 size-4 shrink-0"
                      aria-hidden
                    />
                    {m}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>

      {leftover && (
        <ResponsiveDialog
          open={confirming}
          onOpenChange={busy ? () => {} : setConfirming}
          title="Нийтлэх мэдээлэл"
        >
          <ul className="space-y-1.5 text-sm">
            <li>
              • {leftover.productBrand} {leftover.productName}
            </li>
            <li className="tabular-nums">
              • {leftover.remainingMl} / {leftover.fullMl}ml
            </li>
            <li>• Нөөцөөс {leftover.remainingMl}ml түгжинэ</li>
            <li>• 1 ширхэг</li>
            {leftoverPrice != null && (
              <li className="tabular-nums">• {formatPrice(leftoverPrice)}</li>
            )}
          </ul>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              Болих
            </Button>
            <LoadingButton
              type="button"
              loading={busy}
              onClick={() => void setStatus("published")}
            >
              Нийтлэх
            </LoadingButton>
          </div>
        </ResponsiveDialog>
      )}
    </Card>
  );
}
