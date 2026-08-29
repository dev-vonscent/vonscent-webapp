import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div
      className="text-muted-foreground flex min-h-[50vh] items-center justify-center"
      role="status"
      aria-label="Ачаалж байна"
    >
      {/* An SVG stroke, not a border: globals.css collapses every border to
          transparent, so a `border-2` ring spinner renders as nothing at all. */}
      <Loader2 className="size-8 animate-spin" />
    </div>
  );
}
