"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import Fuse from "fuse.js";
import { groupFaqs, type FaqItem } from "@/features/faq/seed";
import { normalizeSearchText } from "@/lib/search";

/**
 * Rich-text answers arrive pre-sanitized from the server page (lib/sanitize
 * is server-only), so rendering them with innerHTML here is safe. Legacy
 * plain-text answers render as before.
 */
function stripTags(html: string): string {
  return html.replace(/<[^>]*>/gu, " ");
}

function Answer({ answer }: { answer: string }) {
  if (/^\s*</u.test(answer)) {
    return (
      <div
        className="prose max-w-none text-sm"
        dangerouslySetInnerHTML={{ __html: answer }}
      />
    );
  }
  return <>{answer}</>;
}

export function FaqSearch({ items }: { items: FaqItem[] }) {
  const [query, setQuery] = React.useState("");

  // Fuzzy search (fuse.js): typo-tolerant, transliteration-aware through
  // normalizeSearchText, so a slightly misspelled question still surfaces.
  const fuse = React.useMemo(
    () =>
      new Fuse(items, {
        keys: [
          {
            name: "question",
            weight: 2,
            getFn: (i) => normalizeSearchText(i.question),
          },
          {
            name: "answer",
            getFn: (i) => normalizeSearchText(stripTags(i.answer)),
          },
          {
            name: "category",
            getFn: (i) => normalizeSearchText(i.category),
          },
        ],
        threshold: 0.35,
        ignoreLocation: true,
      }),
    [items],
  );

  const filtered = React.useMemo(() => {
    const q = query.trim();
    if (!q) return items;
    return fuse.search(normalizeSearchText(q)).map((r) => r.item);
  }, [items, fuse, query]);

  const groups = groupFaqs(filtered);

  return (
    <div>
      <div className="relative mt-8">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Асуултаар хайх…"
          className="pl-9"
        />
      </div>

      {groups.length === 0 ? (
        <p className="text-muted-foreground mt-12 text-center text-sm">
          «{query}» — илэрц олдсонгүй.
        </p>
      ) : (
        <div className="mt-10 space-y-10">
          {groups.map((g) => (
            <div key={g.title}>
              <h2 className="mb-2 font-serif text-xl font-semibold">
                {g.title}
              </h2>
              <Accordion type="single" collapsible>
                {g.items.map((item, i) => (
                  <AccordionItem key={i} value={`${g.title}-${i}`}>
                    <AccordionTrigger>{item.question}</AccordionTrigger>
                    <AccordionContent>
                      <Answer answer={item.answer} />
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
