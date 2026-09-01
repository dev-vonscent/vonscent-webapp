"use client";

import * as React from "react";
import { MultiCheck } from "./multi-check";
import { AddCustomTag } from "./add-custom-tag";
import { CustomTagActions } from "./custom-tag-actions";
import type { CustomTagOption } from "@/features/taxonomy/api";

/**
 * The Нэмэлт таг control on both product forms: pick from the pool, add to it,
 * rename or delete an entry — without leaving the product.
 *
 * One component rather than the same forty lines in `product-form` and
 * `product-edit-form`, because the fiddly parts (re-ticking a tag whose slug
 * changed under a rename, un-ticking one that was deleted) are exactly what
 * drifts apart when copied.
 *
 * The pool is owned here. It arrives as a server prop, but adding, renaming
 * and deleting all have to show up in the grid immediately rather than after a
 * refresh, so the prop is the seed and this holds the live copy.
 */
export function CustomTagField({
  pool: initialPool,
  selected,
  onToggle,
}: {
  pool: CustomTagOption[];
  selected: string[];
  onToggle: (slug: string) => void;
}) {
  const [pool, setPool] = React.useState(initialPool);
  React.useEffect(() => setPool(initialPool), [initialPool]);

  return (
    <div className="space-y-3">
      <MultiCheck
        label="Нэмэлт таг (дотоод — хайлт, quiz-д ашиглагдана)"
        options={pool.map((t) => ({ value: t.slug, label: t.name }))}
        selected={selected}
        onToggle={onToggle}
        empty="Одоогоор таг алга — доороос нэмнэ үү."
        renderAction={(o) => {
          const tag = pool.find((t) => t.slug === o.value);
          if (!tag) return null;
          return (
            <CustomTagActions
              tag={tag}
              onRenamed={(next) => {
                setPool((prev) =>
                  prev.map((t) => (t.id === next.id ? next : t)),
                );
                // A rename re-derives the slug, and the selection is a list of
                // slugs — without moving it across, a ticked tag would be
                // dropped on save without saying so.
                if (selected.includes(tag.slug)) {
                  onToggle(tag.slug);
                  onToggle(next.slug);
                }
              }}
              onDeleted={(gone) => {
                setPool((prev) => prev.filter((t) => t.id !== gone.id));
                if (selected.includes(gone.slug)) onToggle(gone.slug);
              }}
            />
          );
        }}
      />
      <AddCustomTag
        pool={pool}
        onCreated={(tag) => {
          setPool((prev) =>
            prev.some((t) => t.id === tag.id)
              ? prev
              : [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)),
          );
          // Coining a tag while editing a product means you want it on that
          // product; ticking it is the point of doing it here.
          if (!selected.includes(tag.slug)) onToggle(tag.slug);
        }}
      />
    </div>
  );
}
