import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function SectionHeading({
  title,
  subtitle,
  href,
  linkLabel = "Бүгдийг үзэх",
  compact = false,
  id,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
  /** Storefront density (home page): smaller title, tighter gap. */
  compact?: boolean;
  /** For `aria-labelledby` on the parent section. */
  id?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-end justify-between gap-4",
        compact ? "mb-3 sm:mb-4" : "mb-6",
      )}
    >
      <div className="min-w-0">
        <h2
          id={id}
          className={cn(
            "font-semibold tracking-tight",
            compact ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl",
          )}
        >
          {title}
        </h2>
        {subtitle && (
          <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>
        )}
      </div>
      {href && (
        <Link
          href={href}
          className={cn(
            "text-muted-foreground hover:text-foreground flex shrink-0 items-center gap-1 text-sm font-medium transition-colors hover:underline",
            compact && "-my-2 py-2",
          )}
        >
          {linkLabel}
          <ArrowRight className="size-4" />
        </Link>
      )}
    </div>
  );
}
