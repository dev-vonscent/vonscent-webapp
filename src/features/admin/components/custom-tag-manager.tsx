"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { adminFetch, mutate } from "@/features/admin/lib/mutate";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { toast } from "@/lib/toast";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { CustomTagOption } from "@/features/taxonomy/api";

/** Add / remove entries of the free-form internal tag pool. */
export function CustomTagManager({ tags }: { tags: CustomTagOption[] }) {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await adminFetch("/api/admin/custom-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        // The route answers 409 with DUPLICATE for a name that already exists.
        setMsg(
          res.error.includes("DUPLICATE")
            ? "Ийм таг аль хэдийн байна."
            : res.error,
        );
        return;
      }
      setName("");
      toast.success("Таг нэмэгдлээ.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, tagName: string) {
    if (
      !(await confirm({
        title: `«${tagName}» тагийг устгах уу?`,
        description:
          "Таг бүх бараанаас хасагдана. Хайлт, quiz-д ашиглагдаж байсан бол тэнд ч алга болно.",
        confirmLabel: "Устгах",
        destructive: true,
      }))
    )
      return;
    if (
      !(await mutate(
        `/api/admin/custom-tags/${id}`,
        { method: "DELETE" },
        "Таг устсангүй",
      ))
    )
      return;
    toast.success("Таг устлаа.");
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        {confirmDialog}
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
        {msg && (
          <p className="bg-secondary rounded-md px-3 py-2 text-sm">{msg}</p>
        )}

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
                  onClick={() => remove(t.id, t.name)}
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
