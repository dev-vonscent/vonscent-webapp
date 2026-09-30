"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { LoadingButton } from "@/components/shared/loading-button";
import { Checkbox } from "@/components/ui/checkbox";
import { adminFetch } from "@/features/admin/lib/mutate";
import { toast } from "@/lib/toast";

type Row = { en: string; isAbstract: boolean };
const EMPTY: Row = { en: "", isAbstract: false };

/**
 * «Англи нэргүй нот» — зураг үүсгэхэд англи нэр хэрэгтэй (0102).
 *
 * Энд бөглөсөн нэр бүх усанд хэрэглэгдэнэ: нэг нотыг нэг л удаа бөглөнө.
 * Зөвхөн ХАДГАЛСАН нотуудыг харуулна — нот засаад хадгалсны дараа дахин
 * нээхэд шинэ нот нь энд гарна.
 */
export function NoteTranslationPanel({ notes }: { notes: string[] }) {
  const router = useRouter();
  // `router.refresh()`-ийн дараа `notes` өөрчлөгдөж болох тул мөр бүр
  // байхгүй үед EMPTY-ээр уншина.
  const [rows, setRows] = React.useState<Record<string, Row>>({});
  const rowOf = (n: string) => rows[n] ?? EMPTY;
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  if (notes.length === 0) return null;

  const filled = notes.filter((n) => rowOf(n).isAbstract || rowOf(n).en.trim());

  function patch(note: string, next: Partial<Row>) {
    setRows((r) => ({ ...r, [note]: { ...(r[note] ?? EMPTY), ...next } }));
  }

  async function save() {
    if (filled.length === 0 || busy) return;
    setBusy(true);
    setMsg(null);
    const res = await adminFetch("/api/admin/note-translations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: filled.map((mn) => ({
          mn,
          en: rowOf(mn).en,
          isAbstract: rowOf(mn).isAbstract,
        })),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setMsg(
        res.error.includes("NOT_MIGRATED")
          ? "Сан шинэчлэгдээгүй байна (0102 migration)."
          : `Хадгалж чадсангүй: ${res.error}`,
      );
      return;
    }
    toast.success(`${filled.length} нотын англи нэр хадгалагдлаа.`);
    router.refresh();
  }

  return (
    <div className="bg-warning/10 space-y-3 rounded-md p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Англи нэргүй нот</h3>
        <p className="text-muted-foreground text-xs">
          Нотын зураг үүсгэхэд англи нэр хэрэгтэй. Бөглөөгүй нот зурагт орохгүй.
          Мускус, амбер шиг зургаар дүрслэх боломжгүй нот бол «Дүрслэх
          боломжгүй» гэснийг чагтална. Нэг удаа бөглөхөд бүх усанд хэрэглэгдэнэ.
        </p>
      </div>
      <ul className="space-y-2">
        {notes.map((note) => {
          const row = rowOf(note);
          return (
            <li
              key={note}
              className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[10rem_1fr_auto]"
            >
              <span className="text-sm font-medium">{note}</span>
              <Input
                aria-label={`${note} — англи нэр`}
                placeholder="Жишээ нь: Peony"
                value={row.en}
                disabled={row.isAbstract}
                onChange={(e) => patch(note, { en: e.target.value })}
                // Барааны формын дотор байгаа тул Enter нь барааг хадгалахгүй,
                // энэ самбарыг хадгална.
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void save();
                  }
                }}
              />
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={row.isAbstract}
                  onCheckedChange={(v) =>
                    patch(note, { isAbstract: Boolean(v) })
                  }
                />
                Дүрслэх боломжгүй
              </label>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <LoadingButton
          loading={busy}
          type="button"
          size="sm"
          onClick={save}
          disabled={filled.length === 0}
        >
          Англи нэрийг хадгалах
        </LoadingButton>
        {msg && <p className="text-destructive text-xs">{msg}</p>}
      </div>
    </div>
  );
}
