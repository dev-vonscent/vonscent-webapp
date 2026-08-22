"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { GiftSettings } from "@/features/content/api";

const MAX_POOL = 8;

interface GiftProductOption {
  id: string;
  name: string;
  brand: string;
  availableMl: number;
  isActive: boolean;
}

/** Pick this month's 4–8 giftable perfumes and save them to settings.gift. */
export function GiftPoolManager({
  products,
  initial,
}: {
  products: GiftProductOption[];
  initial: GiftSettings;
}) {
  const [enabled, setEnabled] = React.useState(initial.enabled);
  const [ids, setIds] = React.useState<string[]>(initial.productIds);
  const [q, setQ] = React.useState("");
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
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "gift",
          value: { enabled, productIds: ids },
        }),
      });
      const data = await res.json().catch(() => null);
      setMsg(
        res.ok
          ? data?.demo
            ? "Demo горим: Supabase холбогдсоны дараа хадгалагдана."
            : "Хадгалагдлаа."
          : "Алдаа гарлаа.",
      );
    } finally {
      setSaving(false);
    }
  }

  const query = q.trim().toLowerCase();
  const filtered = query
    ? products.filter((p) =>
        `${p.brand} ${p.name}`.toLowerCase().includes(query),
      )
    : products;

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
          </p>
        </div>

        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Нэр, брэндээр хайх…"
          className="max-w-sm"
        />

        <div className="border-border max-h-[28rem] overflow-y-auto rounded-lg border">
          <ul className="divide-border divide-y">
            {filtered.map((p) => {
              const checked = ids.includes(p.id);
              const disabled =
                !checked && (ids.length >= MAX_POOL || p.availableMl < 1);
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
                    <span className="text-muted-foreground text-xs">
                      {p.availableMl}ml үлдэгдэл
                      {!p.isActive && " · идэвхгүй"}
                    </span>
                  </label>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="text-muted-foreground px-3 py-4 text-sm">
                Илэрц алга.
              </li>
            )}
          </ul>
        </div>

        {msg && <p className="bg-secondary rounded-md px-3 py-2 text-sm">{msg}</p>}
        <Button onClick={save} disabled={saving}>
          {saving ? "Хадгалж байна…" : "Хадгалах"}
        </Button>
      </CardContent>
    </Card>
  );
}
