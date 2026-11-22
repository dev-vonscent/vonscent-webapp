"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PackageCheck, StickyNote, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { cn } from "@/lib/utils";
import { LoadingButton } from "@/components/shared/loading-button";
import { mutateJson } from "@/features/admin/lib/mutate";
import { toast } from "@/lib/toast";
import { formatDateTime } from "@/lib/format";
import { PREPARABLE_ORDER_STATUSES, type OrderStatus } from "@/lib/constants";

/**
 * «Бэлдсэн» — захиалгын дотроос (клиент, 2026-10). Жагсаалтын checkbox-оор
 * тэмдэглэхэд мөр андуурах эрсдэлтэй байсан: бэлдэж байгаа захиалгынхаа
 * хуудсан дээрээс шууд тэмдэглэнэ. Жагсаалттай ижил API.
 */
export function OrderPreparedButton({
  orderId,
  orderNo,
  status,
  preparedAt,
}: {
  orderId: string;
  orderNo: string;
  status: OrderStatus;
  preparedAt: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const editable = (
    PREPARABLE_ORDER_STATUSES as readonly OrderStatus[]
  ).includes(status);
  if (!editable && !preparedAt) return null;

  async function set(prepared: boolean) {
    setBusy(true);
    const ok = await mutateJson(
      `/api/admin/orders/${orderId}/prepared`,
      "POST",
      { prepared },
      "Бэлдсэн төлөв солигдсонгүй",
    );
    setBusy(false);
    if (!ok) return;
    toast.success(
      prepared
        ? `${orderNo} захиалгыг бэлдсэн гэж тэмдэглэлээ.`
        : `${orderNo} захиалгыг бэлдэгдээгүй болгож буцаалаа.`,
    );
    router.refresh();
  }

  if (preparedAt) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-success flex items-center gap-1.5 text-sm font-medium">
          <PackageCheck className="size-4" />
          Бэлдсэн · {formatDateTime(preparedAt)}
        </p>
        {editable && (
          <LoadingButton
            loading={busy}
            variant="ghost"
            size="sm"
            onClick={() => set(false)}
          >
            <Undo2 className="size-4" /> Буцаах
          </LoadingButton>
        )}
      </div>
    );
  }
  return (
    <LoadingButton loading={busy} className="w-full" onClick={() => set(true)}>
      <PackageCheck className="size-4" /> Бэлдсэн гэж тэмдэглэх
    </LoadingButton>
  );
}

/**
 * «Админы тэмдэглэл» (task 13) — хуудсан дотор биш, dialog-д. Trigger нь
 * дэлгэцийн баруун доод буланд ТОГТМОЛ (mobile, desktop аль алинд) тул урт
 * захиалгыг гүйлгэж явахад ч гарын дор байна. Тэмдэглэлтэй үед товч нь
 * дүүрэн өнгөтэй + цэгтэй, тэмдэглэлгүй үед хүрээтэй — нээхгүйгээр мэдэгдэнэ.
 */
export function OrderAdminNote({
  orderId,
  initial,
  updatedAt,
}: {
  orderId: string;
  initial: string;
  updatedAt: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [note, setNote] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);
  const dirty = note.trim() !== initial.trim();
  const hasNote = initial.trim() !== "";

  // Сервер шинэ утга өгөхөд (router.refresh) — хаалттай үед л ноорог солино.
  const [prevInitial, setPrevInitial] = React.useState(initial);
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    if (!open) setNote(initial);
  }

  function onOpenChange(next: boolean) {
    // Хадгалаагүй ноорог хаахад алга болно — дараа нээхэд хадгалсан утга.
    if (!next) setNote(initial);
    setOpen(next);
  }

  async function save() {
    setBusy(true);
    const ok = await mutateJson(
      `/api/admin/orders/${orderId}/note`,
      "PUT",
      { note },
      "Тэмдэглэл хадгалагдсангүй",
    );
    setBusy(false);
    if (!ok) return;
    toast.success(
      note.trim() ? "Тэмдэглэл хадгалагдлаа." : "Тэмдэглэл устлаа.",
    );
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button
        type="button"
        variant={hasNote ? "default" : "outline"}
        onClick={() => setOpen(true)}
        aria-label={
          hasNote ? "Админы тэмдэглэл (тэмдэглэлтэй)" : "Админы тэмдэглэл"
        }
        className={cn(
          "fixed right-4 z-40 h-12 rounded-full px-4 shadow-lg",
          "bottom-[max(1rem,env(safe-area-inset-bottom))] lg:right-8",
          !hasNote && "bg-background",
        )}
      >
        <span className="relative">
          <StickyNote className="size-5" />
          {hasNote && (
            <span
              aria-hidden
              className="bg-destructive ring-primary absolute -top-1 -right-1 size-2.5 rounded-full ring-2"
            />
          )}
        </span>
        Тэмдэглэл
      </Button>

      <ResponsiveDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Админы тэмдэглэл"
        description="Зөвхөн ажилтанд харагдана."
      >
        <div className="space-y-2">
          <textarea
            aria-label="Админы тэмдэглэл"
            rows={5}
            maxLength={2000}
            value={note}
            placeholder="Ж: Чатаар хороогоо 3-р хороо гэж зассан. 99xxxxxx дугаараар хүлээж авна."
            onChange={(e) => setNote(e.target.value)}
            className="bg-secondary field-edge flex w-full rounded-md px-3 py-2 text-base md:text-sm"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-muted-foreground text-xs">
              {updatedAt
                ? `Сүүлд засварласан: ${formatDateTime(updatedAt)}`
                : "Тэмдэглэл хараахан байхгүй."}
            </p>
            <LoadingButton loading={busy} onClick={save} disabled={!dirty}>
              Хадгалах
            </LoadingButton>
          </div>
        </div>
      </ResponsiveDialog>
    </>
  );
}
