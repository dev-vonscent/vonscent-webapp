"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Combine, Loader2 } from "lucide-react";
import { Field } from "@/components/ui/field";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxScroll,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox";
import { LoadingButton } from "@/components/shared/loading-button";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { DataTable } from "@/features/admin/components/data-table";
import { FormDrawer } from "@/features/admin/components/form-drawer";
import { PickerPopup } from "@/features/admin/components/customer-picker";
import { adminFetch } from "@/features/admin/lib/mutate";
import { formatDateTime } from "@/lib/format";
import { toast } from "@/lib/toast";
import type { AdminPerfumeRequest, AdminPerfumeRequestVoter } from "../types";

function titleOf(r: Pick<AdminPerfumeRequest, "brand" | "name">) {
  return `${r.brand} ${r.name}`;
}

/**
 * Админ → Үнэртний санал (0137): хүссэн хүний тоогоор эрэмбэлсэн жагсаалт.
 * Мөр дээр дарахад хэн хүссэн, юу гэж бичсэн нь харагдана; давхардсан
 * бичлэгийг нэгтгэж болно. Төлөв, мэдэгдэл байхгүй (клиент, 2026-10-15).
 */
export function PerfumeRequestsAdmin({
  rows,
}: {
  rows: AdminPerfumeRequest[];
}) {
  const [viewing, setViewing] = React.useState<AdminPerfumeRequest | null>(
    null,
  );

  const columns = React.useMemo<ColumnDef<AdminPerfumeRequest, unknown>[]>(
    () => [
      {
        id: "perfume",
        header: "Үнэртэн",
        accessorFn: (r) => titleOf(r),
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => setViewing(row.original)}
            className="text-left hover:underline"
          >
            <span className="font-medium">{titleOf(row.original)}</span>
            {row.original.concentration && (
              <span className="text-muted-foreground">
                {" "}
                · {row.original.concentration}
              </span>
            )}
          </button>
        ),
      },
      {
        accessorKey: "voteCount",
        header: "Хүссэн",
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">
            {row.original.voteCount}
          </span>
        ),
      },
      {
        accessorKey: "lastVotedAt",
        header: "Сүүлд хүссэн",
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {formatDateTime(row.original.lastVotedAt)}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        pageSize={0}
        // Сервер эрэмбэлсэн (хүссэн тоогоор) нэг хуудас — утсан дээр дахин
        // эрэмбэлбэл доорх хуудаслалттай зөрнө.
        phoneSort={false}
        emptyText="Санал алга"
        label="Үнэртний саналын жагсаалт"
        renderCard={(r) => (
          <button
            type="button"
            onClick={() => setViewing(r)}
            className="block w-full space-y-1 text-left"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="font-medium">
                {titleOf(r)}
                {r.concentration && (
                  <span className="text-muted-foreground">
                    {" "}
                    · {r.concentration}
                  </span>
                )}
              </span>
              <span className="shrink-0 font-medium tabular-nums">
                {r.voteCount} хүн
              </span>
            </div>
            <span className="text-muted-foreground block text-sm">
              {formatDateTime(r.lastVotedAt)}
            </span>
          </button>
        )}
      />
      {viewing && (
        <RequestDrawer
          key={viewing.id}
          request={viewing}
          others={rows.filter((r) => r.id !== viewing.id)}
          onClose={() => setViewing(null)}
        />
      )}
    </>
  );
}

