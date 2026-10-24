"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PackageCheck, Undo2 } from "lucide-react";
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
 * Админы дотоод тэмдэглэл (0145) — хэрэглэгчид харагдахгүй. «Чатаар хороогоо
 * зассан», «өөр дугаар дээр хүлээж авна» гэх мэт.
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
  const [note, setNote] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);
  const dirty = note.trim() !== initial.trim();

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
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <textarea
        aria-label="Админы тэмдэглэл"
        rows={3}
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
            : "Зөвхөн ажилтанд харагдана."}
        </p>
        <LoadingButton
          loading={busy}
          size="sm"
          onClick={save}
          disabled={!dirty}
        >
          Хадгалах
        </LoadingButton>
      </div>
    </div>
  );
}
