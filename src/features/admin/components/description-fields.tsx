"use client";

import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

/**
 * The description parts the client asked for (todo.md B3, requirement_fb.md).
 * Shared by the create and edit forms so both stay in the same order and carry
 * the same guidance.
 *
 * Дөрөв дэх «Товч тайлбар» хэсэг АВАГДСАН (клиентийн шийдвэр, 2026-09-13):
 * хайлт, хуваалцах линкийн тайлбар нь ерөнхий танилцуулгаас авагдана.
 */

export interface DescriptionValue {
  description: string;
  notesDescription: string;
  usageDescription: string;
}

const PARTS: {
  key: keyof DescriptionValue;
  label: string;
  hint: string;
  rows: number;
}[] = [
  {
    key: "description",
    label: "1. Ерөнхий танилцуулга",
    hint: "Ус болон брэндийн танилцуулга. Жишээ нь: «Polo est 67 EDP нь Ralph Lauren брэнд үүсгэн байгуулагдсан 1967 онд зориулж гаргасан бүтээл…»",
    rows: 5,
  },
  {
    key: "notesDescription",
    label: "2. Үнэрийн нотуудын тайлбар",
    hint: "Дээд / зүрх / суурь нотууд хэрхэн мэдрэгдэж, хэрхэн задардаг тухай.",
    rows: 4,
  },
  {
    key: "usageDescription",
    label: "3. Хэрэглэх нөхцөл",
    hint: "Хаана, ямар үед, ямар улиралд тохиромжтой.",
    rows: 3,
  },
];

export function DescriptionFields({
  value,
  onChange,
}: {
  value: DescriptionValue;
  onChange: (key: keyof DescriptionValue, next: string) => void;
}) {
  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <h2 className="font-serif text-lg font-semibold">
          Дэлгэрэнгүй тайлбар
        </h2>
        {PARTS.map((part) => (
          <div key={part.key} className="space-y-1.5">
            <Label htmlFor={part.key}>{part.label}</Label>
            <textarea
              id={part.key}
              rows={part.rows}
              value={value[part.key]}
              onChange={(e) => onChange(part.key, e.target.value)}
              className="bg-secondary field-edge flex w-full rounded-md px-3 py-2 text-base md:text-sm"
            />
            <p className="text-muted-foreground text-xs">{part.hint}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
