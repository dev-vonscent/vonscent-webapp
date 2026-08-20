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
import { groupFaqs, type FaqItem } from "@/features/faq/seed";

export function FaqSearch({ items }: { items: FaqItem[] }) {
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.question.toLowerCase().includes(q) ||
        i.answer.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q),
    );
  }, [items, query]);

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
                    <AccordionContent>{item.answer}</AccordionContent>
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
