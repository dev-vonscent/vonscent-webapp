"use client";

import * as React from "react";
import { Loader2, Pencil, Plus, Settings2, Trash2, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { adminFetch } from "@/features/admin/lib/mutate";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { toast } from "@/lib/toast";
import {
  CONCENTRATION_CODE_MAX,
  CONCENTRATION_LABEL_MAX,
} from "@/lib/constants";
import type { ConcentrationOption } from "@/lib/types";

/**
 * Үнэртний төрлийн сонголт (0085_concentrations.sql).
 *
 * Төрөл нь өмнө нь Postgres enum байсан тул шинэ ус — Eau Fraîche, attar,
 * тос — ирэхэд админ түүнийг бүртгэж чаддаггүй, migration хүлээдэг байв. Одоо
 * жагсаалт нь `scent_families` / `custom_tags`-тай ижил админы хүснэгт, энэ
 * контрол нь түүнийг барааны формыг орхилгүйгээр нэмж, засаж, устгана.
 *
 * Утга нь мөрийн id биш **code** (ж. «EDP»): `products.concentration` яг тэр
 * текстийг хадгалдаг, каталог RPC, quiz, барааны хуудас бүгд түүнийг уншдаг
 * тул форм хэлбэрээ хадгална.
 */

function sortOptions(list: ConcentrationOption[]): ConcentrationOption[] {
  return [...list].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code),
  );
}

