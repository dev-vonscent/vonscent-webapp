"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { mutate, mutateJson } from "@/features/admin/lib/mutate";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { toast } from "@/lib/toast";
import { Check, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { GENDERS, GENDER_LABEL } from "@/lib/constants";

export interface AdminProduct {
  id: string;
  name: string;
  brand: string;
}

export interface AdminCollection {
  id: string;
  slug: string;
  name: string;
  gender: "male" | "female" | "unisex";
  description: string | null;
  discount_pct: number | string;
  image_url: string | null;
  gift_ml: number | null;
  is_active: boolean;
  is_featured: boolean;
  collection_items: { product_id: string; sort_order: number }[];
}

const EMPTY = {
  name: "",
  gender: "unisex" as "male" | "female" | "unisex",
  description: "",
  discountPct: 5,
  giftMl: "" as number | "",
  imageUrl: "",
  isActive: true,
  isFeatured: false,
  productIds: [] as string[],
};

export function CollectionAdmin({
  collections,
  products,
}: {
  collections: AdminCollection[];
  products: AdminProduct[];
}) {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();
  const [editing, setEditing] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ ...EMPTY });
  const [q, setQ] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const nameById = React.useMemo(
    () => new Map(products.map((p) => [p.id, `${p.brand} — ${p.name}`])),
    [products],
  );

  function startCreate() {
    setEditing(null);
    setForm({ ...EMPTY });
    setError(null);
    setOpen(true);
  }

  function startEdit(c: AdminCollection) {
    setEditing(c.id);
    setForm({
      name: c.name,
      gender: c.gender,
      description: c.description ?? "",
      discountPct: Number(c.discount_pct),
      giftMl: c.gift_ml ?? "",
      imageUrl: c.image_url ?? "",
      isActive: c.is_active,
      isFeatured: c.is_featured,
      productIds: [...c.collection_items]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((i) => i.product_id),
    });
    setError(null);
    setOpen(true);
  }

  function toggleProduct(id: string) {
    setForm((f) => {
      if (f.productIds.includes(id))
        return { ...f, productIds: f.productIds.filter((x) => x !== id) };
      if (f.productIds.length >= 4) return f;
      return { ...f, productIds: [...f.productIds, id] };
    });
  }

  async function save() {
    if (form.productIds.length !== 4) {
      setError("Яг 4 үнэртэн сонгоно уу.");
      return;
    }
    setBusy(true);
    setError(null);
    const body = {
      name: form.name,
      gender: form.gender,
      description: form.description,
      discountPct: Number(form.discountPct),
      giftMl: form.giftMl === "" ? null : Number(form.giftMl),
      imageUrl: form.imageUrl || null,
      isActive: form.isActive,
      isFeatured: form.isFeatured,
      productIds: form.productIds,
    };
    const ok = await mutateJson(
      editing ? `/api/admin/collections/${editing}` : "/api/admin/collections",
      editing ? "PATCH" : "POST",
      body,
      "Багц хадгалагдсангүй",
    );
    setBusy(false);
    if (!ok) {
      setError("Хадгалахад алдаа гарлаа.");
      return;
    }
    toast.success(editing ? "Багц шинэчлэгдлээ." : "Багц үүслээ.");
    setOpen(false);
    router.refresh();
  }

  async function remove(id: string, collectionName: string) {
    if (
      !(await confirm({
        title: `«${collectionName}» багцыг устгах уу?`,
        description:
          "Багц болон түүний барааны жагсаалт устна. Багц дэлгүүрээс алга болно. Буцаах боломжгүй.",
        confirmLabel: "Устгах",
        destructive: true,
      }))
    )
      return;
    if (
      !(await mutate(
        `/api/admin/collections/${id}`,
        { method: "DELETE" },
        "Багц устсангүй",
      ))
    )
      return;
    toast.success("Багц устлаа.");
    router.refresh();
  }

  const filtered = q
    ? products.filter((p) =>
        `${p.brand} ${p.name}`.toLowerCase().includes(q.toLowerCase()),
      )
    : products;

  return (
    <div className="space-y-6">
      {confirmDialog}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {collections.length} багц
        </p>
        <Button onClick={startCreate}>
          <Plus className="size-4" /> Шинэ багц
        </Button>
      </div>

      {/* List */}
      <div className="space-y-2">
        {collections.map((c) => (
          <div
            key={c.id}
            className="bg-card flex items-center gap-3 rounded-xl p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{c.name}</span>
                {!c.is_active && <Badge variant="secondary">Нуусан</Badge>}
                {c.is_featured && <Badge>Онцлох</Badge>}
              </div>
              <p className="text-muted-foreground truncate text-xs">
                {GENDER_LABEL[c.gender]} · −{Number(c.discount_pct)}% ·{" "}
                {c.collection_items.length} үнэртэн
              </p>
            </div>
            <button
              onClick={() => startEdit(c)}
              className="text-muted-foreground hover:text-foreground p-2"
              aria-label="Засах"
            >
              <Pencil className="size-4" />
            </button>
            <button
              onClick={() => remove(c.id, c.name)}
              className="text-muted-foreground hover:text-destructive p-2"
              aria-label="Устгах"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Editor */}
      {open && (
        <div className="bg-foreground/40 fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4">
          <div className="bg-card my-8 w-full max-w-lg space-y-4 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-lg font-semibold">
                {editing ? "Багц засах" : "Шинэ багц"}
              </h2>
              <button onClick={() => setOpen(false)} aria-label="Хаах">
                <X className="size-5" />
              </button>
            </div>

            <label className="block text-sm font-medium">
              Нэр
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              {/* The last native <select> in the panel: it drew the browser's
                  own grey list over a themed page and ignored all three
                  themes. */}
              <Field label="Хүйс">
                <Select
                  value={form.gender}
                  onValueChange={(v) =>
                    setForm({ ...form, gender: v as typeof form.gender })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDERS.map((g) => (
                      <SelectItem key={g} value={g}>
                        {GENDER_LABEL[g]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <label className="block text-sm font-medium">
                Хямдрал %
                <Input
                  type="number"
                  value={form.discountPct}
                  onChange={(e) =>
                    setForm({ ...form, discountPct: Number(e.target.value) })
                  }
                  className="mt-1"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium">
                Бэлгийн ml (сонголттой)
                <Input
                  type="number"
                  value={form.giftMl}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      giftMl:
                        e.target.value === "" ? "" : Number(e.target.value),
                    })
                  }
                  placeholder="default"
                  className="mt-1"
                />
              </label>
              <label className="block text-sm font-medium">
                Зургийн URL
                <Input
                  value={form.imageUrl}
                  onChange={(e) =>
                    setForm({ ...form, imageUrl: e.target.value })
                  }
                  className="mt-1"
                />
              </label>
            </div>

            <label className="block text-sm font-medium">
              Тайлбар
              <Input
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                className="mt-1"
              />
            </label>

            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm({ ...form, isActive: e.target.checked })
                  }
                  className="size-4"
                />
                Идэвхтэй
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isFeatured}
                  onChange={(e) =>
                    setForm({ ...form, isFeatured: e.target.checked })
                  }
                  className="size-4"
                />
                Онцлох
              </label>
            </div>

            {/* Product picker */}
            <div>
              <p className="mb-1 text-sm font-medium">
                Үнэртэн ({form.productIds.length}/4)
              </p>
              {form.productIds.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {form.productIds.map((id) => (
                    <button
                      key={id}
                      onClick={() => toggleProduct(id)}
                      className="bg-secondary hover:bg-accent flex items-center gap-1 rounded-full px-2.5 py-1 text-xs"
                    >
                      {nameById.get(id) ?? id}
                      <X className="size-3" />
                    </button>
                  ))}
                </div>
              )}
              <div className="relative">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Үнэртэн хайх…"
                  className="pl-9"
                />
              </div>
              <div className="bg-muted/40 mt-2 max-h-48 space-y-1 overflow-y-auto rounded-lg p-1">
                {filtered.map((p) => {
                  const on = form.productIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggleProduct(p.id)}
                      disabled={!on && form.productIds.length >= 4}
                      className={cn(
                        "hover:bg-accent flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm disabled:opacity-40",
                        on && "bg-accent",
                      )}
                    >
                      <span>
                        <span className="text-muted-foreground">{p.brand}</span>{" "}
                        {p.name}
                      </span>
                      {on && <Check className="text-gold-strong size-4" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {error && <p className="text-destructive text-sm">{error}</p>}

            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => setOpen(false)}
                className="flex-1"
              >
                Болих
              </Button>
              <Button onClick={save} disabled={busy} className="flex-1">
                {busy ? "Хадгалж байна…" : "Хадгалах"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
