"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Flag, Power, PowerOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { mutateJson } from "@/features/admin/lib/mutate";
import { formatDateTime } from "@/lib/format";
import { toast } from "@/lib/toast";
import type { FeatureFlagRow } from "@/features/admin/api";

const ENV_LABEL: Record<string, string> = {
  production: "Production",
  preview: "Preview (dev сан)",
  development: "Локал (dev сан)",
};

/**
 * Feature flag-ийн унтраалга (0133). Нэг даралт бүх хэрэглэгчид feature
 * нээдэг тул баталгаажуулах цонхтой, орчныг (prod/dev) тод харуулна.
 */
export function FeatureFlagManager({
  rows,
  migrated,
  canEdit,
  environment,
}: {
  rows: FeatureFlagRow[];
  migrated: boolean;
  canEdit: boolean;
  /** `VERCEL_ENV` — production бол анхааруулга. */
  environment: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<FeatureFlagRow | null>(null);
  const [busy, setBusy] = React.useState(false);
  const isProd = environment === "production";

  async function submit() {
    if (!pending) return;
    setBusy(true);
    try {
      const ok = await mutateJson(
        "/api/admin/feature-flags",
        "PATCH",
        { key: pending.key, enabled: !pending.enabled },
        "Хадгалагдсангүй",
      );
      if (!ok) return;
      toast.success(
        pending.enabled
          ? `«${pending.label}» хаагдлаа.`
          : `«${pending.label}» нээгдлээ.`,
      );
      setPending(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!migrated) {
    return (
      <EmptyState
        title="Feature flag бэлэн болоогүй байна"
        description="0133_feature_flags.sql migration ажиллуулсны дараа энэ хуудас идэвхжинэ."
      />
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Flag}
        title="Одоогоор хүлээгдэж буй feature алга"
        description="Шинэ боломж хөгжүүлэгдэж эхлэхэд энд гарч ирнэ. Нээгдсэн боломжийн туг жагсаалтаас хасагдана."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Орчин:</span>
        <Badge variant={isProd ? "sale" : "secondary"}>
          {ENV_LABEL[environment] ?? environment}
        </Badge>
        {!canEdit && (
          <span className="text-muted-foreground">
            Зөвхөн super admin солих эрхтэй.
          </span>
        )}
      </div>

      {rows.map((row) => (
        <Card key={row.key}>
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{row.label}</p>
                <Badge variant={row.enabled ? "default" : "outline"}>
                  {row.enabled ? "Нээлттэй" : "Хаалттай"}
                </Badge>
              </div>
              <p className="text-muted-foreground font-mono text-xs">
                {row.key}
              </p>
              <p className="text-sm">{row.description}</p>
              {row.updatedAt && (
                <p className="text-muted-foreground text-xs">
                  {formatDateTime(row.updatedAt)}
                  {row.updatedByName ? ` · ${row.updatedByName}` : ""}
                </p>
              )}
            </div>
            {canEdit && (
              <Button
                variant={row.enabled ? "outline" : "default"}
                className="shrink-0"
                onClick={() => setPending(row)}
              >
                {row.enabled ? (
                  <>
                    <PowerOff className="size-4" /> Хаах
                  </>
                ) : (
                  <>
                    <Power className="size-4" /> Нээх
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      ))}

      <ResponsiveDialog
        open={pending != null}
        onOpenChange={(v) => !v && setPending(null)}
        title={
          pending
            ? pending.enabled
              ? `«${pending.label}»-г хаах уу?`
              : `«${pending.label}»-г нээх үү?`
            : ""
        }
        description={
          pending?.enabled
            ? "Хэрэглэгчид энэ боломжийг дахин харахгүй. Өмнө нь үүссэн өгөгдөл хадгалагдсан хэвээр үлдэнэ."
            : isProd
              ? "Энэ бол PRODUCTION — бүх хэрэглэгчид шууд нээгдэнэ."
              : "Зөвхөн энэ (dev) орчинд нээгдэнэ — production-д нөлөөгүй."
        }
      >
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={() => setPending(null)}>
            Болих
          </Button>
          <Button
            variant={pending?.enabled ? "destructive" : "default"}
            disabled={busy}
            onClick={submit}
          >
            {pending?.enabled ? "Хаах" : "Нээх"}
          </Button>
        </div>
      </ResponsiveDialog>
    </div>
  );
}
