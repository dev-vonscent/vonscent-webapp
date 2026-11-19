import { PROFILE_GENDER_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Review } from "../types";

/**
 * Сэтгэгдлийн зохиогчийн нэрийн доорх хүйс, насны ангиллын chip (0198, туг
 * `profile_info`). Аль нь ч байхгүй бол юу ч зурахгүй.
 */
export function ReviewAuthorChips({
  review,
  className,
}: {
  review: Pick<Review, "authorGender" | "authorAgeGroup">;
  className?: string;
}) {
  const chips = [
    review.authorGender ? PROFILE_GENDER_LABEL[review.authorGender] : null,
    review.authorAgeGroup ? `${review.authorAgeGroup} нас` : null,
  ].filter((c): c is string => c !== null);
  if (chips.length === 0) return null;
  return (
    <span className={cn("flex flex-wrap gap-1", className)}>
      {chips.map((label) => (
        <span
          key={label}
          className="bg-secondary text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums"
        >
          {label}
        </span>
      ))}
    </span>
  );
}
