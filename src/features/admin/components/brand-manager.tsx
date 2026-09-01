"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Eye, EyeOff, Check, Pencil, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { adminFetch } from "@/features/admin/lib/mutate";
import { IconUpload } from "./icon-upload";
import type { BrandOption } from "@/lib/types";

/**
 * Брэнд CRUD (0050_brands.sql).
 *
 * Renaming here rewrites `products.brand` on every product pointing at the row
 * — the database does it in a trigger — so this page is the one place a brand
 * name is spelled. That is the whole reason the table exists: as free text,
 * «Tom ford» and «Tom Ford» were two houses in the catalog filter.
 *
 * There is no delete, for the same reason as the scent families: hiding takes
 * a brand out of the product picker while every product that used it keeps its
 * name and its history.
 */
export function BrandManager({ brands }: { brands: BrandOption[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<string | null>(null);
  const [draftName, setDraftName] = React.useState("");

  async function send(url: string, init: RequestInit) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await adminFetch(url, {
        headers: { "Content-Type": "application/json" },
        ...init,
      });
      if (!res.ok) {
        if (res.demo) {
          setMsg("Demo горим: Supabase холбогдсоны дараа хадгалагдана.");
          return false;
        }
        const known = Object.entries({
          DUPLICATE: "Энэ брэнд аль хэдийн бүртгэлтэй байна.",
          BAD_NAME: "Нэрийг латин үсгээр бичнэ үү.",
          NOT_MIGRATED:
            "Өгөгдлийн сан бэлэн биш байна — 0050_brands.sql migration ажиллуулаагүй байна.",
        }).find(([code]) => res.error.includes(code));
        setMsg(known ? known[1] : res.error);
        return false;
      }
      router.refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const ok = await send("/api/admin/brands", {
      method: "POST",
      body: JSON.stringify({ name: name.trim(), logoUrl }),
    });
    if (ok) {
      setName("");
      setLogoUrl(null);
    }
  }

  async function patch(b: BrandOption, body: Record<string, unknown>) {
    return send(`/api/admin/brands/${b.id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  async function saveName(b: BrandOption) {
    const next = draftName.trim();
    if (!next || next === b.name) {
      setEditing(null);
      return;
    }
    if (await patch(b, { name: next })) setEditing(null);
  }

  return (
    <div className="space-y-6">
      {msg && (
        <p className="bg-secondary rounded-md px-4 py-3 text-sm">{msg}</p>
      )}

      <Card>
        <CardContent className="p-0">
          <ul className="[&>li:nth-child(even)]:bg-muted/40">
            {brands.map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-4 py-3">
                {/* The logo writes through on pick: it is one field, and a
                    separate save step would only be a way to lose it. */}
                <IconUpload
                  size={40}
                  label={`${b.name} лого`}
                  value={b.logoUrl}
                  onChange={(url) => patch(b, { logoUrl: url })}
                  allowClear={false}
                  folder="brands"
                />

                <span className="min-w-0 flex-1">
                  {editing === b.id ? (
                    <span className="flex items-center gap-2">
                      <Input
                        autoFocus
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveName(b);
                          if (e.key === "Escape") setEditing(null);
                        }}
                        className="h-8 max-w-xs"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => saveName(b)}
                        aria-label="Хадгалах"
                      >
                        <Check className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => setEditing(null)}
                        aria-label="Болих"
                      >
                        <X className="size-4" />
                      </Button>
                    </span>
                  ) : (
                    <>
                      <span className="block truncate text-sm font-medium">
                        {b.name}
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {b.slug}
                        {!b.isActive && " · нуугдсан"}
                      </span>
                    </>
                  )}
                </span>

                {editing !== b.id && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={busy}
                    onClick={() => {
                      setEditing(b.id);
                      setDraftName(b.name);
                    }}
                    aria-label="Нэр засах"
                    title="Нэр засах — бүх бараан дээр шинэчлэгдэнэ"
                  >
                    <Pencil className="size-4" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={busy}
                  onClick={() => patch(b, { isActive: !b.isActive })}
                  aria-label={b.isActive ? "Нуух" : "Харуулах"}
                  title={
                    b.isActive
                      ? "Барааны маягтаас нуух (бараанууд хэвээр)"
                      : "Маягтад буцаан харуулах"
                  }
                >
                  {b.isActive ? (
                    <Eye className="size-4" />
                  ) : (
                    <EyeOff className="text-muted-foreground size-4" />
                  )}
                </Button>
              </li>
            ))}
            {brands.length === 0 && (
              <li className="text-muted-foreground px-4 py-6 text-center text-sm">
                Одоогоор брэнд алга.
              </li>
            )}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="font-serif text-lg font-semibold">Шинэ брэнд нэмэх</h2>
          <form onSubmit={add} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Нэр</Label>
                <Input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Dior"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Лого (заавал биш)</Label>
                <IconUpload
                  value={logoUrl}
                  onChange={setLogoUrl}
                  label="Лого"
                  size={56}
                  folder="brands"
                />
              </div>
            </div>
            <p className="text-muted-foreground text-xs">
              Slug нэрнээс автоматаар үүснэ. Барааны маягт дээрээс ч шууд шинэ
              брэнд нэмж болно.
            </p>
            <Button type="submit" disabled={busy || !name.trim()}>
              <Plus className="mr-1 size-4" />
              Нэмэх
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
