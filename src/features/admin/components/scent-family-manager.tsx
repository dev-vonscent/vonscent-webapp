"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { IconUpload } from "./icon-upload";
import type { ScentFamilyOption } from "@/lib/types";

/**
 * Үнэрийн төрөл CRUD. Adding a row here makes the family selectable on the
 * product form; once a product carries it, the chip appears in the catalog
 * filter. There is no hard delete: hiding (is_active=false) is the removal
 * story, so product tags survive and a family can always be brought back.
 */
export function ScentFamilyManager({
  families,
}: {
  families: ScentFamilyOption[];
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [slug, setSlug] = React.useState("");
  const [label, setLabel] = React.useState("");
  const [iconUrl, setIconUrl] = React.useState("");

  async function send(url: string, init: RequestInit) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        ...init,
      });
      const data = await res.json().catch(() => ({}));
      if (data.demo) {
        setMsg("Demo горим: Supabase холбогдсоны дараа хадгалагдана.");
        return false;
      }
      if (!res.ok) {
        setMsg(
          {
            DUPLICATE: "Энэ slug аль хэдийн бүртгэлтэй байна.",
            NOT_MIGRATED:
              "Өгөгдлийн сан бэлэн биш байна — 0018_scent_families.sql migration ажиллуулаагүй тул доорх жагсаалт зөвхөн үндсэн утгууд. (docs/todo.md B3b)",
          }[data.error as string] ?? "Алдаа гарлаа.",
        );
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
    const ok = await send("/api/admin/scent-families", {
      method: "POST",
      body: JSON.stringify({
        slug: slug.trim(),
        label: label.trim(),
        iconUrl: iconUrl.trim() || null,
        sortOrder: families.length + 1,
      }),
    });
    if (ok) {
      setSlug("");
      setLabel("");
      setIconUrl("");
    }
  }

  async function setIcon(f: ScentFamilyOption, url: string | null) {
    await send(`/api/admin/scent-families/${f.slug}`, {
      method: "PATCH",
      body: JSON.stringify({ iconUrl: url }),
    });
  }

  async function toggleActive(f: ScentFamilyOption) {
    await send(`/api/admin/scent-families/${f.slug}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: !f.isActive }),
    });
  }

  return (
    <div className="space-y-6">
      {/* Feedback lives above the list — at the bottom it scrolls out of view
          and a failed/demo-mode click looks like the button did nothing. */}
      {msg && (
        <p className="rounded-md bg-secondary px-4 py-3 text-sm">{msg}</p>
      )}
      <Card>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {families.map((f) => (
              <li key={f.slug} className="flex items-center gap-3 px-4 py-3">
                {/* Uploading writes straight through: an icon is one field, so
                    a separate save step would only be a way to lose it. */}
                <IconUpload
                  size={36}
                  label={`${f.label} дүрс`}
                  value={f.iconUrl}
                  onChange={(url) => setIcon(f, url)}
                  allowClear={false}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {f.label}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {f.slug}
                    {!f.isActive && " · нуугдсан"}
                  </span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={busy}
                  onClick={() => toggleActive(f)}
                  aria-label={f.isActive ? "Нуух" : "Харуулах"}
                  title={
                    f.isActive
                      ? "Шүүлтүүрээс нуух (бараанууд хэвээр)"
                      : "Шүүлтүүрт буцаан харуулах"
                  }
                >
                  {f.isActive ? (
                    <Eye className="size-4" />
                  ) : (
                    <EyeOff className="size-4 text-muted-foreground" />
                  )}
                </Button>
              </li>
            ))}
            {families.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                Одоогоор үнэрийн төрөл алга.
              </li>
            )}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="font-serif text-lg font-semibold">Шинэ төрөл нэмэх</h2>
          <form onSubmit={add} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Нэр</Label>
                <Input
                  required
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Гурмет"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Slug (латинаар)</Label>
                <Input
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  pattern="[a-z0-9-]+"
                  placeholder="gourmand"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Дүрс (заавал биш)</Label>
                <IconUpload
                  value={iconUrl || null}
                  onChange={(url) => setIconUrl(url ?? "")}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Slug нь хаягийн мөрөнд ашиглагдана (/catalog?family=gourmand)
              тул үүсгэсний дараа өөрчлөгдөхгүй.
            </p>
            <Button type="submit" disabled={busy}>
              <Plus className="mr-1 size-4" />
              Нэмэх
            </Button>
          </form>
        </CardContent>
      </Card>

    </div>
  );
}
