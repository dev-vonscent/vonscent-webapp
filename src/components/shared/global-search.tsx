"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as Sentry from "@sentry/nextjs";
import { Command } from "cmdk";
import { BookOpen, Layers, Search, Sparkles, Tag, X } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { MIN_SEARCH_LENGTH } from "@/lib/constants";
import { isSearchable } from "@/lib/search";
import {
  EMPTY_SEARCH_RESULTS,
  SEARCH_KINDS,
  SEARCH_KIND_LABEL,
  totalHits,
  type SearchHit,
  type SearchKind,
  type SearchResults,
} from "@/features/search/types";

/**
 * Site-wide type-ahead search (requirement_fb.md §"Таг", backlog H1): results
 * appear as you type, no Enter needed — "To" already surfaces Tom Ford. Enter
 * opens the highlighted row (↑/↓ to move); "Бүх илэрц" jumps to the catalog.
 *
 * Since H1 the search covers four kinds — үнэртэн, багц, нийтлэл, брэнд — and
 * shows them in labelled groups, so a hit for a bundle is never mistaken for a
 * bottle. Filtering happens in Postgres (`/api/search` → `global_search()`);
 * nothing here loads a catalogue to filter it.
 *
 * Radix Dialog supplies focus trapping, scroll locking and dismissal; cmdk
 * supplies listbox semantics and keyboard navigation. Filtering stays on the
 * server (`shouldFilter={false}`) — cmdk only handles selection.
 */

const KIND_ICON: Record<
  SearchKind,
  React.ComponentType<{ className?: string }>
> = {
  product: Sparkles,
  collection: Layers,
  post: BookOpen,
  brand: Tag,
};

/** Right-hand meta line: the one number that matters for this kind. */
function hitMeta(hit: SearchHit): string | null {
  if (hit.kind === "product") {
    return hit.soldOut ? "Дууссан" : formatPrice(hit.price ?? 0);
  }
  if (hit.itemCount != null && hit.itemCount > 0) {
    return hit.kind === "brand"
      ? `${hit.itemCount} үнэртэн`
      : `${hit.itemCount} бүрэлдэхүүн`;
  }
  return null;
}

function HitThumb({ hit }: { hit: SearchHit }) {
  const Icon = KIND_ICON[hit.kind];
  return (
    <span className="bg-muted relative size-12 shrink-0 overflow-hidden rounded-lg">
      {hit.imageUrl ? (
        <Image
          src={hit.imageUrl}
          alt={hit.title}
          fill
          sizes="48px"
          // Брэндийн лого ихэвчлэн ил захтай — тайрахгүй багтаана. Лого нь
          // тунгалаг дээрх хар зураг тул dark mode-д `brand-logo` (globals.css)
          // урвуулж харагдуулна.
          className={
            hit.kind === "brand"
              ? "brand-logo object-contain p-1.5"
              : "object-cover"
          }
        />
      ) : (
        <Icon className="text-muted-foreground absolute top-1/2 left-1/2 size-5 -translate-1/2" />
      )}
    </span>
  );
}

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState("");
  const [results, setResults] =
    React.useState<SearchResults>(EMPTY_SEARCH_RESULTS);
  const [loading, setLoading] = React.useState(false);

  const ready = isSearchable(value);
  const count = totalHits(results);

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
      setResults(EMPTY_SEARCH_RESULTS);
    }
  }, [open]);

  // Debounced lookup; a stale-response guard keeps out-of-order replies from
  // overwriting newer results. Below MIN_SEARCH_LENGTH nothing is requested at
  // all — one letter matches half the shop and answers nothing (H1.3).
  React.useEffect(() => {
    if (!ready) {
      setResults(EMPTY_SEARCH_RESULTS);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(value.trim())}`,
        );
        const data = await res.json();
        if (!cancelled) setResults(data.results ?? EMPTY_SEARCH_RESULTS);
      } catch (err) {
        Sentry.captureException(err);
        if (!cancelled) setResults(EMPTY_SEARCH_RESULTS);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [value, ready]);

  function goTo(path: string) {
    setOpen(false);
    router.push(path);
  }

  function goToCatalog() {
    const term = value.trim();
    if (!term) return;
    goTo(`/catalog?q=${encodeURIComponent(term)}`);
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

          <Command shouldFilter={false} label="Хайлт">
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2" />
              <Command.Input
                autoFocus
                value={value}
                onValueChange={setValue}
                placeholder="Үнэртэн, багц, брэнд, нийтлэл хайх…"
                className="placeholder:text-muted-foreground h-14 w-full border-0 bg-transparent px-11 text-base"
              />
              <DialogPrimitive.Close
                aria-label="Хаах"
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
              >
                <X className="size-5" />
              </DialogPrimitive.Close>
            </div>

            {value.trim() && !ready && (
              <p className="text-muted-foreground border-border border-t px-4 py-6 text-center text-sm">
                Хайлт {MIN_SEARCH_LENGTH} тэмдэгтээс эхэлнэ — цааш нь бичээрэй.
              </p>
            )}

            {ready && (
              <Command.List className="border-border max-h-[60vh] overflow-y-auto border-t">
                <Command.Empty className="text-muted-foreground px-4 py-6 text-center text-sm">
                  {loading
                    ? "Хайж байна…"
                    : `«${value.trim()}» гэсэн юу ч олдсонгүй. Брэнд эсвэл үнэрийн нэрээр оролдож үзээрэй.`}
                </Command.Empty>

                {SEARCH_KINDS.map((kind) =>
                  results[kind].length === 0 ? null : (
                    <Command.Group
                      key={kind}
                      heading={SEARCH_KIND_LABEL[kind]}
                      className="**:[[cmdk-group-heading]]:text-muted-foreground **:[[cmdk-group-heading]]:px-4 **:[[cmdk-group-heading]]:pt-3 **:[[cmdk-group-heading]]:pb-1 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:tracking-wide **:[[cmdk-group-heading]]:uppercase"
                    >
                      {results[kind].map((hit) => {
                        const meta = hitMeta(hit);
                        return (
                          <Command.Item
                            key={`${hit.kind}-${hit.id}`}
                            value={`${hit.kind}-${hit.id}`}
                            onSelect={() => goTo(hit.href)}
                            className="data-[selected=true]:bg-accent flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors"
                          >
                            <HitThumb hit={hit} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">
                                {hit.title}
                              </span>
                              {hit.subtitle && (
                                <span className="text-muted-foreground block truncate text-xs tracking-wide uppercase">
                                  {hit.subtitle}
                                </span>
                              )}
                            </span>
                            {meta && (
                              <span className="text-muted-foreground shrink-0 text-sm">
                                {meta}
                              </span>
                            )}
                          </Command.Item>
                        );
                      })}
                    </Command.Group>
                  ),
                )}

                {count > 0 && (
                  <Command.Item
                    value="show-all"
                    onSelect={goToCatalog}
                    className="border-border text-muted-foreground data-[selected=true]:bg-accent data-[selected=true]:text-foreground mt-1 w-full cursor-pointer border-t px-4 py-3 text-center text-sm"
                  >
                    Каталогоос бүх илэрцийг харах →
                  </Command.Item>
                )}
              </Command.List>
            )}
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