export function ConcentrationSelect({
  value,
  onChange,
  options: initialOptions,
}: {
  value: string;
  onChange: (code: string) => void;
  options: ConcentrationOption[];
}) {
  const [options, setOptions] = React.useState(() =>
    sortOptions(initialOptions),
  );
  const [selectOpen, setSelectOpen] = React.useState(false);
  const [manageOpen, setManageOpen] = React.useState(false);
  React.useEffect(
    () => setOptions(sortOptions(initialOptions)),
    [initialOptions],
  );

  /**
   * Бараа нь жагсаалтаас нуусан (эсвэл 0085-аас өмнөх) төрөл авчирсан байж
   * болно. Түүнийг сонголт болгож харуулахгүй бол админы гар хүрээгүй талбар
   * чимээгүйхэн хоосрох эрсдэлтэй.
   */
  const visible = React.useMemo(() => {
    const shown = options.filter(
      (c) => c.isActive || c.code.toLowerCase() === value.trim().toLowerCase(),
    );
    if (
      value.trim() &&
      !shown.some((c) => c.code.toLowerCase() === value.trim().toLowerCase())
    ) {
      return [
        {
          id: `orphan:${value}`,
          code: value,
          label: "",
          sortOrder: -1,
          isActive: true,
        } satisfies ConcentrationOption,
        ...shown,
      ];
    }
    return shown;
  }, [options, value]);

  return (
    <>
      <Select
        open={selectOpen}
        onOpenChange={setSelectOpen}
        value={value || undefined}
        onValueChange={onChange}
      >
        <SelectTrigger aria-label="Үнэртний төрөл">
          <SelectValue placeholder="Төрөл сонгох" />
        </SelectTrigger>
        <SelectContent>
          {/*
            Жагсаалтыг удирдах нь үйлдэл болохоос төрөл биш — SelectItem
            болговол сумаар дээр нь буугаад Enter дарахад `products.concentration`
            руу утга нь очих эрсдэлтэй (brand-select.tsx-ийн тэмдэглэл).

            Radix-ийн viewport нь `p-1` тул `-top-1` ба сөрөг margin: `top-0`
            бол мөр гүйж өнгөрөх 4px зай үлдээдэг.
          */}
          <div className="bg-popover border-border sticky -top-1 z-10 -mx-1 -mt-1 mb-1 border-b p-1">
            <button
              type="button"
              onClick={() => {
                setSelectOpen(false);
                setManageOpen(true);
              }}
              className="hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm font-medium outline-none"
            >
              <Settings2 className="size-4" />
              Төрөл нэмэх / засах
            </button>
          </div>
          {visible.map((c) => (
            <SelectItem key={c.id} value={c.code}>
              <span className="flex items-center gap-2">
                <span className="truncate">{c.code}</span>
                {c.label && (
                  <span className="text-muted-foreground truncate text-xs">
                    {c.label}
                  </span>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <ManageConcentrationsDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        options={options}
        selected={value}
        onOptionsChange={setOptions}
        onSelect={onChange}
      />
    </>
  );
}

/**
 * Нэмэх, нэрлэх, устгах гурвыг нэг цонхонд.
 *
 * Жагсаалт нь бүх бараанд нийтлэг — нэг төрлийг засвал түүнийг агуулсан бүх
 * бараан дээр өөрчлөгдөнө. Барааны формоос нээж байгаа тул үүнийг «энэ
 * барааны төрлийг солих» гэж уншиж болзошгүй, тиймээс цонх өөрөө тэгж биш
 * гэдгийг хэлж байна.
 */
function ManageConcentrationsDialog({
  open,
  onOpenChange,
  options,
  selected,
  onOptionsChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: ConcentrationOption[];
  selected: string;
  onOptionsChange: (next: ConcentrationOption[]) => void;
  onSelect: (code: string) => void;
}) {
  const [confirm, confirmDialog] = useConfirm();
  const [code, setCode] = React.useState("");
  const [label, setLabel] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setCode("");
      setLabel("");
      setError(null);
      setEditingId(null);
    }
  }, [open]);

  const duplicate = React.useMemo(
    () =>
      options.find(
        (c) => c.code.trim().toLowerCase() === code.trim().toLowerCase(),
      ) ?? null,
    [options, code],
  );

  async function add() {
    const trimmed = code.trim();
    if (!trimmed || busy) return;

    // Бүртгэлтэй төрлийг дахин бичих нь алдаа биш — хүссэн төрөл нь тэр.
    if (duplicate) {
      onSelect(duplicate.code);
      onOpenChange(false);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await adminFetch<{ concentration?: ConcentrationOption }>(
        "/api/admin/concentrations",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: trimmed, label: label.trim() }),
        },
      );
      if (!res.ok) {
        setError(
          res.demo
            ? "Demo горим: Supabase холбогдсоны дараа хадгалагдана."
            : res.error.includes("DUPLICATE")
              ? "Энэ төрөл бүртгэлтэй байна."
              : res.error.includes("NOT_MIGRATED")
                ? "Өгөгдлийн сан бэлэн биш байна (0085_concentrations.sql)."
                : res.error.includes("VALIDATION")
                  ? "Товчлолыг зөв бичнэ үү."
                  : res.error,
        );
        return;
      }
      const created = res.data?.concentration;
      if (!created) return;
      onOptionsChange(sortOptions([...options, created]));
      // Форм дээр төрөл зохиож байгаа нь тэр төрлийг энэ бараанд өгөх гэсэн
      // үг — сонгож өгөх нь эндээс нэмэх гол учир.
      onSelect(created.code);
      setCode("");
      setLabel("");
      toast.success(`«${created.code}» төрөл нэмэгдлээ.`);
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(
    row: ConcentrationOption,
    nextCode: string,
    nextLabel: string,
  ) {
    const trimmedCode = nextCode.trim();
    if (!trimmedCode) return;
    if (trimmedCode === row.code && nextLabel.trim() === row.label) {
      setEditingId(null);
      return;
    }
    setBusy(true);
    try {
      const res = await adminFetch<{ concentration?: ConcentrationOption }>(
        `/api/admin/concentrations/${row.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: trimmedCode,
            label: nextLabel.trim(),
          }),
        },
      );
      if (!res.ok) {
        toast.error(
          res.demo
            ? "Demo горим."
            : res.error.includes("DUPLICATE")
              ? "Энэ нэртэй төрөл бүртгэлтэй байна."
              : "Хадгалагдсангүй.",
        );
        return;
      }
      const next = res.data?.concentration;
      if (!next) return;
      onOptionsChange(
        sortOptions(options.map((c) => (c.id === next.id ? next : c))),
      );
      // Товчлол өөрчлөгдвөл сан дахь бараанууд FK-ээр дагана
      // (`on update cascade`) — засаж байгаа формын утгыг ч дагуулна, эс
      // бөгөөс хадгалахад хуучин товчлолыг буцааж бичих байсан.
      if (selected === row.code) onSelect(next.code);
      setEditingId(null);
      toast.success("Төрөл шинэчиллээ.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: ConcentrationOption) {
    if (
      !(await confirm({
        title: `«${row.code}» төрлийг устгах уу?`,
        description:
          "Төрөл жагсаалтаас бүрмөсөн хасагдана. Энэ төрөлтэй бараа байвал устгагдахгүй — эхлээд тэдгээрийн төрлийг солино уу.",
        confirmLabel: "Устгах",
        destructive: true,
      }))
    )
      return;

    setBusy(true);
    try {
      const res = await adminFetch(`/api/admin/concentrations/${row.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error(
          res.demo
            ? "Demo горим."
            : res.error.includes("IN_USE")
              ? "Энэ төрлийг ашиглаж буй бараа байна — устгаж болохгүй."
              : "Устсангүй.",
        );
        return;
      }
      onOptionsChange(options.filter((c) => c.id !== row.id));
      if (selected === row.code) onSelect("");
      toast.success("Төрөл устлаа.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {confirmDialog}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogTitle>Үнэртний төрөл</DialogTitle>
          <DialogDescription>
            Жагсаалт нь бүх бараанд нийтлэг. Энд хийсэн засвар тухайн төрөлтэй
            бүх бараан дээр мөрдөгдөнө.
          </DialogDescription>

          {/* <form> биш: энэ нь барааны формын дотор render хийгддэг тул
              давхар form нь Enter дээр барааг бүхэлд нь хадгалах байсан. */}
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
                <div className="space-y-1.5">
                  <Label htmlFor="new-concentration-code">Товчлол</Label>
                  <Input
                    id="new-concentration-code"
                    autoFocus
                    value={code}
                    maxLength={CONCENTRATION_CODE_MAX}
                    placeholder="EDP"
                    onChange={(e) => setCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        add();
                      }
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-concentration-label">
                    Бүтэн нэр (заавал биш)
                  </Label>
                  <Input
                    id="new-concentration-label"
                    value={label}
                    maxLength={CONCENTRATION_LABEL_MAX}
                    placeholder="Eau de Parfum"
                    onChange={(e) => setLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        add();
                      }
                    }}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy || !code.trim()}
                    onClick={add}
                    className="w-full sm:w-auto"
                    title={
                      duplicate ? "Бүртгэлтэй төрөл — сонгоно" : "Төрөл нэмэх"
                    }
                  >
                    {busy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Plus className="size-4" />
                    )}
                    <span className="sm:sr-only">
                      {duplicate ? "Сонгох" : "Нэмэх"}
                    </span>
                  </Button>
                </div>
              </div>
              <p className="text-muted-foreground text-xs">
                Товчлол нь барааны хуудсанд яг ингэж харагдана. Бүтэн нэр нь
                зөвхөн энэ жагсаалтад тайлбар болно.
              </p>
              {duplicate && (
                <p className="text-muted-foreground text-xs">
                  «{duplicate.code}» бүртгэлтэй байна — нэмэхэд түүнийг сонгоно.
                </p>
              )}
              {error && <p className="text-destructive text-sm">{error}</p>}
            </div>

            <ul className="max-h-72 divide-y overflow-y-auto rounded-md border">
              {options.length === 0 && (
                <li className="text-muted-foreground p-3 text-sm">
                  Одоогоор төрөл алга — дээрээс нэмнэ үү.
                </li>
              )}
              {options.map((row) =>
                editingId === row.id ? (
                  <EditRow
                    key={row.id}
                    row={row}
                    busy={busy}
                    onCancel={() => setEditingId(null)}
                    onSave={(c, l) => saveEdit(row, c, l)}
                  />
                ) : (
                  <li
                    key={row.id}
                    className="flex items-center gap-3 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{row.code}</span>
                      {row.label && (
                        <span className="text-muted-foreground ml-2">
                          {row.label}
                        </span>
                      )}
                      {row.code === selected && (
                        <span className="text-muted-foreground ml-2 text-xs">
                          (сонгосон)
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      aria-label={`${row.code} — засах`}
                      onClick={() => setEditingId(row.id)}
                      className="text-muted-foreground hover:text-foreground shrink-0 rounded p-1 transition-colors"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      aria-label={`${row.code} — устгах`}
                      onClick={() => remove(row)}
                      className="text-muted-foreground hover:text-destructive shrink-0 rounded p-1 transition-colors"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                ),
              )}
            </ul>

            <div className="flex justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
              >
                Хаах
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EditRow({
  row,
  busy,
  onSave,
  onCancel,
}: {
  row: ConcentrationOption;
  busy: boolean;
  onSave: (code: string, label: string) => void;
  onCancel: () => void;
}) {
  const [code, setCode] = React.useState(row.code);
  const [label, setLabel] = React.useState(row.label);

  return (
    <li className="flex items-center gap-2 px-3 py-2">
      <Input
        autoFocus
        value={code}
        maxLength={CONCENTRATION_CODE_MAX}
        aria-label="Товчлол"
        className="h-9 flex-1"
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSave(code, label);
          }
          if (e.key === "Escape") onCancel();
        }}
      />
      <Input
        value={label}
        maxLength={CONCENTRATION_LABEL_MAX}
        aria-label="Бүтэн нэр"
        placeholder="Eau de Parfum"
        className="h-9 flex-[1.4]"
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSave(code, label);
          }
          if (e.key === "Escape") onCancel();
        }}
      />
      <Button
        type="button"
        size="sm"
        disabled={busy || !code.trim()}
        onClick={() => onSave(code, label)}
      >
        Хадгалах
      </Button>
      <button
        type="button"
        aria-label="Болих"
        onClick={onCancel}
        className="text-muted-foreground hover:text-foreground shrink-0 rounded p-1 transition-colors"
      >
        <X className="size-4" />
      </button>
    </li>
  );
}
