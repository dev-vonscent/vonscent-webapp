"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { GiftSettings } from "@/features/content/api";
import { adminFetch } from "@/features/admin/lib/mutate";
import { useProductOptions } from "@/features/admin/hooks/use-product-options";
import {
  PRODUCT_OPTION_MAX,
  type ProductOption,
} from "@/features/admin/lib/product-option";

const MIN_POOL = 6;
const MAX_POOL = 8;

/**
 * Бэлгийн үнэрүүд — бүх бэлэг (захиалгын 200,000₮ тутамд 1) зөвхөн энэ сангаас
 * гарна (backlog A2). 6–8 ус сонгохыг зөвлөнө; сар бүр солих үүрэггүй.
 */
export function GiftPoolManager({
  options,
  initial,
  total: totalProducts,
}: {
  /** Сонгогдсон бараа + бүх каталог (`PRODUCT_OPTION_MAX`). */
  options: ProductOption[];
  initial: GiftSettings;
  /** Каталогийн нийт бараа — жагсаалт бүтэн эсэхийг хэлнэ. */
  total?: number;
}) {
  // Бэлгийн ус сонгоход бүх каталог харагдана — хайлт нь шүүлт болохоос
  // жагсаалтыг нээх нөхцөл биш.
  const { q, setQ, items, loading, byId } = useProductOptions(
    options,
    PRODUCT_OPTION_MAX,
  );
  // Сервер тоог өгөөгүй бол ирсэн жагсаалтаараа л хэлнэ.
  const total = totalProducts ?? options.length;
  const [enabled, setEnabled] = React.useState(initial.enabled);
  const [ids, setIds] = React.useState<string[]>(initial.productIds);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  function toggle(id: string) {
    setIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= MAX_POOL
          ? prev
          : [...prev, id],
    );
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await adminFetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "gift",
          value: { enabled, productIds: ids },
        }),
      });
      setMsg(
        res.ok
          ? "Хадгалагдлаа."
          : res.demo
            ? "Demo горим: Supabase холбогдсоны дараа хадгалагдана."
            : res.error,
      );
    } finally {
      setSaving(false);
    }
  }

  // Худалдан авагч талд /api/gifts зөвхөн ИДЭВХТЭЙ, 1мл гаргах үлдэгдэлтэй
  // барааг харуулдаг. Сонгосон мөртөө тэр шүүлтэд унасан ус чимээгүй алга
  // болвол админ «5 сонгосон, 4 харагдаж байна» гэж эргэлзэнэ — тул энд
  // нэрлэж хэлнэ.
  const hidden = ids
    .map((id) => byId(id))
    .filter((p): p is ProductOption =>
      p ? !p.isActive || p.availableMl < 1 : false,
    );
  // Устгагдсан бараа ч санд үлдэж болно — түүнийг ч «харагдах» гэж тоолохгүй.
  const missing = ids.filter((id) => !byId(id)).length;
  const visibleCount = ids.length - hidden.length - missing;

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={enabled}
              onCheckedChange={(v) => setEnabled(Boolean(v))}
            />
            Бэлгийн систем идэвхтэй
          </label>
          <p className="text-muted-foreground text-sm">
            Сонгосон: <strong>{ids.length}</strong> / {MAX_POOL}
            {hidden.length + missing > 0 && (
              <>
                {" "}
                · харагдах: <strong>{visibleCount}</strong>
              </>
            )}
            {enabled && visibleCount > 0 && visibleCount < MIN_POOL && (
              <span className="text-destructive ml-2">
                (санал болгох доод хэмжээ {MIN_POOL})
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Нэр, брэндээр хайх…"
            className="max-w-sm"
          />
          {/* Каталогийн нийт тоо — «бүх ус энд байна уу?» гэдгийг жагсаалт
              өөрөө хэлж чаддаггүй. */}
          <p className="text-muted-foreground text-xs tabular-nums">
            Нийт: {total}
          </p>
        </div>

        {/* Бүх бараа энд байна (хайлт нь зөвхөн шүүнэ). Жагсаалт нь өөрөө
            гүйнэ — доорх хайрцгийн өндөр хязгаартай. */}
        <div
          className={`bg-muted/40 max-h-112 overflow-y-auto rounded-lg transition-opacity ${
            loading ? "opacity-60" : ""
          }`}
          aria-busy={loading}
        >
          <ul className="[&>li:nth-child(even)]:bg-muted/40">
            {items.map((p) => {
              const checked = ids.includes(p.id);
              // Идэвхгүй / үлдэгдэлгүй усыг шинээр нэмүүлэхгүй — сонгосон ч
              // худалдан авагчид харагдахгүй тул сан хуурамчаар дүүрнэ.
              const unusable = !p.isActive || p.availableMl < 1;
              const disabled = !checked && (ids.length >= MAX_POOL || unusable);
              return (
                <li key={p.id}>
                  <label
                    className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm ${
                      disabled ? "opacity-50" : ""
                    }`}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={disabled}
                      onCheckedChange={() => toggle(p.id)}
                    />
                    <span className="flex-1">
                      <span className="text-muted-foreground mr-2 text-xs uppercase">
                        {p.brand}
                      </span>
                      {p.name}
                    </span>
                    <span
                      className={`text-xs ${
                        unusable ? "text-destructive" : "text-muted-foreground"
                      }`}
                    >
                      {p.availableMl}ml үлдэгдэл
                      {!p.isActive && " · идэвхгүй"}
                    </span>
                  </label>
                </li>
              );
            })}
            {items.length === 0 && (
              <li className="text-muted-foreground px-3 py-4 text-sm">
                {loading ? "Хайж байна…" : "Илэрц алга."}
              </li>
            )}
          </ul>
        </div>

        {hidden.length > 0 && (
          <div className="border-destructive/40 bg-destructive/10 space-y-1 rounded-md border px-3 py-2 text-sm">
            <p className="font-medium">
              Доорх {hidden.length} ус сонгогдсон ч худалдан авагчид
              харагдахгүй:
            </p>
            <ul className="space-y-0.5">
              {hidden.map((p) => (
                <li key={p.id}>
                  • {p.brand} — {p.name} (
                  {!p.isActive ? "идэвхгүй бараа" : "1мл гаргах үлдэгдэлгүй"})
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground">
              Барааг идэвхжүүлэх, эсвэл сангаас хасаад өөр ус сонгоно уу.
            </p>
          </div>
        )}

        {enabled && visibleCount === 0 && (
          <p className="bg-secondary rounded-md px-3 py-2 text-sm">
            Санд харагдах ус алга — идэвхтэй, үлдэгдэлтэй ус сонгох хүртэл
            худалдан авагчид бэлгийн сонголт огт гарахгүй.
          </p>
        )}

        {msg && (
          <p className="bg-secondary rounded-md px-3 py-2 text-sm">{msg}</p>
        )}
        <Button onClick={save} disabled={saving}>
          {saving ? "Хадгалж байна…" : "Хадгалах"}
        </Button>
      </CardContent>
    </Card>
  );
}
