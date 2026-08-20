import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Read-only star rating display (rounds to nearest whole star). */
export function Stars({
  rating,
  className,
  size = 16,
}: {
  rating: number;
  className?: string;
  size?: number;
}) {
  const rounded = Math.round(rating);
  return (
    <div
      className={cn("flex items-center gap-0.5", className)}
      aria-label={`${rating} / 5`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          width={size}
          height={size}
          className={cn(
            n <= rounded
              ? "fill-gold text-gold"
              : "text-muted-foreground/40 fill-transparent",
          )}
        />
      ))}
    </div>
  );
}
