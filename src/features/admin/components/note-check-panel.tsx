"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/shared/loading-button";
import { Checkbox } from "@/components/ui/checkbox";
import { adminFetch } from "@/features/admin/lib/mutate";
import { toast } from "@/lib/toast";
import type { NoteLookup } from "@/lib/ai/notes-en";

type Row = { en: string; isAbstract: boolean };

const keyOf = (notes: string[]) => notes.join("|");

/**
 * «Нот шалгах» — бараа үүсгэх формд, хадгалахаас ӨМНӨ.
 *
 * AI лавлах зурагтай бараа хадгалмагц нотын зураг үүсдэг бөгөөд англи нэргүй
 * нот түүнд орохгүй. Энд нот бүр зурагт ямар англи нэрээр орохыг харуулж,
 * дутууг нь бөглүүлж, буруугийнх нь засуулна. Хадгалсан нэр `note_translations`
 * (0102)-д орох тул засах хуудасны «Англи нэргүй нот» самбартай нэг эх сурвалж.
 *
 * `openSignal` нэмэгдэх бүрд (сервер NOTES_UNTRANSLATED буцаасан) өөрөө
 * шалгаж, харагдах газар гүйлгэнэ.
 */
export function NoteCheckPanel({
  notes,
  openSignal,
}: {
  notes: string[];
  openSignal: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [lookup, setLookup] = React.useState<NoteLookup[] | null>(null);
  const [rows, setRows] = React.useState<Record<string, Row>>({});
  const [checkedKey, setCheckedKey] = React.useState("");
  const [checking, setChecking] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  const check = React.useCallback(async () => {
    if (notes.length === 0) {
      setLookup(null);
      setMsg("Нот оруулаагүй байна.");
      return;
    }
    setChecking(true);
    setMsg(null);
    const res = await adminFetch<{ notes: NoteLookup[] }>(
      "/api/admin/note-translations/lookup",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      },
    );
    setChecking(false);
    if (!res.ok || !res.data) {
      setMsg(`Шалгаж чадсангүй: ${res.ok ? "хариу ирсэнгүй" : res.error}`);
      return;
    }
    const found = res.data.notes;
    setLookup(found);
    setRows(
      Object.fromEntries(
        found.map((n) => [n.mn, { en: n.en, isAbstract: n.isAbstract }]),
      ),
    );
    setCheckedKey(keyOf(notes));
  }, [notes]);

  // Сервер хадгалахаас татгалзсан — самбарыг нээж, дутууг харуулна.
  React.useEffect(() => {
    if (openSignal === 0) return;
    void check();
    ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    // Зөвхөн дохио өөрчлөгдөхөд — нот бичих бүрд дахин шалгахгүй.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSignal]);

  const rowOf = (n: NoteLookup) =>
    rows[n.mn] ?? { en: n.en, isAbstract: n.isAbstract };
  const valid = (r: Row) => r.isAbstract || r.en.trim().length > 0;
  // Өөрчилсөн (эсвэл шинээр бөглөсөн) мөрүүд л хадгалагдана — кодын хүснэгтэд
  // зөв байгаа нотыг `note_translations`-д хуулахгүй.
  const dirty = (lookup ?? []).filter((n) => {
    const r = rowOf(n);
    return valid(r) && (r.en.trim() !== n.en || r.isAbstract !== n.isAbstract);
  });
  const missing = (lookup ?? []).filter((n) => n.source === null);
  const stale = lookup !== null && checkedKey !== keyOf(notes);

  function patch(mn: string, next: Partial<Row>) {
    setRows((r) => ({
      ...r,
      [mn]: { ...(r[mn] ?? { en: "", isAbstract: false }), ...next },
    }));
  }

  async function save() {
    if (dirty.length === 0 || saving) return;
    setSaving(true);
    setMsg(null);
    const res = await adminFetch("/api/admin/note-translations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: dirty.map((n) => ({
          mn: n.mn,
          en: rowOf(n).en,
          isAbstract: rowOf(n).isAbstract,
        })),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setMsg(
        res.error.includes("NOT_MIGRATED")
          ? "Сан шинэчлэгдээгүй байна (0102 migration)."
          : `Хадгалж чадсангүй: ${res.error}`,
      );
      return;
    }
    toast.success(`${dirty.length} нотын англи нэр хадгалагдлаа.`);
    await check();
  }

  return (
    <div ref={ref} className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <LoadingButton
          loading={checking}
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void check()}
        >
          Нот шалгах
        </LoadingButton>
        <p className="text-muted-foreground text-xs">
          Нот бүр үнэрийн зурагт ямар англи нэрээр орохыг хадгалахаас өмнө
          шалгана.
        </p>
      </div>

      {lookup && (
        <div
          className={
            missing.length
              ? "bg-warning/10 space-y-3 rounded-md p-4"
              : "bg-muted/40 space-y-3 rounded-md p-4"
          }
        >
          <p className="text-sm font-medium">
            {missing.length
              ? `${missing.length} нот англи нэргүй — бөглөхгүй бол зурагт орохгүй, AI зурагтай бараа хадгалагдахгүй.`
              : "Бүх нот англи нэртэй. Буруу байвал засаад хадгална уу."}
          </p>
          {stale && (
            <p className="text-warning text-xs">
              Нот өөрчлөгдсөн байна — «Нот шалгах»-ыг дахин дарна уу.
            </p>
          )}
          <ul className="space-y-2">
            {lookup.map((n) => {
              const r = rowOf(n);
              return (
                <li
                  key={n.mn}
                  className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[10rem_1fr_auto]"
                >
                  <span
                    className={
                      n.source === null
                        ? "text-destructive text-sm font-medium"
                        : "text-sm font-medium"
                    }
                  >
                    {n.mn}
                  </span>
                  <Input
                    aria-label={`${n.mn} — англи нэр`}
                    aria-invalid={n.source === null && !valid(r)}
                    placeholder="Жишээ нь: Peony"
                    value={r.en}
                    disabled={r.isAbstract}
                    onChange={(e) => patch(n.mn, { en: e.target.value })}
                    // Барааны формын дотор байгаа тул Enter нь барааг
                    // хадгалахгүй, орчуулгыг хадгална.
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void save();
                      }
                    }}
                  />
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={r.isAbstract}
                      onCheckedChange={(v) =>
                        patch(n.mn, { isAbstract: Boolean(v) })
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
              loading={saving}
              type="button"
              size="sm"
              onClick={save}
              disabled={dirty.length === 0}
            >
              Англи нэрийг хадгалах
            </LoadingButton>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setLookup(null)}
            >
              Хаах
            </Button>
          </div>
        </div>
      )}
      {msg && <p className="text-destructive text-xs">{msg}</p>}
    </div>
  );
}
