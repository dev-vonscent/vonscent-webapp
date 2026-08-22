"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { CustomTagOption } from "@/features/taxonomy/api";

/** Add / remove entries of the free-form internal tag pool. */
export function CustomTagManager({ tags }: { tags: CustomTagOption[] }) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/custom-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (data?.demo) {
        setMsg("Demo горим: Supabase холбогдсоны дараа хадгалагдана.");
      } else if (res.status === 409) {
        setMsg("Ийм таг аль хэдийн байна.");
      } else if (!res.ok) {
        setMsg("Алдаа гарлаа.");
      } else {
        setName("");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/admin/custom-tags/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <form onSubmit={add} className="flex max-w-md gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Жишээ: оффис, үдэш, бэлэг…"
          />
          <Button type="submit" disabled={busy}>
            Нэмэх
          </Button>
        </form>
        {msg && <p className="bg-secondary rounded-md px-3 py-2 text-sm">{msg}</p>}

        {tags.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Одоогоор таг алга — client-ээс ирэх жагсаалтыг эндээс оруулна.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <li
                key={t.id}
                className="bg-secondary flex items-center gap-2 rounded-full px-3 py-1.5 text-sm"
              >
                {t.name}
                <button
                  onClick={() => remove(t.id)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`${t.name} таг устгах`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
