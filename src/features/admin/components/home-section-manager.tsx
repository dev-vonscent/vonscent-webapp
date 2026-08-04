"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConfirm } from "@/components/shared/confirm-dialog";
import type { AdminHomeSection } from "@/features/admin/api";

/** Just what the picker needs off a product. */
export interface PickableProduct {
  id: string;
  name: string;
  brand: string;
}

const TAG_LABEL: Record<string, string> = {
  new: "Шинэ",
  hot: "Эрэлттэй",
  sale: "Хямдралтай",
};

/**
 * Home page rails (todo.md B7): create «Онцлох» / «Багц уснууд», pick the
 * products by hand and order both the rails and the products inside them.
 *
 * Ordering is arrow buttons rather than drag: these lists are short, and the
 * same page has to work under a finger without competing with page scroll.
 */
export function HomeSectionManager({
  sections,
  products,
}: {
  sections: AdminHomeSection[];
  products: PickableProduct[];
}) {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();
  const [busy, setBusy] = React.useState(false);
  const [title, setTitle] = React.useState("");

  async function send(url: string, init: RequestInit) {
    setBusy(true);
    try {
      await fetch(url, {
        headers: { "Content-Type": "application/json" },
        ...init,
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const patch = (id: string, body: unknown) =>
    send(`/api/admin/home-sections/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await send("/api/admin/home-sections", {
      method: "POST",
      body: JSON.stringify({
        title: title.trim(),
        sortOrder: sections.length + 1,
      }),
    });
    setTitle("");
  }

  async function remove(section: AdminHomeSection) {
    const ok = await confirm({
      title: `«${section.title}» хэсгийг устгах уу?`,
      description: "Нүүр хуудаснаас алга болно. Бараа өөрөө устахгүй.",
      confirmLabel: "Устгах",
      destructive: true,
    });
    if (!ok) return;
    await send(`/api/admin/home-sections/${section.id}`, { method: "DELETE" });
  }

  /** Swap two rails' sort_order — one PATCH each, so a refresh is enough. */
  async function moveSection(index: number, delta: number) {
    const next = index + delta;
    if (next < 0 || next >= sections.length) return;
    const a = sections[index];
    const b = sections[next];
    await Promise.all([
      fetch(`/api/admin/home-sections/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: b.sort_order }),
      }),
      fetch(`/api/admin/home-sections/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: a.sort_order }),
      }),
    ]);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {confirmDialog}

      {sections.map((section, i) => (
        <SectionCard
          key={section.id}
          section={section}
          products={products}
          busy={busy}
          first={i === 0}
          last={i === sections.length - 1}
          onMove={(delta) => moveSection(i, delta)}
          onPatch={(body) => patch(section.id, body)}
          onRemove={() => remove(section)}
        />
      ))}

      {sections.length === 0 && (
        <p className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          Хэсэг алга. Доор нэр өгч эхний хэсгээ үүсгэнэ үү.
        </p>
      )}

      <Card>
        <CardContent className="p-6">
          <form onSubmit={create} className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1 space-y-1.5">
              <Label>Шинэ хэсгийн гарчиг</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Онцлох"
              />
            </div>
            <Button type="submit" disabled={busy || !title.trim()}>
              <Plus className="size-4" /> Хэсэг нэмэх
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function SectionCard({
  section,
  products,
  busy,
  first,
  last,
  onMove,
  onPatch,
  onRemove,
}: {
  section: AdminHomeSection;
  products: PickableProduct[];
  busy: boolean;
  first: boolean;
  last: boolean;
  onMove: (delta: number) => void;
  onPatch: (body: unknown) => Promise<void>;
  onRemove: () => void;
}) {
  // Local copies so typing doesn't round-trip on every keystroke; saved on
  // blur / on the explicit save button.
  const [title, setTitle] = React.useState(section.title);
  const [subtitle, setSubtitle] = React.useState(section.subtitle);
  const [href, setHref] = React.useState(section.href);
  const [picked, setPicked] = React.useState<string[]>(section.productIds);

  const byId = React.useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );
  const available = products.filter((p) => !picked.includes(p.id));

  function movePicked(index: number, delta: number) {
    const next = index + delta;
    if (next < 0 || next >= picked.length) return;
    const copy = [...picked];
    [copy[index], copy[next]] = [copy[next], copy[index]];
    setPicked(copy);
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex-1 font-serif text-lg font-semibold">
            {section.title}
            {!section.is_active && (
              <Badge variant="secondary" className="ml-2">
                Нуугдсан
              </Badge>
            )}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            disabled={busy || first}
            onClick={() => onMove(-1)}
            aria-label="Дээш"
          >
            <ChevronUp className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={busy || last}
            onClick={() => onMove(1)}
            aria-label="Доош"
          >
            <ChevronDown className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={busy}
            onClick={() => onPatch({ isActive: !section.is_active })}
            aria-label={section.is_active ? "Нуух" : "Харуулах"}
          >
            {section.is_active ? (
              <Eye className="size-4" />
            ) : (
              <EyeOff className="size-4 text-muted-foreground" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={busy}
            onClick={onRemove}
            aria-label="Устгах"
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Гарчиг</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Тайлбар</Label>
            <Input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Бидний сонголт"
            />
          </div>
          <div className="space-y-1.5">
            <Label>«Бүгд» холбоос</Label>
            <Input
              value={href}
              onChange={(e) => setHref(e.target.value)}
              placeholder="/catalog"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Бараа ({picked.length})</Label>
          {picked.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Бараа сонгоогүй тул энэ хэсэг нүүр хуудсанд харагдахгүй.
            </p>
          ) : (
            <ol className="space-y-1.5">
              {picked.map((id, i) => {
                const p = byId.get(id);
                return (
                  <li
                    key={id}
                    className="flex items-center gap-2 rounded-md bg-secondary px-3 py-1.5 text-sm"
                  >
                    <span className="w-5 text-xs text-muted-foreground">
                      {i + 1}.
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {p ? `${p.brand} — ${p.name}` : "Устсан бараа"}
                    </span>
                    <button
                      type="button"
                      onClick={() => movePicked(i, -1)}
                      disabled={i === 0}
                      aria-label="Дээш"
                      className="text-muted-foreground disabled:opacity-30"
                    >
                      <ChevronUp className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => movePicked(i, 1)}
                      disabled={i === picked.length - 1}
                      aria-label="Доош"
                      className="text-muted-foreground disabled:opacity-30"
                    >
                      <ChevronDown className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPicked(picked.filter((x) => x !== id))
                      }
                      aria-label="Хасах"
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-4" />
                    </button>
                  </li>
                );
              })}
            </ol>
          )}

          <Select
            value=""
            onValueChange={(id) => setPicked([...picked, id])}
            disabled={available.length === 0}
          >
            <SelectTrigger className="max-w-sm">
              <SelectValue placeholder="Бараа нэмэх" />
            </SelectTrigger>
            <SelectContent>
              {available.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.brand} — {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {section.kind === "tag" && section.tag && (
          <p className="text-xs text-muted-foreground">
            Энэ хэсэг «{TAG_LABEL[section.tag] ?? section.tag}» тагтай барааг
            автоматаар харуулна — гараар сонгосон жагсаалт үйлчлэхгүй.
          </p>
        )}

        <Button
          disabled={busy}
          onClick={() =>
            onPatch({ title, subtitle, href, products: picked })
          }
        >
          Хадгалах
        </Button>
      </CardContent>
    </Card>
  );
}
