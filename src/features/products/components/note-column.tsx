/** Үнэрийн нотын нэг багана (Дээд / Зүрх / Суурь) — хоосон бол юу ч үгүй. */
export function NoteColumn({
  title,
  notes,
}: {
  title: string;
  notes: string[];
}) {
  if (!notes.length) return null;
  return (
    <div>
      <p className="text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase">
        {title}
      </p>
      <p className="text-sm">{notes.join(", ")}</p>
    </div>
  );
}