function RequestDrawer({
  request,
  others,
  onClose,
}: {
  request: AdminPerfumeRequest;
  others: AdminPerfumeRequest[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();
  const [mergeTarget, setMergeTarget] =
    React.useState<AdminPerfumeRequest | null>(null);
  const [merging, setMerging] = React.useState(false);
  const voters = useVoters(request.id);

  async function merge() {
    if (!mergeTarget) return;
    const ok = await confirm({
      title: "Нэгтгэх үү?",
      description: `«${titleOf(request)}»-ийн ${request.voteCount} санал «${titleOf(mergeTarget)}» руу шилжиж, энэ мөр устана. Буцаах боломжгүй.`,
      confirmLabel: "Нэгтгэх",
      destructive: true,
    });
    if (!ok) return;
    setMerging(true);
    try {
      const res = await adminFetch<{ ok: true; voteCount: number }>(
        `/api/admin/perfume-requests/${request.id}/merge`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetId: mergeTarget.id }),
        },
      );
      if (!res.ok) {
        toast.error(res.error, "Нэгтгэсэнгүй");
        return;
      }
      toast.success(
        `Нэгтгэлээ — «${titleOf(mergeTarget)}» одоо ${res.data.voteCount} хүн.`,
      );
      onClose();
      router.refresh();
    } finally {
      setMerging(false);
    }
  }

  return (
    <>
      {confirmDialog}
      <FormDrawer
        open
        dirty={false}
        onClose={onClose}
        title={titleOf(request)}
        description={
          <>
            {request.concentration && <>{request.concentration} · </>}
            {request.voteCount} хүн хүссэн · анх{" "}
            {formatDateTime(request.createdAt)}
          </>
        }
        footer={
          others.length > 0 && (
            <LoadingButton
              variant="outline"
              loading={merging}
              disabled={!mergeTarget}
              onClick={merge}
            >
              <Combine className="size-4" /> Нэгтгэх
            </LoadingButton>
          )
        }
      >
        <div className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">
              Хүссэн хүмүүс ({request.voteCount})
            </h3>
            <VoterList state={voters} />
          </section>

          {others.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Давхардсан бол нэгтгэх</h3>
              <Field
                label="Аль санал руу"
                hint="Ижил үнэртэн өөрөөр бичигдсэн бол («Sauvag», «Dior Savage») энэ саналуудыг нөгөө мөр рүү шилжүүлнэ."
              >
                <RequestPicker
                  options={others}
                  value={mergeTarget}
                  onChange={setMergeTarget}
                />
              </Field>
            </section>
          )}
        </div>
      </FormDrawer>
    </>
  );
}

type VotersState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ok"; voters: AdminPerfumeRequestVoter[] };

function useVoters(requestId: string): VotersState {
  const [state, setState] = React.useState<VotersState>({ kind: "loading" });
  React.useEffect(() => {
    const controller = new AbortController();
    adminFetch<{ voters: AdminPerfumeRequestVoter[] }>(
      `/api/admin/perfume-requests/${requestId}`,
      { signal: controller.signal, cache: "no-store" },
    ).then((res) => {
      if (controller.signal.aborted) return;
      setState(
        res.ok
          ? { kind: "ok", voters: res.data.voters }
          : { kind: "error", message: res.error },
      );
    });
    return () => controller.abort();
  }, [requestId]);
  return state;
}

function VoterList({ state }: { state: VotersState }) {
  if (state.kind === "loading") {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Ачаалж байна…
      </p>
    );
  }
  if (state.kind === "error") {
    return <p className="text-destructive text-sm">{state.message}</p>;
  }
  if (state.voters.length === 0) {
    return <p className="text-muted-foreground text-sm">Санал алга.</p>;
  }
  return (
    <ul className="divide-border divide-y text-sm">
      {state.voters.map((v) => (
        <li key={v.userId} className="space-y-1 py-2">
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate font-medium">
              {v.name || v.phone || "Нэргүй хэрэглэгч"}
              {v.name && v.phone && (
                <span className="text-muted-foreground font-normal">
                  {" "}
                  · {v.phone}
                </span>
              )}
            </span>
            <span className="text-muted-foreground shrink-0 text-xs">
              {formatDateTime(v.votedAt)}
            </span>
          </div>
          {v.note && <p className="text-muted-foreground">{v.note}</p>}
        </li>
      ))}
    </ul>
  );
}

const requestLabel = (r: AdminPerfumeRequest) =>
  `${titleOf(r)} (${r.voteCount})`;

/** Нэгтгэх зорилт — энэ хуудсан дээрх бусад санал. */
function RequestPicker({
  options,
  value,
  onChange,
}: {
  options: AdminPerfumeRequest[];
  value: AdminPerfumeRequest | null;
  onChange: (next: AdminPerfumeRequest | null) => void;
}) {
  return (
    <Combobox
      items={options}
      value={value}
      onValueChange={(next: AdminPerfumeRequest | null) =>
        onChange(next ?? null)
      }
      itemToStringLabel={requestLabel}
      isItemEqualToValue={(a: AdminPerfumeRequest, b: AdminPerfumeRequest) =>
        a.id === b.id
      }
    >
      <ComboboxTrigger>
        <ComboboxValue placeholder="Санал сонгоно уу" />
      </ComboboxTrigger>
      <PickerPopup>
        <ComboboxInput placeholder="Хайх" aria-label="Санал хайх" />
        <ComboboxScroll>
          <ComboboxEmpty>Олдсонгүй.</ComboboxEmpty>
          <ComboboxList>
            {(r: AdminPerfumeRequest) => (
              <ComboboxItem key={r.id} value={r}>
                <span className="truncate">{requestLabel(r)}</span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxScroll>
      </PickerPopup>
    </Combobox>
  );
}
