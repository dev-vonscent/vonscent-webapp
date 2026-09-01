"use client";

import * as React from "react";
import { Loader2, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { adminFetch } from "@/features/admin/lib/mutate";
import type { CustomTagOption } from "@/features/taxonomy/api";

/**
 * Add a Нэмэлт таг without leaving the product.
 *
 * The pool is admin-managed, so until now the only way to coin a tag was the
 * Нэмэлт таг page — which meant abandoning a half-filled product form to get
 * there. The tag is created and ticked in one action here instead.
 */
export function AddCustomTag({
  pool,
  onCreated,
}: {
  pool: CustomTagOption[];
  /** Called with the new (or already-existing) tag, which the caller selects. */
  onCreated: (tag: CustomTagOption) => void;
}) {
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const duplicate = React.useMemo(
    () =>
      pool.find(
        (t) => t.name.trim().toLowerCase() === name.trim().toLowerCase(),
      ) ?? null,
    [pool, name],
  );

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed || busy) return;

    // Retyping a tag that exists is not an error — it is the tag they meant.
    if (duplicate) {
      onCreated(duplicate);
      setName("");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await adminFetch<{ tag?: CustomTagOption }>(
        "/api/admin/custom-tags",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        },
      );
      if (!res.ok) {
        setError(
          res.demo
            ? "Demo горим: Supabase холбогдсоны дараа хадгалагдана."
            : res.error.includes("DUPLICATE")
              ? "Энэ таг бүртгэлтэй байна."
              : res.error.includes("VALIDATION")
                ? "Нэр буруу байна."
                : res.error,
        );
        return;
      }
      if (res.data?.tag) {
        onCreated(res.data.tag);
        setName("");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          // Enter must not reach the product form, which would save the whole
          // product instead of adding the tag.
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Шинэ таг нэмэх…"
          aria-label="Шинэ нэмэлт таг"
        />
        <Button
          type="button"
          size="icon"
          variant="secondary"
          disabled={busy || !name.trim()}
          onClick={submit}
          aria-label="Таг нэмэх"
          title={duplicate ? "Бүртгэлтэй таг — сонгоно" : "Таг нэмэх"}
          className="shrink-0"
        >
          {/* The request is the one part of this with any latency, and the
              button is where the click landed — so the wait is shown there,
              swapping the icon rather than adding to it so the button keeps
              its size. */}
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
        </Button>
      </div>
      {duplicate && (
        <p className="text-muted-foreground text-xs">
          «{duplicate.name}» бүртгэлтэй байна — нэмэхэд түүнийг сонгоно.
        </p>
      )}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
