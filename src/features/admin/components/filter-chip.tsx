import Link from "next/link";
import { cn } from "@/lib/utils";

/** URL-based filter pill for server-filtered admin lists. */
export function FilterChip({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        // Inactive chips had only a (transparent) border, so five of the six
        // read as bare floating words. Every chip now carries a surface.
        "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );
}
