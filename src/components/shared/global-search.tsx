"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/format";
import type { ProductListItem } from "@/lib/types";

/**
 * Site-wide type-ahead search (requirement_fb.md §"Таг"): results appear as
 * you type, no Enter needed — "To" already surfaces Tom Ford. Enter jumps to
 * the full catalog results for the same term.
 *
 * Built on Radix Dialog so the palette gets focus trapping, scroll locking,
 * Escape/outside-click dismissal and `aria-modal` semantics for free.
 */
export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState("");
  const [items, setItems] = React.useState<ProductListItem[]>([]);
  const [loading, setLoading] = React.useState(false);

  // ⌘K / Ctrl+K opens the palette from anywhere.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    if (!open) {
      setValue("");
      setItems([]);
    }
  }, [open]);

  // Debounced lookup; a stale-response guard keeps out-of-order replies from
  // overwriting newer results.
  React.useEffect(() => {
    const term = value.trim();
    if (!term) {
      setItems([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/products?q=${encodeURIComponent(term)}&limit=6`,
        );
        const data = await res.json();
        if (!cancelled) setItems(data.items ?? []);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [value]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const term = value.trim();
    if (!term) return;
    setOpen(false);
    router.push(`/catalog?q=${encodeURIComponent(term)}`);
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        aria-label="Хайх"
        className="text-muted-foreground hover:bg-secondary hover:text-foreground flex size-9 items-center justify-center rounded-full transition-colors"
      >
        <Search className="size-5" />
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        {/* Spotlight-style scrim: heavy blur carries the separation, with only
            a whisper of dim so the artwork behind keeps its colour. */}
        <DialogPrimitive.Overlay className="data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/20 backdrop-blur-xl duration-200" />

        <DialogPrimitive.Content className="border-border/60 bg-card data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[12vh] left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border shadow-2xl duration-200">
          <DialogPrimitive.Title className="sr-only">
            Хайлт
          </DialogPrimitive.Title>

          <form onSubmit={submit} className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2" />
            <Input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Үнэртэн, брэнд хайх…"
              aria-label="Хайх"
              className="h-14 border-0 bg-transparent px-11 text-base focus-visible:ring-0"
            />
            <DialogPrimitive.Close
              aria-label="Хаах"
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
            >
              <X className="size-5" />
            </DialogPrimitive.Close>
          </form>

          {value.trim() && (
            <div className="border-border max-h-[60vh] overflow-y-auto border-t">
              {items.length === 0 ? (
                <p className="text-muted-foreground px-4 py-6 text-center text-sm">
                  {loading ? "Хайж байна…" : "Илэрц олдсонгүй"}
                </p>
              ) : (
                <>
                  {items.map((p) => (
                    <Link
                      key={p.id}
                      href={`/products/${p.slug}`}
                      onClick={() => setOpen(false)}
                      className="hover:bg-accent flex items-center gap-3 px-4 py-3 transition-colors"
                    >
                      <span className="bg-muted relative size-12 shrink-0 overflow-hidden rounded-lg">
                        {p.image && (
                          <Image
                            src={p.image.url}
                            alt={p.name}
                            fill
                            sizes="48px"
                            className="object-cover"
                          />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {p.name}
                        </span>
                        <span className="text-muted-foreground block text-xs tracking-wide uppercase">
                          {p.brand}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm">
                        {p.soldOut ? "Дууссан" : formatPrice(p.startingPrice)}
                      </span>
                    </Link>
                  ))}
                  <button
                    onClick={submit}
                    className="border-border text-muted-foreground hover:bg-accent hover:text-foreground w-full border-t px-4 py-3 text-sm"
                  >
                    Бүх илэрцийг харах →
                  </button>
                </>
              )}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
